from __future__ import annotations

import json
from typing import Any

from huggingface_hub import InferenceClient

from .config import settings


class ModelUnavailable(RuntimeError):
    pass


def _client(model: str) -> InferenceClient:
    if not model:
        raise ModelUnavailable("This model endpoint is not configured.")
    if not settings.hf_token:
        raise ModelUnavailable("HF_TOKEN is not configured on the backend.")
    return InferenceClient(token=settings.hf_token, timeout=settings.inference_timeout_seconds)


def _attr(value: Any, key: str, fallback: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(key, fallback)
    return getattr(value, key, fallback)


def classify_image(data: bytes) -> list[dict[str, Any]]:
    model = settings.image_ai_endpoint
    client = _client(model)
    output = client.image_classification(data, model=model, top_k=5)
    return [{"label": str(_attr(item, "label", "unknown")), "score": float(_attr(item, "score", 0.0))} for item in output]


def caption_image(data: bytes) -> str:
    model = settings.image_caption_endpoint
    client = _client(model)
    output = client.image_to_text(data, model=model, max_new_tokens=96)
    caption = _attr(output, "generated_text", "")
    if not caption:
        raise RuntimeError("The image-understanding endpoint returned no caption.")
    return str(caption).strip()[:1000]


def classify_audio(data: bytes) -> list[dict[str, Any]]:
    model = settings.audio_deepfake_endpoint
    client = _client(model)
    output = client.audio_classification(data, model=model, top_k=5)
    return [{"label": str(_attr(item, "label", "unknown")), "score": float(_attr(item, "score", 0.0))} for item in output]


def transcribe_audio(data: bytes) -> dict[str, Any]:
    model = settings.asr_endpoint
    client = _client(model)
    output = client.automatic_speech_recognition(data, model=model)
    transcript = _attr(output, "text", "")
    if not transcript:
        raise RuntimeError("The speech-to-text endpoint returned no transcript.")
    return {"text": str(transcript).strip()[:6000]}


def summarize_case(evidence: dict[str, Any], caller_notes: str = "") -> str:
    model = settings.summary_model
    client = _client(model)
    safe_notes = caller_notes.strip()[:1200]
    prompt = (
        "Summarize these preliminary multimodal observations for a human reviewer. "
        "Separate observed model output from caller notes. Do not assert that files are related, "
        "that an emergency is confirmed, or that a person committed wrongdoing. State uncertainty. "
        "Give concise verification steps. Evidence JSON: "
        + json.dumps(evidence, ensure_ascii=False)[:9000]
        + (" Caller notes (unverified): " + safe_notes if safe_notes else "")
    )
    response = client.chat_completion(
        model=model,
        messages=[
            {"role": "system", "content": "You write cautious, evidence-limited verification summaries."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=360,
        temperature=0.2,
    )
    choices = _attr(response, "choices", [])
    if not choices:
        raise RuntimeError("The summary endpoint returned no message.")
    message = _attr(choices[0], "message", {})
    content = _attr(message, "content", "")
    if not content:
        raise RuntimeError("The summary endpoint returned an empty message.")
    return str(content).strip()[:5000]

