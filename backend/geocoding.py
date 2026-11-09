from __future__ import annotations

import json
import logging
import math
import time
import urllib.parse
import urllib.request
from typing import Any

from . import database

logger = logging.getLogger("nexus.geocoding")

_LAST_NOMINATIM_REQUEST = 0.0
_MIN_NOMINATIM_INTERVAL = 1.1  # OSM Nominatim policy requires <= 1 request/sec


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in km."""
    r = 6371.0  # Earth radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Calculate compass direction from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    initial_bearing = math.atan2(y, x)
    degrees = (math.degrees(initial_bearing) + 360) % 360
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = int((degrees + 11.25) / 22.5) % 16
    return directions[idx]


def geocode_address(query: str) -> dict[str, Any] | None:
    """Geocode an address string to coordinates with caching and rate limiting."""
    clean_query = query.strip()
    if not clean_query:
        return None

    # Check database cache first
    cached = database.get_geocode_cache(clean_query.lower())
    if cached:
        return cached

    # Rate limiting for Nominatim
    global _LAST_NOMINATIM_REQUEST
    now = time.time()
    elapsed = now - _LAST_NOMINATIM_REQUEST
    if elapsed < _MIN_NOMINATIM_INTERVAL:
        time.sleep(_MIN_NOMINATIM_INTERVAL - elapsed)

    encoded = urllib.parse.quote(clean_query)
    url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&addressdetails=1&limit=1"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "NexusCrisisIntelligence/4.2 (contact: nexus-crisis-desk@nexus.local)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            _LAST_NOMINATIM_REQUEST = time.time()
            if not data:
                return None
            first = data[0]
            addr = first.get("address", {})
            result = {
                "latitude": float(first["lat"]),
                "longitude": float(first["lon"]),
                "formatted_address": first.get("display_name", clean_query),
                "country": addr.get("country"),
                "country_code": addr.get("country_code", "").upper(),
                "state": addr.get("state") or addr.get("province") or addr.get("region"),
                "district": addr.get("state_district") or addr.get("county") or addr.get("district"),
                "city": addr.get("city") or addr.get("town") or addr.get("municipality"),
                "locality": addr.get("suburb") or addr.get("neighbourhood") or addr.get("village"),
                "source": "nominatim",
                "accuracy": "exact" if first.get("type") in ("house", "building", "poi") else "approximate"
            }
            # Cache the result
            database.save_geocode_cache(clean_query.lower(), result)
            return result
    except Exception as e:
        logger.warning(f"Geocoding request for '{clean_query}' failed: {e}")
        return None


def reverse_geocode(lat: float, lon: float) -> dict[str, Any] | None:
    """Reverse geocode coordinates to structured address information."""
    cache_key = f"rev:{round(lat, 4)},{round(lon, 4)}"
    cached = database.get_geocode_cache(cache_key)
    if cached:
        return cached

    global _LAST_NOMINATIM_REQUEST
    now = time.time()
    elapsed = now - _LAST_NOMINATIM_REQUEST
    if elapsed < _MIN_NOMINATIM_INTERVAL:
        time.sleep(_MIN_NOMINATIM_INTERVAL - elapsed)

    url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "NexusCrisisIntelligence/4.2 (contact: nexus-crisis-desk@nexus.local)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            first = json.loads(resp.read().decode("utf-8"))
            _LAST_NOMINATIM_REQUEST = time.time()
            if not first or "address" not in first:
                return None
            addr = first.get("address", {})
            result = {
                "latitude": float(first.get("lat", lat)),
                "longitude": float(first.get("lon", lon)),
                "formatted_address": first.get("display_name", f"{lat}, {lon}"),
                "country": addr.get("country"),
                "country_code": addr.get("country_code", "").upper(),
                "state": addr.get("state") or addr.get("province") or addr.get("region"),
                "district": addr.get("state_district") or addr.get("county") or addr.get("district"),
                "city": addr.get("city") or addr.get("town") or addr.get("municipality"),
                "locality": addr.get("suburb") or addr.get("neighbourhood") or addr.get("village"),
                "source": "nominatim",
                "accuracy": "exact"
            }
            database.save_geocode_cache(cache_key, result)
            return result
    except Exception as e:
        logger.warning(f"Reverse geocode for ({lat}, {lon}) failed: {e}")
        return None
