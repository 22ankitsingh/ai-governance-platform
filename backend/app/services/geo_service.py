"""
Geolocation Service — Reverse geocoder using OpenStreetMap Nominatim.

No API key required. Rate-limited to 1 req/sec by OSM policy.
Returns address string and area_type ("urban" / "rural" / "unknown").

Logs:
  - "Geolocation success: {city}, {state} | {area_type}"
  - "Geolocation failure: {reason}"
"""
import logging
import asyncio
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {
    "User-Agent": "AI-Governance-Platform/1.0 (civic-issue-tracker)",
    "Accept-Language": "en",
}

# Nominatim place types → area classification
_URBAN_TYPES = {
    "city", "town", "borough", "suburb", "quarter",
    "neighbourhood", "city_district", "district",
}
_RURAL_TYPES = {
    "village", "hamlet", "isolated_dwelling", "farm",
    "allotments", "municipality",
}


def _classify_area(nominatim_response: dict) -> str:
    """
    Classify area as urban or rural based on Nominatim response.
    Uses addresstype, place_rank, and address components.
    """
    place_type = nominatim_response.get("addresstype", "").lower()
    place_rank = nominatim_response.get("place_rank", 0)

    if place_type in _URBAN_TYPES:
        return "urban"
    if place_type in _RURAL_TYPES:
        return "rural"

    # Fallback: check address components
    addr = nominatim_response.get("address", {})
    if addr.get("city") or addr.get("town"):
        return "urban"
    if addr.get("village") or addr.get("hamlet"):
        return "rural"

    # place_rank: lower = larger/more urban (city=16, town=17, village=19+)
    if isinstance(place_rank, int):
        if place_rank <= 17:
            return "urban"
        elif place_rank >= 19:
            return "rural"

    return "unknown"


def _build_address(addr: dict) -> str:
    """Build a clean human-readable address from Nominatim address components."""
    parts = []

    # Road/area
    if addr.get("road"):
        parts.append(addr["road"])
    elif addr.get("pedestrian"):
        parts.append(addr["pedestrian"])

    # Neighbourhood / suburb
    for key in ("neighbourhood", "suburb", "quarter", "city_district"):
        if addr.get(key):
            parts.append(addr[key])
            break

    # City / town / village
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("hamlet")
        or addr.get("county")
    )
    if city:
        parts.append(city)

    # State
    if addr.get("state"):
        parts.append(addr["state"])

    # Country (skip if India — obvious)
    if addr.get("country") and addr.get("country_code", "").lower() != "in":
        parts.append(addr["country"])

    return ", ".join(parts) if parts else "Unknown"


async def reverse_geocode(
    latitude: float, longitude: float
) -> dict:
    """
    Reverse geocode coordinates to address + area_type.

    Returns:
        {
            "address": "MG Road, Connaught Place, New Delhi, Delhi",
            "city": "New Delhi",
            "state": "Delhi",
            "area_type": "urban"   # or "rural" or "unknown"
        }

    Never raises — always returns a dict (with fallback values on error).
    """
    result = {
        "address": "Unknown",
        "city": "",
        "state": "",
        "area_type": "unknown",
    }

    if latitude is None or longitude is None:
        logger.info("Geolocation skipped: no coordinates provided")
        return result

    try:
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 16,
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                NOMINATIM_URL,
                params=params,
                headers=NOMINATIM_HEADERS,
            )
            response.raise_for_status()
            data = response.json()

        addr = data.get("address", {})
        area_type = _classify_area(data)
        address = _build_address(addr)

        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("hamlet")
            or addr.get("county")
            or ""
        )
        state = addr.get("state", "")

        result["address"] = address
        result["city"] = city
        result["state"] = state
        result["area_type"] = area_type

        logger.info(f"Geolocation success: {city}, {state} | {area_type}")
        return result

    except httpx.TimeoutException:
        logger.warning("Geolocation failure: request timed out")
        return result
    except httpx.HTTPStatusError as e:
        logger.warning(f"Geolocation failure: HTTP {e.response.status_code}")
        return result
    except Exception as e:
        logger.warning(f"Geolocation failure: {str(e)[:120]}")
        return result
