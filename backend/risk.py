from __future__ import annotations

import os
import re
from typing import Any


HIGH_RISK_TERMS = tuple(
    term.strip().lower()
    for term in os.getenv("NEXUS_HIGH_RISK_TERMS", "fire,explosion,trapped,collapsed,mayday,gunshot").split(",")
    if term.strip()
)
MEDIUM_RISK_TERMS = tuple(
    term.strip().lower()
    for term in os.getenv("NEXUS_MEDIUM_RISK_TERMS", "smoke,flood,injury,injured,crash,help,evacuate").split(",")
    if term.strip()
)


def keyword_risk(analyses: list[dict[str, Any]]) -> dict[str, Any]:
    observed: list[str] = []
    sources: list[str] = []
    for analysis in analyses:
        result = analysis.get("result", {})
        image = result.get("image_understanding", {})
        caption = image.get("caption") if image.get("status") == "complete" else ""
        audio = result.get("speech_to_text", {})
        transcript = audio.get("text") if audio.get("status") == "complete" else ""
        text = f"{caption or ''} {transcript or ''}".lower()
        if text.strip():
            sources.append(analysis.get("modality", "evidence"))
        for term in HIGH_RISK_TERMS + MEDIUM_RISK_TERMS:
            if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text):
                observed.append(term)
    observed = sorted(set(observed))
    if any(term in observed for term in HIGH_RISK_TERMS):
        level = "high"
    elif any(term in observed for term in MEDIUM_RISK_TERMS):
        level = "medium"
    elif sources:
        level = "low"
    else:
        level = "unknown"
    return {
        "level": level,
        "matched_terms": observed,
        "source_modalities": sorted(set(sources)),
        "rule": "Configured keyword matches in model-generated image captions or successful transcripts. A low result means no configured keyword was found in available text; it does not mean the situation is safe.",
    }
