from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from .config import settings


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def init_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS investigations (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                location TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                fusion_json TEXT
            );
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
                modality TEXT NOT NULL CHECK(modality IN ('image','audio')),
                status TEXT NOT NULL CHECK(status IN ('complete','partial','failed')),
                created_at TEXT NOT NULL,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                result_json TEXT NOT NULL,
                error_text TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_analyses_investigation ON analyses(investigation_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);
            """
        )
        # Location Intelligence tables
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                investigation_id TEXT REFERENCES investigations(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other',
                severity TEXT NOT NULL DEFAULT 'moderate',
                severity_color TEXT NOT NULL DEFAULT '#6e7681',
                status TEXT NOT NULL DEFAULT 'unverified',
                verification_status TEXT NOT NULL DEFAULT 'pending',
                ai_confidence REAL DEFAULT 0,
                ai_summary TEXT,
                country TEXT,
                country_code TEXT,
                state TEXT,
                district TEXT,
                city TEXT,
                locality TEXT,
                formatted_address TEXT,
                latitude REAL,
                longitude REAL,
                location_accuracy TEXT NOT NULL DEFAULT 'exact',
                location_source TEXT NOT NULL DEFAULT 'manual',
                geocoding_status TEXT NOT NULL DEFAULT 'pending',
                occurred_at TEXT,
                detected_at TEXT NOT NULL,
                last_updated_at TEXT NOT NULL,
                source TEXT,
                source_url TEXT,
                source_id TEXT,
                is_approximate INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_incidents_lat_lon ON incidents(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_incidents_country_state ON incidents(country, state);
            CREATE INDEX IF NOT EXISTS idx_incidents_district_city ON incidents(district, city);
            CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);
            CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
            CREATE INDEX IF NOT EXISTS idx_incidents_occurred_at ON incidents(occurred_at);
            CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);

            CREATE TABLE IF NOT EXISTS incident_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_at TEXT NOT NULL,
                changed_by TEXT DEFAULT 'system'
            );

            CREATE TABLE IF NOT EXISTS geocode_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT UNIQUE NOT NULL,
                latitude REAL,
                longitude REAL,
                formatted_address TEXT,
                country TEXT,
                state TEXT,
                district TEXT,
                city TEXT,
                locality TEXT,
                source TEXT NOT NULL,
                accuracy TEXT NOT NULL DEFAULT 'exact',
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS data_source_health (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                last_sync TEXT,
                last_error TEXT,
                request_count INTEGER DEFAULT 0,
                rate_limit_remaining INTEGER
            );
            """
        )
        # Seed initial incidents if empty
        count = db.execute("SELECT COUNT(*) AS c FROM incidents").fetchone()["c"]
        if count == 0:
            sample_incidents = [
                {
                    "id": "NX-INC-001",
                    "title": "Severe Cyclone Alert & Coastal Flooding",
                    "description": "Heavy storm surge and flooding reported across coastal districts.",
                    "category": "cyclone",
                    "severity": "critical",
                    "severity_color": "#ff5252",
                    "status": "active",
                    "verification_status": "verified",
                    "ai_confidence": 0.96,
                    "country": "India",
                    "country_code": "IN",
                    "state": "Tamil Nadu",
                    "district": "Chennai",
                    "city": "Chennai",
                    "locality": "Marina Beach Area",
                    "formatted_address": "Chennai, Tamil Nadu, India",
                    "latitude": 13.0827,
                    "longitude": 80.2707,
                    "location_accuracy": "exact",
                    "location_source": "GDACS / IMD",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "IMD Sachet",
                    "source_url": "https://sachet.ndma.gov.in",
                    "source_id": "IMD-TN-2026-01",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                },
                {
                    "id": "NX-INC-002",
                    "title": "Industrial Chemical Leak & Evacuation",
                    "description": "Chemical storage facility leakage reported near industrial corridor.",
                    "category": "chemical",
                    "severity": "high",
                    "severity_color": "#ffb347",
                    "status": "active",
                    "verification_status": "verified",
                    "ai_confidence": 0.92,
                    "country": "India",
                    "country_code": "IN",
                    "state": "Tamil Nadu",
                    "district": "Salem",
                    "city": "Salem",
                    "locality": "Suramangalam Industrial Area",
                    "formatted_address": "Salem, Tamil Nadu, India",
                    "latitude": 11.6643,
                    "longitude": 78.1460,
                    "location_accuracy": "exact",
                    "location_source": "NDMA Sachet",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "NDMA Sachet",
                    "source_url": "https://sachet.ndma.gov.in",
                    "source_id": "NDMA-SLM-02",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                },
                {
                    "id": "NX-INC-003",
                    "title": "Flash Flood & River Overflow",
                    "description": "Continuous heavy rainfall causing river overflow and road blockages.",
                    "category": "flood",
                    "severity": "high",
                    "severity_color": "#ffb347",
                    "status": "active",
                    "verification_status": "verified",
                    "ai_confidence": 0.89,
                    "country": "India",
                    "country_code": "IN",
                    "state": "Maharashtra",
                    "district": "Mumbai City",
                    "city": "Mumbai",
                    "locality": "Dadar West",
                    "formatted_address": "Mumbai, Maharashtra, India",
                    "latitude": 19.0760,
                    "longitude": 72.8777,
                    "location_accuracy": "exact",
                    "location_source": "NASA FIRMS",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "NASA EONET",
                    "source_url": "https://eonet.gsfc.nasa.gov",
                    "source_id": "EONET-MUM-03",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                },
                {
                    "id": "NX-INC-004",
                    "title": "Urban Building Fire Hazard",
                    "description": "Major commercial complex fire reported in central district.",
                    "category": "building_fire",
                    "severity": "critical",
                    "severity_color": "#ff5252",
                    "status": "active",
                    "verification_status": "verified",
                    "ai_confidence": 0.95,
                    "country": "India",
                    "country_code": "IN",
                    "state": "Delhi",
                    "district": "New Delhi",
                    "city": "New Delhi",
                    "locality": "Connaught Place",
                    "formatted_address": "New Delhi, Delhi, India",
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "location_accuracy": "exact",
                    "location_source": "Emergency Dispatch",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "NDMA Sachet",
                    "source_url": "https://sachet.ndma.gov.in",
                    "source_id": "DELHI-FIRE-04",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                },
                {
                    "id": "NX-INC-005",
                    "title": "Wildfire Alert (Forest Range)",
                    "description": "Satellite thermal anomaly detected in dry forest canopy.",
                    "category": "wildfire",
                    "severity": "moderate",
                    "severity_color": "#ffb347",
                    "status": "monitoring",
                    "verification_status": "verified",
                    "ai_confidence": 0.91,
                    "country": "India",
                    "country_code": "IN",
                    "state": "Karnataka",
                    "district": "Kodagu",
                    "city": "Madikeri",
                    "locality": "Western Ghats Range",
                    "formatted_address": "Madikeri, Karnataka, India",
                    "latitude": 12.4244,
                    "longitude": 75.7382,
                    "location_accuracy": "exact",
                    "location_source": "NASA FIRMS",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "NASA FIRMS",
                    "source_url": "https://firms.modaps.eosdis.nasa.gov",
                    "source_id": "FIRMS-KAR-05",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                },
                {
                    "id": "NX-INC-006",
                    "title": "Seismic Activity / Minor Earthquake",
                    "description": "Mild tremor registered by seismic monitoring stations.",
                    "category": "earthquake",
                    "severity": "moderate",
                    "severity_color": "#ffb347",
                    "status": "resolved",
                    "verification_status": "verified",
                    "ai_confidence": 0.98,
                    "country": "Japan",
                    "country_code": "JP",
                    "state": "Tokyo",
                    "district": "Tokyo Metropolis",
                    "city": "Tokyo",
                    "locality": "Shinjuku City",
                    "formatted_address": "Tokyo, Japan",
                    "latitude": 35.6762,
                    "longitude": 139.6503,
                    "location_accuracy": "exact",
                    "location_source": "GDACS",
                    "geocoding_status": "success",
                    "occurred_at": utc_now(),
                    "detected_at": utc_now(),
                    "last_updated_at": utc_now(),
                    "source": "GDACS",
                    "source_url": "https://www.gdacs.org",
                    "source_id": "GDACS-EQ-JP-06",
                    "is_approximate": 0,
                    "created_at": utc_now(),
                    "updated_at": utc_now(),
                }
            ]
            for inc in sample_incidents:
                db.execute(
                    """INSERT OR IGNORE INTO incidents
                    (id, investigation_id, title, description, category, severity, severity_color,
                     status, verification_status, ai_confidence, country, country_code, state, district,
                     city, locality, formatted_address, latitude, longitude, location_accuracy, location_source,
                     geocoding_status, occurred_at, detected_at, last_updated_at, source, source_url, source_id,
                     is_approximate, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        inc["id"], inc.get("investigation_id"), inc["title"], inc["description"],
                        inc["category"], inc["severity"], inc["severity_color"], inc["status"],
                        inc["verification_status"], inc["ai_confidence"], inc["country"], inc["country_code"],
                        inc["state"], inc["district"], inc["city"], inc["locality"], inc["formatted_address"],
                        inc["latitude"], inc["longitude"], inc["location_accuracy"], inc["location_source"],
                        inc["geocoding_status"], inc["occurred_at"], inc["detected_at"], inc["last_updated_at"],
                        inc["source"], inc["source_url"], inc["source_id"], inc["is_approximate"],
                        inc["created_at"], inc["updated_at"]
                    )
                )


def create_or_update_investigation(investigation_id: str | None, location: str, notes: str) -> str:
    now = utc_now()
    with connect() as db:
        if investigation_id:
            found = db.execute("SELECT id FROM investigations WHERE id = ?", (investigation_id,)).fetchone()
            if found:
                db.execute(
                    "UPDATE investigations SET updated_at = ?, location = ?, notes = ? WHERE id = ?",
                    (now, location[:160], notes[:1200], investigation_id),
                )
                return investigation_id
        new_id = f"NX-{uuid.uuid4().hex[:10].upper()}"
        db.execute(
            "INSERT INTO investigations (id, created_at, updated_at, location, notes) VALUES (?, ?, ?, ?, ?)",
            (new_id, now, now, location[:160], notes[:1200]),
        )
        return new_id


def save_analysis(
    investigation_id: str,
    modality: str,
    status: str,
    file_name: str,
    mime_type: str,
    size_bytes: int,
    result: dict[str, Any],
    error_text: str | None = None,
) -> dict[str, Any]:
    now = utc_now()
    safe_name = Path(file_name.replace("\\", "/")).name[:180] or "evidence-file"
    with connect() as db:
        cursor = db.execute(
            """INSERT INTO analyses
            (investigation_id, modality, status, created_at, file_name, mime_type, size_bytes, result_json, error_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (investigation_id, modality, status, now, safe_name, mime_type[:120], size_bytes,
             json.dumps(result, ensure_ascii=False), (error_text or "")[:500] or None),
        )
        db.execute("UPDATE investigations SET updated_at = ? WHERE id = ?", (now, investigation_id))
        record_id = cursor.lastrowid
    return {"id": record_id, "created_at": now, "status": status}


def save_fusion(investigation_id: str, fusion: dict[str, Any]) -> None:
    with connect() as db:
        db.execute(
            "UPDATE investigations SET updated_at = ?, fusion_json = ? WHERE id = ?",
            (utc_now(), json.dumps(fusion, ensure_ascii=False), investigation_id),
        )


# === Location Intelligence functions ===

def create_incident(data: dict[str, Any]) -> str:
    """Create a new incident record."""
    now = utc_now()
    incident_id = f"NX-INC-{uuid.uuid4().hex[:10].upper()}"
    with connect() as db:
        db.execute(
            """INSERT INTO incidents
            (id, investigation_id, title, description, category, severity, severity_color,
             status, verification_status, ai_confidence, ai_summary,
             country, country_code, state, district, city, locality, formatted_address,
             latitude, longitude, location_accuracy, location_source, geocoding_status,
             occurred_at, detected_at, last_updated_at, source, source_url, source_id,
             is_approximate, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                incident_id,
                data.get("investigation_id"),
                data.get("title", ""),
                data.get("description", ""),
                data.get("category", "other"),
                data.get("severity", "moderate"),
                data.get("severity_color", "#6e7681"),
                data.get("status", "unverified"),
                data.get("verification_status", "pending"),
                data.get("ai_confidence", 0.0),
                json.dumps(data.get("ai_summary")) if data.get("ai_summary") else None,
                data.get("country"),
                data.get("country_code"),
                data.get("state"),
                data.get("district"),
                data.get("city"),
                data.get("locality"),
                data.get("formatted_address"),
                data.get("latitude"),
                data.get("longitude"),
                data.get("location_accuracy", "exact"),
                data.get("location_source", "manual"),
                data.get("geocoding_status", "pending"),
                data.get("occurred_at"),
                data.get("detected_at", now),
                now,
                data.get("source"),
                data.get("source_url"),
                data.get("source_id"),
                data.get("is_approximate", 0),
                now,
                now,
            ),
        )
    return incident_id


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


def get_incident(incident_id: str) -> dict[str, Any] | None:
    """Get a single incident by ID."""
    with connect() as db:
        row = db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    return _row_to_incident(row) if row else None


def delete_incident(incident_id: str) -> bool:
    """Delete an incident by ID."""
    with connect() as db:
        cursor = db.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
        return cursor.rowcount > 0


def _row_to_incident(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "investigation_id": row["investigation_id"],
        "title": row["title"],
        "description": row["description"],
        "category": row["category"],
        "severity": row["severity"],
        "severity_color": row["severity_color"],
        "status": row["status"],
        "verification_status": row["verification_status"],
        "ai_confidence": row["ai_confidence"],
        "ai_summary": json.loads(row["ai_summary"]) if row["ai_summary"] else None,
        "country": row["country"],
        "country_code": row["country_code"],
        "state": row["state"],
        "district": row["district"],
        "city": row["city"],
        "locality": row["locality"],
        "formatted_address": row["formatted_address"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "location_accuracy": row["location_accuracy"],
        "location_source": row["location_source"],
        "geocoding_status": row["geocoding_status"],
        "occurred_at": row["occurred_at"],
        "detected_at": row["detected_at"],
        "last_updated_at": row["last_updated_at"],
        "source": row["source"],
        "source_url": row["source_url"],
        "source_id": row["source_id"],
        "is_approximate": bool(row["is_approximate"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_incident_statistics() -> dict[str, Any]:
    """Get dashboard statistics for incidents."""
    with connect() as db:
        total = db.execute("SELECT COUNT(*) AS c FROM incidents").fetchone()["c"]
        by_severity = db.execute(
            "SELECT severity, COUNT(*) AS c FROM incidents GROUP BY severity"
        ).fetchall()
        by_category = db.execute(
            "SELECT category, COUNT(*) AS c FROM incidents GROUP BY category"
        ).fetchall()
        by_country = db.execute(
            "SELECT country, COUNT(*) AS c FROM incidents GROUP BY country ORDER BY c DESC LIMIT 10"
        ).fetchall()
        verified = db.execute(
            "SELECT COUNT(*) AS c FROM incidents WHERE verification_status = 'verified'"
        ).fetchone()["c"]
        pending = db.execute(
            "SELECT COUNT(*) AS c FROM incidents WHERE verification_status = 'pending'"
        ).fetchone()["c"]
    return {
        "total": total,
        "verified": verified,
        "pending_verification": pending,
        "by_severity": {row["severity"]: row["c"] for row in by_severity},
        "by_category": {row["category"]: row["c"] for row in by_category},
        "by_country": {row["country"]: row["c"] for row in by_country},
    }


def save_geocode_cache(query: str, data: dict[str, Any]) -> None:
    """Cache geocoding results."""
    now = utc_now()
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    with connect() as db:
        db.execute(
            """INSERT OR REPLACE INTO geocode_cache
            (query, latitude, longitude, formatted_address, country, state, district, city, locality,
             source, accuracy, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                query,
                data.get("latitude"),
                data.get("longitude"),
                data.get("formatted_address"),
                data.get("country"),
                data.get("state"),
                data.get("district"),
                data.get("city"),
                data.get("locality"),
                data.get("source", "nominatim"),
                data.get("accuracy", "exact"),
                expires,
                now,
            ),
        )


def get_geocode_cache(query: str) -> dict[str, Any] | None:
    """Get cached geocode result."""
    with connect() as db:
        row = db.execute(
            "SELECT * FROM geocode_cache WHERE query = ? AND expires_at > ?",
            (query, utc_now()),
        ).fetchone()
    if not row:
        return None
    return {
        "query": row["query"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "formatted_address": row["formatted_address"],
        "country": row["country"],
        "state": row["state"],
        "district": row["district"],
        "city": row["city"],
        "locality": row["locality"],
        "source": row["source"],
        "accuracy": row["accuracy"],
    }


def update_data_source_health(source: str, status: str, error: str | None = None) -> None:
    """Track external data source health."""
    now = utc_now()
    with connect() as db:
        existing = db.execute("SELECT id FROM data_source_health WHERE source = ?", (source,)).fetchone()
        if existing:
            db.execute(
                """UPDATE data_source_health SET status = ?, last_sync = ?, last_error = ?,
                request_count = request_count + 1 WHERE source = ?""",
                (status, now, error, source),
            )
        else:
            db.execute(
                """INSERT INTO data_source_health (source, status, last_sync, last_error, request_count)
                VALUES (?, ?, ?, ?, 1)""",
                (source, now, error),
            )


def get_data_source_health() -> list[dict[str, Any]]:
    """Get health status of all data sources."""
    with connect() as db:
        rows = db.execute("SELECT * FROM data_source_health ORDER BY source").fetchall()
    return [dict(row) for row in rows]


def delete_investigation(investigation_id: str) -> bool:
    with connect() as db:
        cursor = db.execute("DELETE FROM investigations WHERE id = ?", (investigation_id,))
        return cursor.rowcount > 0


def list_investigations(query: str = "", limit: int = 50) -> list[dict[str, Any]]:
    search = f"%{query.strip()}%"
    with connect() as db:
        rows = db.execute(
            """SELECT i.id, i.created_at, i.updated_at, i.location, i.fusion_json,
            COUNT(a.id) AS analysis_count,
            MAX(CASE WHEN a.modality = 'image' THEN 1 ELSE 0 END) AS has_image,
            MAX(CASE WHEN a.modality = 'audio' THEN 1 ELSE 0 END) AS has_audio
            FROM investigations i LEFT JOIN analyses a ON a.investigation_id = i.id
            WHERE i.id LIKE ? OR i.location LIKE ? OR EXISTS (
                SELECT 1 FROM analyses ax WHERE ax.investigation_id = i.id AND ax.file_name LIKE ?
            )
            GROUP BY i.id ORDER BY i.updated_at DESC LIMIT ?""",
            (search, search, search, max(1, min(limit, 100))),
        ).fetchall()
        results = []
        for row in rows:
            fusion = json.loads(row["fusion_json"]) if row["fusion_json"] else None
            results.append({
                "id": row["id"], "created_at": row["created_at"], "updated_at": row["updated_at"],
                "location": row["location"], "analysis_count": row["analysis_count"],
                "has_image": bool(row["has_image"]), "has_audio": bool(row["has_audio"]),
                "risk_level": fusion.get("risk_level", "unknown") if fusion else "unknown",
                "fusion_available": bool(fusion and fusion.get("ai_summary", {}).get("status") == "complete"),
            })
    return results


def _parse_analysis(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"], "investigation_id": row["investigation_id"], "modality": row["modality"],
        "status": row["status"], "created_at": row["created_at"], "file_name": row["file_name"],
        "mime_type": row["mime_type"], "size_bytes": row["size_bytes"],
        "result": json.loads(row["result_json"]), "error": row["error_text"],
    }


def get_investigation(investigation_id: str) -> dict[str, Any] | None:
    with connect() as db:
        row = db.execute("SELECT * FROM investigations WHERE id = ?", (investigation_id,)).fetchone()
        if not row:
            return None
        analyses = db.execute(
            "SELECT * FROM analyses WHERE investigation_id = ? ORDER BY created_at ASC, id ASC",
            (investigation_id,),
        ).fetchall()
    return {
        "id": row["id"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "location": row["location"], "notes": row["notes"],
        "fusion": json.loads(row["fusion_json"]) if row["fusion_json"] else None,
        "analyses": [_parse_analysis(item) for item in analyses],
    }
