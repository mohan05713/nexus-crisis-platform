from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    hf_token: str = os.getenv("HF_TOKEN", "").strip()
    image_ai_endpoint: str = os.getenv("HF_IMAGE_AI_ENDPOINT", "").strip()
    image_ai_model_name: str = os.getenv("HF_IMAGE_AI_MODEL_NAME", "capcheck/ai-image-detection").strip()
    image_caption_endpoint: str = os.getenv("HF_IMAGE_CAPTION_ENDPOINT", "").strip()
    image_caption_model_name: str = os.getenv("HF_IMAGE_CAPTION_MODEL_NAME", "Salesforce/blip-image-captioning-base").strip()
    audio_deepfake_endpoint: str = os.getenv("HF_AUDIO_DEEPFAKE_ENDPOINT", "").strip()
    audio_deepfake_model_name: str = os.getenv("HF_AUDIO_DEEPFAKE_MODEL_NAME", "Vansh180/deepfake-audio-wav2vec2").strip()
    asr_endpoint: str = os.getenv("HF_ASR_ENDPOINT", "").strip()
    asr_model_name: str = os.getenv("HF_ASR_MODEL_NAME", "openai/whisper-base").strip()
    summary_model: str = os.getenv("HF_SUMMARY_MODEL", "").strip()
    inference_timeout_seconds: int = int(os.getenv("INFERENCE_TIMEOUT_SECONDS", "45"))
    image_max_bytes: int = int(os.getenv("IMAGE_MAX_MB", "12")) * 1024 * 1024
    audio_max_bytes: int = int(os.getenv("AUDIO_MAX_MB", "24")) * 1024 * 1024
    database_path: Path = Path(os.getenv("NEXUS_DATABASE_PATH", str(PROJECT_ROOT / "data" / "nexus.sqlite3")))


settings = Settings()


