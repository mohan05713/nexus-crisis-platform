from __future__ import annotations

import asyncio
import io
import json
import logging
import mimetypes
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from xml.sax.saxutils import escape

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from mutagen import File as MutagenFile
from PIL import ExifTags, Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from starlette.concurrency import run_in_threadpool

from . import database, external_feeds, geocoding, report_generator
from .config import PROJECT_ROOT, settings
from .database import connect, _row_to_incident
from .inference import (
    ModelUnavailable,
    caption_image,
    classify_audio,
    classify_image,
    summarize_case,
    transcribe_audio,
)
from .risk import keyword_risk


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("nexus")
app = FastAPI(title="NEXUS Crisis Intelligence API", version="1.0.0")
cors_origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

_request_times: dict[str, list[float]] = {}
_RATE_LIMIT = 20
_RATE_WINDOW_SECONDS = 60


@app.middleware("http")
async def local_rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api/analyze") and request.method == "POST":
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        history = [value for value in _request_times.get(client_ip, []) if now - value < _RATE_WINDOW_SECONDS]
        if len(history) >= _RATE_LIMIT:
            return JSONResponse({"detail": "Analysis rate limit reached. Wait one minute and try again."}, status_code=429)
        history.append(now)
        _request_times[client_ip] = history
    return await call_next(request)


class FusionRequest(BaseModel):
    investigation_id: str = Field(min_length=6, max_length=24)
    caller_notes: str = Field(default="", max_length=1200)
    data_consent: bool = False


def _model_health(endpoint: str, model_name: str, token_required: bool = True) -> dict[str, Any]:
    configured = bool(endpoint and (settings.hf_token or not token_required))
    if not endpoint:
        status = "not_configured"
        message = "Configure a Hugging Face Inference Endpoint URL in .env."
    elif token_required and not settings.hf_token:
        status = "missing_token"
        message = "HF_TOKEN is required by the backend to call this endpoint."
    else:
        status = "configured"
        message = "Configured. The first model request will verify the endpoint."
    return {"name": model_name, "configured": configured, "status": status, "message": message}


def _all_model_health() -> dict[str, Any]:
    return {
        "image_ai_detection": _model_health(settings.image_ai_endpoint, settings.image_ai_model_name),
        "image_understanding": _model_health(settings.image_caption_endpoint, settings.image_caption_model_name),
        "audio_deepfake_detection": _model_health(settings.audio_deepfake_endpoint, settings.audio_deepfake_model_name),
        "speech_to_text": _model_health(settings.asr_endpoint, settings.asr_model_name),
        "multimodal_summary": _model_health(settings.summary_model, settings.summary_model, token_required=True),
    }


async def _try_model(task: str, model_name: str, function: Callable[..., Any], payload: bytes) -> dict[str, Any]:
    try:
        result = await run_in_threadpool(function, payload)
        return {"status": "complete", "task": task, "model": model_name, "result": result}
    except ModelUnavailable as error:
        return {"status": "unavailable", "task": task, "model": model_name, "message": str(error)}
    except Exception as error:  # Provider errors are intentionally kept out of logs and responses.
        logger.warning("Model task failed: %s (%s)", task, type(error).__name__)
        return {
            "status": "error", "task": task, "model": model_name,
            "message": "The configured model request failed or timed out. Check endpoint readiness, supported task, and token permissions.",
        }


def _read_image_metadata(data: bytes) -> dict[str, Any]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            if width * height > 40_000_000:
                raise HTTPException(status_code=413, detail="Image dimensions exceed the 40 megapixel limit.")
            selected_exif: dict[str, str] = {}
            try:
                exif = image.getexif()
                for tag, value in exif.items():
                    name = ExifTags.TAGS.get(tag, str(tag))
                    if name in {"Make", "Model", "Software", "DateTimeOriginal", "DateTime"}:
                        selected_exif[name] = str(value)[:180]
            except (AttributeError, OSError, ValueError):
                selected_exif = {}
            return {
                "format": image.format or "unknown", "width": width, "height": height,
                "mode": image.mode, "exif": selected_exif,
                "exif_note": "Only camera/software/time fields are shown. GPS EXIF is not stored.",
            }
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=422, detail="This file is not a supported readable image.") from error
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=422, detail="The image is corrupt or cannot be decoded.") from error


def _read_audio_metadata(data: bytes, filename: str) -> dict[str, Any]:
    try:
        audio = MutagenFile(io.BytesIO(data))
        if audio is None or getattr(audio, "info", None) is None:
            raise ValueError("No audio metadata found.")
        info = audio.info
        duration = float(getattr(info, "length", 0) or 0)
        if duration <= 0:
            raise ValueError("Audio duration is unavailable.")
        return {
            "duration_seconds": round(duration, 3),
            "sample_rate_hz": int(getattr(info, "sample_rate", 0) or 0) or None,
            "channels": int(getattr(info, "channels", 0) or 0) or None,
            "container": Path(filename).suffix.lower().lstrip(".") or "unknown",
        }
    except Exception as error:
        raise HTTPException(status_code=422, detail="The audio file is unsupported or corrupt. Try WAV, MP3, M4A, OGG, FLAC, or WebM.") from error


def _keywords(transcript: str | None) -> list[str]:
    if not transcript:
        return []
    terms = ("fire", "smoke", "flood", "trapped", "help", "injury", "injured", "explosion", "collapse", "crash", "mayday", "evacuate")
    lowered = transcript.lower()
    return [term for term in terms if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", lowered)]


def _status_for(results: list[dict[str, Any]]) -> str:
    states = [item["status"] for item in results]
    if states and all(state == "complete" for state in states):
        return "complete"
    if any(state == "complete" for state in states):
        return "partial"
    return "partial"


@app.on_event("startup")
def startup() -> None:
    database.init_db()


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        with database.connect() as db:
            db.execute("SELECT 1").fetchone()
        db_ready = True
    except Exception:
        db_ready = False
    return {
        "backend": {"available": True, "name": "FastAPI"},
        "database": {"available": db_ready, "name": "SQLite", "stores": "analysis metadata and results only; uploaded media is not retained"},
        "models": _all_model_health(),
        "limits": {"image_max_mb": settings.image_max_bytes // (1024 * 1024), "audio_max_mb": settings.audio_max_bytes // (1024 * 1024)},
    }


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    return database.dashboard_data()


@app.get("/api/investigations")
def investigations(q: str = "", limit: int = 50) -> dict[str, Any]:
    return {"items": database.list_investigations(q[:120], max(1, min(limit, 100)))}


@app.get("/api/investigations/{investigation_id}")
def investigation_detail(investigation_id: str) -> dict[str, Any]:
    result = database.get_investigation(investigation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    result["keyword_risk"] = keyword_risk(result["analyses"])
    return result


@app.delete("/api/investigations/{investigation_id}")
def remove_investigation(investigation_id: str) -> dict[str, bool]:
    if not database.delete_investigation(investigation_id):
        raise HTTPException(status_code=404, detail="Investigation not found.")
    return {"deleted": True}


@app.post("/api/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    data_consent: bool = Form(False),
    investigation_id: str = Form(""),
    location: str = Form(""),
    caller_notes: str = Form(""),
) -> dict[str, Any]:
    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_ext:
        raise HTTPException(status_code=415, detail="Supported image formats are JPG, JPEG, PNG, and WEBP.")
    data = await file.read(settings.image_max_bytes + 1)
    if len(data) > settings.image_max_bytes:
        raise HTTPException(status_code=413, detail=f"Image exceeds the {settings.image_max_bytes // (1024 * 1024)} MB upload limit.")
    metadata = _read_image_metadata(data)
    models = _all_model_health()
    image_tasks_configured = any(models[name]["configured"] for name in ("image_ai_detection", "image_understanding"))
    if image_tasks_configured and not data_consent:
        raise HTTPException(status_code=400, detail="This image will be sent to the configured Hugging Face endpoint. Check the data-sharing consent box to continue.")

    ai = await _try_model("ai_generated_image_classification", settings.image_ai_model_name, lambda payload: classify_image(payload), data)
    scene = await _try_model("image_captioning", settings.image_caption_model_name, lambda payload: caption_image(payload), data)
    ai_result = ai.get("result", [])
    caption_result = scene.get("result", "")
    output = {
        "file": {"name": Path((file.filename or "evidence").replace("\\", "/")).name, "mime_type": file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream", "size_bytes": len(data)},
        "image_metadata": {"status": "complete", **metadata},
        "ai_generated_detection": ai if ai["status"] == "complete" else {key: value for key, value in ai.items() if key != "result"},
        "image_understanding": {"status": scene["status"], "model": settings.image_caption_model_name, "caption": caption_result} if scene["status"] == "complete" else {key: value for key, value in scene.items() if key != "result"},
        "image_manipulation_detection": {"status": "unavailable", "message": "No dedicated image-manipulation model is configured. Metadata inspection is not a manipulation verdict."},
        "misleading_content_assessment": {"status": "unavailable", "message": "The app does not decide whether an image is misleading; compare it with trusted sources."},
        "model_labels": ai_result,
        "limitations": ["AI-image classification is probabilistic and can fail on new generators, edits, compression, and screenshots.", "Image captions may omit or misdescribe details. Verify visual observations independently."],
    }
    results_for_risk = [{"modality": "image", "result": output}]
    output["keyword_risk"] = keyword_risk(results_for_risk)
    status = _status_for([ai, scene])
    case_id = database.create_or_update_investigation(investigation_id or None, location, "")
    saved = database.save_analysis(case_id, "image", status, file.filename or "evidence-image", output["file"]["mime_type"], len(data), output)
    return {"investigation_id": case_id, "analysis_id": saved["id"], "status": status, "result": output, "retention": "The image bytes were not saved. Analysis metadata and results were saved in the local SQLite database."}


@app.post("/api/analyze/audio")
async def analyze_audio(
    file: UploadFile = File(...),
    data_consent: bool = Form(False),
    investigation_id: str = Form(""),
    location: str = Form(""),
    caller_notes: str = Form(""),
) -> dict[str, Any]:
    allowed_ext = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm", ".mp4"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_ext:
        raise HTTPException(status_code=415, detail="Supported audio formats are WAV, MP3, M4A, AAC, OGG, FLAC, and WebM.")
    data = await file.read(settings.audio_max_bytes + 1)
    if len(data) > settings.audio_max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio exceeds the {settings.audio_max_bytes // (1024 * 1024)} MB upload limit.")
    metadata = _read_audio_metadata(data, file.filename or "audio")
    models = _all_model_health()
    audio_tasks_configured = any(models[name]["configured"] for name in ("audio_deepfake_detection", "speech_to_text"))
    if audio_tasks_configured and not data_consent:
        raise HTTPException(status_code=400, detail="This audio will be sent to the configured Hugging Face endpoint. Check the data-sharing consent box to continue.")

    detector = await _try_model("synthetic_voice_classification", settings.audio_deepfake_model_name, classify_audio, data)
    speech = await _try_model("speech_to_text", settings.asr_model_name, transcribe_audio, data)
    detector_result = detector.get("result", [])
    transcript_result = speech.get("result", {})
    transcript = transcript_result.get("text") if isinstance(transcript_result, dict) else None
    output = {
        "file": {"name": Path((file.filename or "evidence").replace("\\", "/")).name, "mime_type": file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream", "size_bytes": len(data)},
        "technical_metadata": {"status": "complete", **metadata},
        "synthetic_voice_detection": detector if detector["status"] == "complete" else {key: value for key, value in detector.items() if key != "result"},
        "speech_to_text": {"status": speech["status"], "model": settings.asr_model_name, **transcript_result} if speech["status"] == "complete" else {key: value for key, value in speech.items() if key != "result"},
        "crisis_keywords": _keywords(transcript),
        "model_labels": detector_result,
        "limitations": ["Voice classification is not proof of identity, authenticity, or wrongdoing.", "Model results depend on training data, language, channel, codec, and audio quality. Human verification is required."],
    }
    status = _status_for([detector, speech])
    case_id = database.create_or_update_investigation(investigation_id or None, location, "")
    saved = database.save_analysis(case_id, "audio", status, file.filename or "evidence-audio", output["file"]["mime_type"], len(data), output)
    return {"investigation_id": case_id, "analysis_id": saved["id"], "status": status, "result": output, "retention": "The audio bytes were not saved. Analysis metadata and results were saved in the local SQLite database."}


@app.post("/api/analyze/multimodal")
async def analyze_multimodal(request: FusionRequest) -> dict[str, Any]:
    investigation = database.get_investigation(request.investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    if not investigation["analyses"]:
        raise HTTPException(status_code=400, detail="Analyze an image or audio file before running multimodal comparison.")
    evidence = {
        "investigation_id": investigation["id"],
        "analyses": [
            {"modality": analysis["modality"], "status": analysis["status"], "created_at": analysis["created_at"],
             "result": analysis["result"]}
            for analysis in investigation["analyses"]
        ],
    }
    risk = keyword_risk(investigation["analyses"])
    configured = bool(settings.hf_token and settings.summary_model)
    if configured and not request.data_consent:
        raise HTTPException(status_code=400, detail="The evidence summary will be sent to the configured model. Check the data-sharing consent box to continue.")
    if configured:
        try:
            summary = await run_in_threadpool(summarize_case, evidence, request.caller_notes)
            ai_summary = {"status": "complete", "model": settings.summary_model, "text": summary}
        except ModelUnavailable as error:
            ai_summary = {"status": "unavailable", "message": str(error)}
        except Exception as error:
            logger.warning("Multimodal summary failed (%s)", type(error).__name__)
            ai_summary = {"status": "error", "message": "The configured summary model request failed or timed out."}
    else:
        ai_summary = {"status": "unavailable", "message": "Configure HF_TOKEN and HF_SUMMARY_MODEL to use an AI-generated combined summary."}
    modalities = sorted({item["modality"] for item in investigation["analyses"]})
    comparison = {
        "available_modalities": modalities,
        "has_image_and_audio": "image" in modalities and "audio" in modalities,
        "relationship_conclusion": "No relationship between evidence files is inferred by the system.",
        "verification_steps": ["Compare timestamps and context with independent records.", "Verify location and source with a trusted contact.", "Do not use model outputs as sole evidence for emergency or legal decisions."],
    }
    result = {"investigation_id": investigation["id"], "generated_at": database.utc_now(), "keyword_risk": risk, "ai_summary": ai_summary, "comparison": comparison}
    database.save_fusion(investigation["id"], result)
    return result


@app.get("/api/investigations/{investigation_id}/report")
def investigation_report(investigation_id: str):
    record = database.get_investigation(investigation_id)
    if not record:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    output = io.BytesIO()
    report_generator.generate_three_page_report(record, output)
    output.seek(0)
    filename = f"nexus-{investigation_id.lower()}-report.pdf"
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/api/incidents")
def list_incidents(
    category: str | None = None,
    severity: str | None = None,
    country: str | None = None,
    state: str | None = None,
    district: str | None = None,
    city: str | None = None,
    since: str | None = None,
    until: str | None = None,
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List incidents with optional filters."""
    conditions = ["latitude IS NOT NULL AND longitude IS NOT NULL"]
    params: list[Any] = []
    if category:
        conditions.append("category = ?")
        params.append(category)
    if severity:
        conditions.append("severity = ?")
        params.append(severity)
    if country:
        conditions.append("country = ?")
        params.append(country)
    if state:
        conditions.append("state = ?")
        params.append(state)
    if district:
        conditions.append("district = ?")
        params.append(district)
    if city:
        conditions.append("city = ?")
        params.append(city)
    if status:
        conditions.append("status = ?")
        params.append(status)
    if since:
        conditions.append("occurred_at >= ?")
        params.append(since)
    if until:
        conditions.append("occurred_at <= ?")
        params.append(until)
    where = " AND ".join(conditions)
    with connect() as db:
        rows = db.execute(
            f"""SELECT * FROM incidents WHERE {where} ORDER BY occurred_at DESC LIMIT ?""",
            (*params, max(1, min(limit, 500))),
        ).fetchall()
    return [_row_to_incident(row) for row in rows]


@app.get("/api/incidents/statistics")
def get_incident_statistics() -> dict[str, Any]:
    """Get statistics about incidents."""
    stats = database.get_incident_statistics()
    return stats


@app.get("/api/incidents/geocode-cache")
def get_geocode_cache_items() -> list[dict[str, Any]]:
    """Get all cached geocode results."""
    with connect() as db:
        rows = db.execute("SELECT * FROM geocode_cache").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/incidents/health")
def get_data_source_health() -> list[dict[str, Any]]:
    """Get health status of all data sources."""
    return database.get_data_source_health()


@app.post("/api/incidents/sync")
def sync_incidents() -> dict[str, Any]:
    """Trigger external feed synchronization (GDACS, NASA EONET, FIRMS)."""
    return external_feeds.sync_all_sources()


@app.get("/api/geocode/search")
def search_geocode(q: str = "") -> dict[str, Any]:
    """Search for coordinates and structured address for a given location query."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Location query cannot be empty.")
    result = geocoding.geocode_address(q)
    if not result:
        return {"found": False, "query": q, "message": "Location could not be geocoded."}
    return {"found": True, "query": q, "location": result}


@app.get("/api/geocode/reverse")
def reverse_geocode_endpoint(lat: float, lon: float) -> dict[str, Any]:
    """Reverse geocode latitude and longitude to human-readable address."""
    result = geocoding.reverse_geocode(lat, lon)
    if not result:
        return {"found": False, "latitude": lat, "longitude": lon, "message": "Address not found."}
    return {"found": True, "location": result}


@app.get("/api/incidents/radar")
def nearby_crisis_radar(lat: float, lon: float, radius_km: float = 50.0) -> dict[str, Any]:
    """Find nearby incidents within a given radius in kilometers with calculated distance & bearing."""
    if radius_km <= 0 or radius_km > 5000:
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 5000.")

    all_incidents = database.list_incidents(limit=500)
    nearby: list[dict[str, Any]] = []

    for inc in all_incidents:
        inc_lat = inc.get("latitude")
        inc_lon = inc.get("longitude")
        if inc_lat is None or inc_lon is None:
            continue
        dist = geocoding.haversine_distance_km(lat, lon, inc_lat, inc_lon)
        if dist <= radius_km:
            bearing = geocoding.calculate_bearing(lat, lon, inc_lat, inc_lon)
            nearby.append({
                **inc,
                "distance_km": dist,
                "bearing": bearing,
            })

    # Sort by nearest first
    nearby.sort(key=lambda x: x["distance_km"])

    return {
        "user_coordinates": {"latitude": lat, "longitude": lon},
        "search_radius_km": radius_km,
        "incident_count": len(nearby),
        "incidents": nearby,
    }


@app.post("/api/incidents/extract-location")
async def extract_location_from_text(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Extract location entities, category, and coordinates from incident report text."""
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text payload is required.")

    category = "other"
    lower = text.lower()
    if any(k in lower for k in ("fire", "blaze", "smoke")):
        category = "building_fire" if "building" in lower or "complex" in lower else "wildfire"
    elif any(k in lower for k in ("flood", "waterlogging", "submerged")):
        category = "flood"
    elif any(k in lower for k in ("cyclone", "storm", "hurricane", "typhoon")):
        category = "cyclone"
    elif any(k in lower for k in ("earthquake", "quake", "tremor", "seismic")):
        category = "earthquake"
    elif any(k in lower for k in ("chemical", "gas leak", "toxic")):
        category = "chemical"
    elif any(k in lower for k in ("accident", "collision", "crash")):
        category = "road_accident"

    severity = "moderate"
    if any(k in lower for k in ("critical", "catastrophic", "deadly", "massive", "emergency", "fatal")):
        severity = "critical"
    elif any(k in lower for k in ("severe", "heavy", "high", "danger", "alert", "evacuate")):
        severity = "high"

    extracted_query = payload.get("location_hint") or ""
    if not extracted_query:
        cities = ["salem", "chennai", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad",
                  "ahmedabad", "pune", "jaipur", "madurai", "coimbatore", "kochi", "lucknow"]
        for c in cities:
            if c in lower:
                extracted_query = c.capitalize()
                break

    geocoded = None
    if extracted_query:
        geocoded = geocoding.geocode_address(extracted_query)

    return {
        "extracted_category": category,
        "extracted_severity": severity,
        "location_hint": extracted_query,
        "geocoded": geocoded,
        "is_verified": geocoded is not None,
    }


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str) -> dict[str, Any]:
    record = database.get_incident(incident_id)
    if not record:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return record


@app.post("/api/incidents")
async def create_incident(incident_data: dict[str, Any] = Body(...)):
    """Create a new incident."""
    try:
        incident_id = database.create_incident(incident_data)
        return {"incident_id": incident_id, "status": "created"}
    except Exception as e:
        logger.error(f"Failed to create incident: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create incident: {str(e)}")


@app.put("/api/incidents/{incident_id}")
async def update_incident(incident_id: str, incident_data: dict[str, Any] = Body(...)):
    """Update an existing incident."""
    try:
        with connect() as db:
            db.execute(
                """UPDATE incidents SET
                title = ?, description = ?, category = ?, severity = ?,
                severity_color = ?, status = ?, verification_status = ?,
                ai_confidence = ?, ai_summary = ?,
                country = ?, country_code = ?, state = ?, district = ?, city = ?,
                locality = ?, formatted_address = ?, latitude = ?, longitude = ?,
                location_accuracy = ?, location_source = ?, geocoding_status = ?,
                occurred_at = ?, detected_at = ?, last_updated_at = ?, source = ?,
                source_url = ?, source_id = ?, is_approximate = ?, updated_at = ?
                WHERE id = ?""",
                (
                    incident_data.get("title", ""),
                    incident_data.get("description", ""),
                    incident_data.get("category", "other"),
                    incident_data.get("severity", "moderate"),
                    incident_data.get("severity_color", "#6e7681"),
                    incident_data.get("status", "unverified"),
                    incident_data.get("verification_status", "pending"),
                    incident_data.get("ai_confidence", 0.0),
                    json.dumps(incident_data.get("ai_summary")) if incident_data.get("ai_summary") else None,
                    incident_data.get("country"),
                    incident_data.get("country_code"),
                    incident_data.get("state"),
                    incident_data.get("district"),
                    incident_data.get("city"),
                    incident_data.get("locality"),
                    incident_data.get("formatted_address"),
                    incident_data.get("latitude"),
                    incident_data.get("longitude"),
                    incident_data.get("location_accuracy", "exact"),
                    incident_data.get("location_source", "manual"),
                    incident_data.get("geocoding_status", "pending"),
                    incident_data.get("occurred_at"),
                    incident_data.get("detected_at", datetime.now(timezone.utc).isoformat()),
                    datetime.now(timezone.utc).isoformat(),
                    incident_data.get("source"),
                    incident_data.get("source_url"),
                    incident_data.get("source_id"),
                    incident_data.get("is_approximate", 0),
                    datetime.now(timezone.utc).isoformat(),
                    incident_id,
                ),
            )
        return {"incident_id": incident_id, "status": "updated"}
    except Exception as e:
        logger.error(f"Failed to update incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update incident: {str(e)}")


@app.delete("/api/incidents/{incident_id}")
def delete_incident(incident_id: str) -> dict[str, Any]:
    """Delete an incident."""
    deleted = database.delete_incident(incident_id)
    if deleted:
        return {"deleted": True}
    else:
        raise HTTPException(status_code=404, detail="Incident not found.")


@app.get("/api/incidents/statistics")
def get_incident_statistics() -> dict[str, Any]:
    """Get statistics about incidents."""
    stats = database.get_incident_statistics()
    return stats


@app.get("/api/incidents/geocode-cache")
def get_geocode_cache_items() -> list[dict[str, Any]]:
    """Get all cached geocode results."""
    with connect() as db:
        rows = db.execute("SELECT * FROM geocode_cache").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/incidents/health")
def get_data_source_health() -> list[dict[str, Any]]:
    """Get health status of all data sources."""
    return database.get_data_source_health()


@app.post("/api/incidents/sync")
def sync_incidents() -> dict[str, Any]:
    """Trigger external feed synchronization (GDACS, NASA EONET, FIRMS)."""
    return external_feeds.sync_all_sources()


@app.get("/api/geocode/search")
def search_geocode(q: str = "") -> dict[str, Any]:
    """Search for coordinates and structured address for a given location query."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Location query cannot be empty.")
    result = geocoding.geocode_address(q)
    if not result:
        return {"found": False, "query": q, "message": "Location could not be geocoded."}
    return {"found": True, "query": q, "location": result}


@app.get("/api/geocode/reverse")
def reverse_geocode_endpoint(lat: float, lon: float) -> dict[str, Any]:
    """Reverse geocode latitude and longitude to human-readable address."""
    result = geocoding.reverse_geocode(lat, lon)
    if not result:
        return {"found": False, "latitude": lat, "longitude": lon, "message": "Address not found."}
    return {"found": True, "location": result}


@app.get("/api/incidents/radar")
def nearby_crisis_radar(lat: float, lon: float, radius_km: float = 50.0) -> dict[str, Any]:
    """Find nearby incidents within a given radius in kilometers with calculated distance & bearing."""
    if radius_km <= 0 or radius_km > 5000:
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 5000.")

    all_incidents = database.list_incidents(limit=500)
    nearby: list[dict[str, Any]] = []

    for inc in all_incidents:
        inc_lat = inc.get("latitude")
        inc_lon = inc.get("longitude")
        if inc_lat is None or inc_lon is None:
            continue
        dist = geocoding.haversine_distance_km(lat, lon, inc_lat, inc_lon)
        if dist <= radius_km:
            bearing = geocoding.calculate_bearing(lat, lon, inc_lat, inc_lon)
            nearby.append({
                **inc,
                "distance_km": dist,
                "bearing": bearing,
            })

    # Sort by nearest first
    nearby.sort(key=lambda x: x["distance_km"])

    return {
        "user_coordinates": {"latitude": lat, "longitude": lon},
        "search_radius_km": radius_km,
        "incident_count": len(nearby),
        "incidents": nearby,
    }


@app.post("/api/incidents/extract-location")
async def extract_location_from_text(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Extract location entities, category, and coordinates from incident report text."""
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text payload is required.")

    # Rule-based and geocoding extraction
    category = "other"
    lower = text.lower()
    if any(k in lower for k in ("fire", "blaze", "smoke")):
        category = "building_fire" if "building" in lower or "complex" in lower else "wildfire"
    elif any(k in lower for k in ("flood", "waterlogging", "submerged")):
        category = "flood"
    elif any(k in lower for k in ("cyclone", "storm", "hurricane", "typhoon")):
        category = "cyclone"
    elif any(k in lower for k in ("earthquake", "quake", "tremor", "seismic")):
        category = "earthquake"
    elif any(k in lower for k in ("chemical", "gas leak", "toxic")):
        category = "chemical"
    elif any(k in lower for k in ("accident", "collision", "crash")):
        category = "road_accident"

    severity = "moderate"
    if any(k in lower for k in ("critical", "catastrophic", "deadly", "massive", "emergency", "fatal")):
        severity = "critical"
    elif any(k in lower for k in ("severe", "heavy", "high", "danger", "alert", "evacuate")):
        severity = "high"

    # Known location search attempt from text
    extracted_query = payload.get("location_hint") or ""
    if not extracted_query:
        # Check for Indian locations mentioned in prompt
        cities = ["salem", "chennai", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad",
                  "ahmedabad", "pune", "jaipur", "madurai", "coimbatore", "kochi", "lucknow"]
        for c in cities:
            if c in lower:
                extracted_query = c.capitalize()
                break

    geocoded = None
    if extracted_query:
        geocoded = geocoding.geocode_address(extracted_query)

    return {
        "extracted_category": category,
        "extracted_severity": severity,
        "location_hint": extracted_query,
        "geocoded": geocoded,
        "is_verified": geocoded is not None,
    }


static_dir = PROJECT_ROOT / "frontend"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

