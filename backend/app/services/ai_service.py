"""
AI Classification Service — Google Gemini 2.5 Flash multimodal pipeline.

PRIMARY: Gemini generates DYNAMIC, context-aware issue_type strings.
  - No restriction to predefined list
  - Considers text + image + location + area_type
  - Examples: "Transformer Explosion Risk", "Illegal Construction on Drainage"

FALLBACK: Keyword-based rules using the 59 predefined issue types.
  - Activates when: no API key / Gemini error / invalid response

DEPARTMENT: Always assigned from 8 predefined government departments.
  - Gemini suggests → validated against known dept list
  - If invalid → inferred from issue_type keywords
  - Never None after analysis

Logs:
  - "Using Gemini AI"
  - "Dynamic issue_type generated: {type}"
  - "Using fallback classification"
  - "Geolocation success/failure" (in geo_service)
"""
import os
import json
import re
import base64
import random
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# KNOWN DEPARTMENTS (8 real government departments)
# ─────────────────────────────────────────────────────────────────────────────
KNOWN_DEPARTMENTS = [
    "Municipal Administration & Urban Development",
    "Panchayat Raj and Rural Development",
    "Consumer Affairs, Food & Civil Supplies",
    "Transport, Roads and Buildings",
    "Energy",
    "Health, Medical & Family Welfare",
    "Environment, Forests, Science and Technology",
    "Agriculture and Co-operation",
]

# Lowercase lookup set
_DEPT_LOWER = {d.lower(): d for d in KNOWN_DEPARTMENTS}


# ─────────────────────────────────────────────────────────────────────────────
# PREDEFINED ISSUE TYPES — used for FALLBACK only
# ─────────────────────────────────────────────────────────────────────────────
DEPT_ISSUE_TYPES: dict[str, list[str]] = {
    "Municipal Administration & Urban Development": [
        "Garbage Accumulation",
        "Sewer Blockage",
        "Potholes / Road Damage",
        "Water Supply Issues",
        "Streetlight Failure",
        "Stray Animal Menace",
        "Urban Flooding / Waterlogging",
        "Illegal Encroachments",
        "Property Tax Issues",
    ],
    "Panchayat Raj and Rural Development": [
        "Open Defecation / Lack of Toilets",
        "Stagnant Drain Water",
        "Mud Roads / Village Roads",
        "Handpump / Water Tank Failure",
        "Wage Payment Delays",
        "Village Streetlight Failure",
        "Public Infrastructure Maintenance",
        "Panchayat Fund Misuse",
    ],
    "Consumer Affairs, Food & Civil Supplies": [
        "Ration Shop Closed",
        "Underweight Ration Supply",
        "Ration Card Delay",
        "MRP Overcharging",
        "Adulterated / Expired Products",
        "Illegal Service Charges",
        "LPG Delivery Bribes",
        "Market Fraud (Weights/Scales)",
    ],
    "Transport, Roads and Buildings": [
        "Highway Safety Issues",
        "Bus Service Issues",
        "Driver Misconduct",
        "Auto/Cab Refusal / Meter Fraud",
        "RTO Corruption",
        "Vehicle Pollution",
        "Unsafe Government Buildings",
    ],
    "Energy": [
        "Power Outages",
        "Voltage Fluctuation",
        "Electrical Hazards",
        "Fallen Power Lines",
        "Billing Issues",
        "New Connection Delays",
        "Agricultural Power Issues",
    ],
    "Health, Medical & Family Welfare": [
        "Doctor Absenteeism",
        "Medicine Shortage",
        "Hospital Hygiene Issues",
        "Hospital Corruption",
        "Ambulance Delays",
        "Emergency Denial",
        "Illegal Clinics",
    ],
    "Environment, Forests, Science and Technology": [
        "Water Pollution",
        "Air Pollution",
        "Noise Pollution",
        "Illegal Tree Cutting",
        "Wildlife Intrusion",
        "Biomedical Waste Dumping",
        "Illegal Mining",
    ],
    "Agriculture and Co-operation": [
        "Fake Seeds",
        "Fertilizer Black Marketing",
        "Pest Attacks",
        "Soil Testing Issues",
        "Storage Problems",
        "Cooperative Fraud",
    ],
}

# Reverse map: predefined issue_type → department
_PREDEFINED_TYPE_TO_DEPT: dict[str, str] = {
    it: dept for dept, types in DEPT_ISSUE_TYPES.items() for it in types
}


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD RULES — for fallback classification
# ─────────────────────────────────────────────────────────────────────────────
KEYWORD_RULES: list[tuple[list[str], str]] = [
    # Municipal
    (["garbage", "trash", "waste", "litter", "dump", "rubbish", "collect", "bin"], "Garbage Accumulation"),
    (["sewer", "sewage", "drain", "blockage", "blocked", "overflow", "drainage"], "Sewer Blockage"),
    (["pothole", "road damage", "road broken", "crater", "pavement", "road condition"], "Potholes / Road Damage"),
    (["water supply", "water cut", "no water", "tap dry", "pipe burst", "water pipe", "supply disruption"], "Water Supply Issues"),
    (["street light", "streetlight", "lamp post", "light not working", "dark road", "no light"], "Streetlight Failure"),
    (["stray animal", "stray dog", "stray cattle", "animal menace", "cattle on road", "dog bite"], "Stray Animal Menace"),
    (["flood", "waterlogging", "waterlogged", "inundated", "water logging", "rain water"], "Urban Flooding / Waterlogging"),
    (["encroachment", "illegal structure", "footpath blocked", "pavement encroach", "squatter"], "Illegal Encroachments"),
    (["property tax", "house tax", "tax overpaid", "tax demand", "tax error"], "Property Tax Issues"),
    # Panchayat
    (["open defecation", "no toilet", "toilet missing", "sanitation rural", "defecate openly"], "Open Defecation / Lack of Toilets"),
    (["stagnant water", "standing water", "stagnant drain", "waterlogged drain"], "Stagnant Drain Water"),
    (["mud road", "village road", "kachcha road", "unpaved road", "rural road damage"], "Mud Roads / Village Roads"),
    (["handpump", "hand pump", "water tank failure", "borewell broken", "pump not working"], "Handpump / Water Tank Failure"),
    (["wage delay", "mgnrega", "wages not paid", "payment delay", "wages pending"], "Wage Payment Delays"),
    (["village light", "village street light", "gram panchayat light", "rural street light"], "Village Streetlight Failure"),
    (["panchayat infrastructure", "community hall", "panchayat building", "public building rural"], "Public Infrastructure Maintenance"),
    (["panchayat fund", "panchayat corruption", "gram fund misuse", "panchayat money"], "Panchayat Fund Misuse"),
    # Consumer Affairs
    (["ration shop", "ration center", "fair price shop", "fps closed", "ration shop closed"], "Ration Shop Closed"),
    (["underweight", "short ration", "less ration", "ration quantity", "ration weight"], "Underweight Ration Supply"),
    (["ration card", "ration card delay", "ration card not received", "new ration card"], "Ration Card Delay"),
    (["mrp", "overcharging", "price more than mrp", "over price", "excess charge"], "MRP Overcharging"),
    (["adulterated", "expired product", "bad food", "rotten", "food quality", "contaminated food"], "Adulterated / Expired Products"),
    (["illegal service charge", "extra fee", "unauthorized charge", "service fee"], "Illegal Service Charges"),
    (["lpg", "gas cylinder", "gas bribe", "cylinder delivery", "gas agent bribe"], "LPG Delivery Bribes"),
    (["weight fraud", "scale tamper", "weighing machine", "market fraud", "weights"], "Market Fraud (Weights/Scales)"),
    # Transport
    (["highway", "national highway", "highway accident", "road safety highway"], "Highway Safety Issues"),
    (["bus service", "state bus", "rtc", "bus not running", "bus route"], "Bus Service Issues"),
    (["driver misconduct", "rash driving", "driver misbehavior", "conductor misbehave"], "Driver Misconduct"),
    (["auto refusal", "cab refusal", "meter fraud", "auto meter", "uber fraud", "ola fraud"], "Auto/Cab Refusal / Meter Fraud"),
    (["rto", "rto corruption", "rto bribe", "vehicle registration corruption"], "RTO Corruption"),
    (["vehicle pollution", "vehicular emission", "smoke from vehicle", "emission test"], "Vehicle Pollution"),
    (["unsafe building", "government building", "crumbling building", "structural unsafe", "office building"], "Unsafe Government Buildings"),
    # Energy
    (["power cut", "power outage", "no electricity", "load shedding", "blackout", "no power"], "Power Outages"),
    (["voltage fluctuation", "low voltage", "voltage dip", "high voltage", "voltage problem"], "Voltage Fluctuation"),
    (["electrical hazard", "live wire exposed", "electric shock risk", "open wire", "dangerous wiring"], "Electrical Hazards"),
    (["fallen pole", "fallen wire", "power line fallen", "pole collapsed", "electric pole down"], "Fallen Power Lines"),
    (["electricity bill", "power bill", "inflated bill", "wrong bill", "billing error"], "Billing Issues"),
    (["new connection", "power connection delay", "electricity connection", "connection pending"], "New Connection Delays"),
    (["agricultural power", "farm power", "irrigation pump power", "kisan power", "tube well power"], "Agricultural Power Issues"),
    # Health
    (["doctor absent", "doctor not present", "doctor missing", "doctor absenteeism", "no doctor"], "Doctor Absenteeism"),
    (["medicine shortage", "no medicine", "medicine not available", "drug shortage", "pharmacy empty"], "Medicine Shortage"),
    (["hospital dirty", "hospital hygiene", "unclean hospital", "hospital sanitation", "filthy hospital"], "Hospital Hygiene Issues"),
    (["hospital bribe", "hospital corruption", "medical bribe", "doctor corruption", "staff bribe"], "Hospital Corruption"),
    (["ambulance delay", "ambulance not coming", "ambulance late", "108 not responding"], "Ambulance Delays"),
    (["emergency denied", "denied treatment", "refused treatment", "turned away hospital", "emergency rejection"], "Emergency Denial"),
    (["illegal clinic", "quack", "unlicensed doctor", "unauthorized clinic", "fake doctor"], "Illegal Clinics"),
    # Environment
    (["water pollution", "river polluted", "lake polluted", "water contamination", "polluted water body"], "Water Pollution"),
    (["air pollution", "smoke pollution", "factory smoke", "air quality", "smog", "pollution"], "Air Pollution"),
    (["noise pollution", "loud music", "noise complaint", "construction noise", "horn noise"], "Noise Pollution"),
    (["tree cutting", "illegal logging", "deforestation", "tree felled", "tree fallen illegally"], "Illegal Tree Cutting"),
    (["wildlife", "animal intrusion", "leopard", "snake", "wild animal", "forest animal"], "Wildlife Intrusion"),
    (["biomedical waste", "hospital waste", "medical waste", "biohazard waste", "clinical waste"], "Biomedical Waste Dumping"),
    (["illegal mining", "sand mining", "quarry illegal", "mining without permit", "stone quarry"], "Illegal Mining"),
    # Agriculture
    (["fake seeds", "bad seeds", "counterfeit seeds", "seed quality", "spurious seeds"], "Fake Seeds"),
    (["fertilizer black market", "urea black market", "fertilizer shortage", "fertilizer hoarding"], "Fertilizer Black Marketing"),
    (["pest attack", "crop pest", "locust", "insect attack", "crop damage pest"], "Pest Attacks"),
    (["soil testing", "soil test", "soil quality", "soil analysis"], "Soil Testing Issues"),
    (["storage problem", "warehouse", "cold storage", "grain storage", "godown problem"], "Storage Problems"),
    (["cooperative fraud", "farmer cooperative", "co-op fraud", "cooperative misuse"], "Cooperative Fraud"),
]

# Default severity bias by department
_DEPT_SEVERITY: dict[str, str] = {
    "Municipal Administration & Urban Development": "high",
    "Panchayat Raj and Rural Development":          "medium",
    "Consumer Affairs, Food & Civil Supplies":      "medium",
    "Transport, Roads and Buildings":               "high",
    "Energy":                                       "high",
    "Health, Medical & Family Welfare":             "critical",
    "Environment, Forests, Science and Technology": "medium",
    "Agriculture and Co-operation":                 "medium",
}

_SEVERITY_PRIORITY_MAP = {
    "critical": ("critical", 1, 0.88),
    "high":     ("high",     2, 0.82),
    "medium":   ("medium",   3, 0.75),
    "low":      ("low",      4, 0.68),
}


# ─────────────────────────────────────────────────────────────────────────────
# Department inference helpers
# ─────────────────────────────────────────────────────────────────────────────
def _validate_department(dept_str: Optional[str]) -> Optional[str]:
    """Return the canonical department name if dept_str matches, else None."""
    if not dept_str:
        return None
    # Exact match
    if dept_str in KNOWN_DEPARTMENTS:
        return dept_str
    # Case-insensitive match
    lower = dept_str.strip().lower()
    if lower in _DEPT_LOWER:
        return _DEPT_LOWER[lower]
    # Partial match
    for canonical in KNOWN_DEPARTMENTS:
        if lower in canonical.lower() or canonical.lower() in lower:
            return canonical
    return None


def _infer_department_from_text(text: str, area_type: str = "unknown") -> str:
    """
    Infer department from free-form issue_type or description text.
    Uses keyword matching against department-typical terms.
    Falls back to area_type heuristic.
    """
    text_lower = text.lower()

    # Keyword → department mapping
    department_keywords: list[tuple[list[str], str]] = [
        (["garbage", "sewer", "drain", "water supply", "streetlight", "pothole", "road", "flood", "encroach", "stray", "urban", "municipal", "property tax"], "Municipal Administration & Urban Development"),
        (["village", "panchayat", "rural", "handpump", "mgnrega", "wage", "gram", "kachcha"], "Panchayat Raj and Rural Development"),
        (["ration", "lpg", "gas", "food", "mrp", "consumer", "adulterated", "expired", "scale", "weight"], "Consumer Affairs, Food & Civil Supplies"),
        (["bus", "highway", "rto", "auto", "cab", "taxi", "driver", "conductor", "transport", "vehicle pollution", "emission"], "Transport, Roads and Buildings"),
        (["electricity", "power", "voltage", "transformer", "wire", "electric", "energy", "billing", "connection"], "Energy"),
        (["hospital", "doctor", "medicine", "ambulance", "health", "clinic", "medical", "emergency", "nurse"], "Health, Medical & Family Welfare"),
        (["pollution", "environment", "tree", "wildlife", "mining", "biomedical", "waste", "smoke", "air quality", "noise"], "Environment, Forests, Science and Technology"),
        (["farm", "crop", "seed", "fertilizer", "agriculture", "pest", "soil", "cooperative", "kisan", "storage", "godown"], "Agriculture and Co-operation"),
    ]

    best_dept = None
    best_score = 0
    for keywords, dept in department_keywords:
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_dept = dept

    if best_dept:
        return best_dept

    # Area-type heuristic
    if area_type == "rural":
        return "Panchayat Raj and Rural Development"
    return "Municipal Administration & Urban Development"


# ─────────────────────────────────────────────────────────────────────────────
# FALLBACK: Keyword-based classifier
# ─────────────────────────────────────────────────────────────────────────────
def _keyword_classify(
    title: str, description: str, area_type: str = "unknown"
) -> dict:
    """
    Rule-based keyword fallback. Always returns a valid predefined issue_type.
    Logs: "Using fallback classification"
    """
    logger.info("Using fallback classification")
    text = f"{title} {description}".lower()

    best_type: Optional[str] = None
    best_score = 0
    for keywords, issue_type in KEYWORD_RULES:
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_type = issue_type

    if best_type is None:
        if area_type == "rural":
            best_type = "Mud Roads / Village Roads"
        else:
            best_type = "Garbage Accumulation"
        best_score = 0

    department = _predefined_type_to_dept(best_type)
    severity_key = _DEPT_SEVERITY.get(department, "medium")
    severity, priority, base_conf = _SEVERITY_PRIORITY_MAP[severity_key]

    confidence = min(0.70, base_conf + (best_score * 0.03))
    if best_score == 0:
        confidence = round(random.uniform(0.28, 0.45), 2)

    reasoning = (
        f"Fallback classifier matched {best_score} keyword(s) → '{best_type}' under '{department}'. "
        f"Severity '{severity}' based on department risk profile."
        if best_score > 0 else
        f"No keyword matches. Defaulted to '{best_type}' under '{department}'. Manual review recommended."
    )

    return {
        "issue_type": best_type,
        "department": department,
        "predicted_severity": severity,
        "predicted_priority": priority,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
        "model_version": "fallback-keyword-v2",
        "raw_response": None,
    }


def _predefined_type_to_dept(issue_type_name: str) -> str:
    return _PREDEFINED_TYPE_TO_DEPT.get(issue_type_name, "Municipal Administration & Urban Development")


# ─────────────────────────────────────────────────────────────────────────────
# GEMINI: Multimodal dynamic classifier
# ─────────────────────────────────────────────────────────────────────────────
def _build_gemini_prompt(
    title: str,
    description: str,
    address: str = "",
    area_type: str = "unknown",
    has_image: bool = False,
) -> str:
    """Build the structured Gemini prompt with full context."""
    location_context = ""
    if address and address != "Unknown":
        location_context = f"\nLocation: {address}"
    if area_type and area_type != "unknown":
        location_context += f"\nArea Type: {area_type} area"

    image_note = "\n[An image of the issue has been provided. Analyze it carefully to refine severity and issue_type.]" if has_image else ""

    dept_list = "\n".join(f"  - {d}" for d in KNOWN_DEPARTMENTS)

    return f"""You are an expert AI system for an Indian government civic issue management platform.
Analyze the citizen-reported issue below and provide a comprehensive classification.{image_note}

CITIZEN REPORT:
Title: {title}
Description: {description}{location_context}

YOUR TASK:
1. Generate a DYNAMIC, context-aware issue_type — do NOT restrict to any predefined list.
   The issue_type should be:
   - Concise (3-6 words)
   - Human-readable and specific
   - Descriptive of the actual problem
   Examples of good issue_types:
     "Transformer Explosion Risk"
     "Illegal Construction on Drainage"
     "Severe Urban Garbage Overflow"
     "Hospital Emergency Denial"
     "Contaminated Water Supply Pipe"
     "Fallen Electric Pole on Road"

2. Assign the correct government DEPARTMENT from ONLY this list:
{dept_list}

   Department selection rules:
   - If location is rural → prefer "Panchayat Raj and Rural Development"
   - If location is urban → prefer "Municipal Administration & Urban Development"
   - Always pick the most relevant department based on the actual problem

3. Assess severity and priority considering:
   - Visual severity from image (if provided)
   - Public safety risk
   - Number of people affected
   - Urgency of the problem

Respond with ONLY a valid JSON object (no markdown, no code fences):
{{
  "issue_type": "your specific issue type here",
  "department": "exact department name from the list above",
  "severity": "low|medium|high|critical",
  "priority": 1,
  "confidence": 0.85,
  "reasoning": "Brief 2-sentence explanation of classification and severity"
}}"""


async def _analyze_with_gemini(
    title: str,
    description: str,
    image_bytes: Optional[bytes] = None,
    image_mime: str = "image/jpeg",
    address: str = "",
    area_type: str = "unknown",
) -> dict:
    """
    Gemini 2.5 Flash multimodal classification.
    Logs: "Using Gemini AI", "Dynamic issue_type generated: {type}"
    Falls back to keyword classifier on any error.
    """
    try:
        logger.info("Using Gemini AI")
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        prompt = _build_gemini_prompt(
            title, description, address, area_type, has_image=bool(image_bytes)
        )

        # Build content parts
        content_parts: list = [prompt]

        if image_bytes:
            try:
                import PIL.Image
                import io
                img = PIL.Image.open(io.BytesIO(image_bytes))
                # Resize large images to save tokens (max 1024px on longest side)
                max_side = 1024
                if max(img.size) > max_side:
                    ratio = max_side / max(img.size)
                    new_size = (int(img.width * ratio), int(img.height * ratio))
                    img = img.resize(new_size, PIL.Image.LANCZOS)
                # Convert to RGB if needed (handles RGBA/palette PNGs)
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85)
                content_parts.append({
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(buf.getvalue()).decode(),
                })
                logger.debug(f"Image added to Gemini prompt ({buf.tell()} bytes JPEG)")
            except Exception as img_err:
                logger.warning(f"Image processing for Gemini failed: {img_err}. Proceeding text-only.")

        # Try Gemini 2.5 Flash first, fall back to 2.0 Flash
        model_names = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        response = None
        used_model = None

        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                # Build proper content list for multimodal
                if len(content_parts) > 1:
                    # Multimodal: text + image
                    parts = [
                        {"text": content_parts[0]},
                        {"inline_data": content_parts[1]},
                    ]
                    response = model.generate_content(parts)
                else:
                    response = model.generate_content(content_parts[0])
                used_model = model_name
                logger.debug(f"Gemini model used: {model_name}")
                break
            except Exception as model_err:
                err_str = str(model_err).lower()
                if any(x in err_str for x in ["not found", "404", "not supported", "does not exist", "invalid", "resource"]):
                    logger.warning(f"Model {model_name} not available, trying next...")
                    continue
                raise model_err

        if response is None:
            raise RuntimeError("All Gemini models failed")

        # Parse response text
        raw_text = response.text.strip()
        # Strip code fences if present
        clean = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
        clean = re.sub(r"\s*```\s*$", "", clean, flags=re.MULTILINE)
        clean = clean.strip()

        result = json.loads(clean)

        # Extract and validate fields
        issue_type = str(result.get("issue_type", "")).strip()
        department_raw = result.get("department", "")
        severity = result.get("severity", "medium").lower()
        priority = int(result.get("priority", 3))
        confidence = float(result.get("confidence", 0.75))
        reasoning = str(result.get("reasoning", ""))

        # Validate issue_type
        if not issue_type or len(issue_type) < 3:
            raise ValueError(f"Gemini returned empty/invalid issue_type: {issue_type!r}")

        # Validate/infer department
        department = _validate_department(department_raw)
        if not department:
            department = _infer_department_from_text(
                f"{issue_type} {title} {description}", area_type
            )
            logger.info(f"Department inferred from text: {department} (Gemini returned: {department_raw!r})")

        # Validate severity
        if severity not in ("low", "medium", "high", "critical"):
            severity = "medium"

        # Clamp priority
        priority = max(1, min(5, priority))
        # Clamp confidence
        confidence = max(0.0, min(1.0, confidence))

        logger.info(f"Dynamic issue_type generated: {issue_type}")

        return {
            "issue_type": issue_type,
            "department": department,
            "predicted_severity": severity,
            "predicted_priority": priority,
            "confidence": round(confidence, 2),
            "reasoning": reasoning,
            "model_version": used_model,
            "raw_response": raw_text[:2000],  # truncate for DB storage
        }

    except json.JSONDecodeError as e:
        logger.warning(f"Gemini JSON parse error: {e}. Raw: {raw_text[:200] if 'raw_text' in dir() else 'N/A'}. Using fallback.")
        fb = _keyword_classify(title, description, area_type)
        fb["model_version"] = f"gemini-json-error-fallback ({used_model or 'unknown'})"
        return fb

    except Exception as e:
        logger.warning(f"Gemini API error: {str(e)[:200]}. Using fallback classification.")
        fb = _keyword_classify(title, description, area_type)
        fb["model_version"] = f"gemini-error-fallback"
        fb["reasoning"] = f"Gemini error ({str(e)[:80]}). " + fb["reasoning"]
        return fb


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────
async def analyze_issue(
    title: str,
    description: str,
    image_url: Optional[str] = None,
    address: str = "",
    area_type: str = "unknown",
) -> dict:
    """
    Main entry point for AI issue classification.

    Flow:
    1. If GEMINI_API_KEY configured:
       a. Read image bytes from image_url (local or remote) if provided
       b. Call Gemini 2.5 Flash with text + image + location context
       c. Returns DYNAMIC issue_type string (freely generated)
    2. Else: keyword-based fallback with PREDEFINED issue types

    NEVER raises. Always returns a complete classification dict.

    Returns:
        {
            "issue_type": str,          # dynamic or predefined
            "department": str,          # one of 8 known departments
            "predicted_severity": str,  # low/medium/high/critical
            "predicted_priority": int,  # 1-5
            "confidence": float,        # 0.0-1.0
            "reasoning": str,
            "model_version": str,
            "raw_response": Optional[str],
        }
    """
    try:
        if settings.gemini_configured:
            # Read image bytes for multimodal (if image provided)
            image_bytes: Optional[bytes] = None
            if image_url:
                try:
                    from app.services.upload_service import read_image_bytes
                    image_bytes = await read_image_bytes(image_url)
                except Exception as img_err:
                    logger.warning(f"Failed to read image for Gemini: {img_err}")

            return await _analyze_with_gemini(
                title=title,
                description=description,
                image_bytes=image_bytes,
                address=address,
                area_type=area_type,
            )

        return _keyword_classify(title, description, area_type)

    except Exception as e:
        # Absolute safety net
        logger.error(f"analyze_issue critical failure: {e}. Using emergency fallback.")
        return {
            "issue_type": "Civic Infrastructure Issue",
            "department": "Municipal Administration & Urban Development",
            "predicted_severity": "medium",
            "predicted_priority": 3,
            "confidence": 0.20,
            "reasoning": "Emergency fallback: classification service encountered an unexpected error. Manual review required.",
            "model_version": "emergency-fallback-v1",
            "raw_response": None,
        }


def get_all_issue_types() -> dict[str, list[str]]:
    """Return the full department → predefined issue types mapping (for reference/seed)."""
    return DEPT_ISSUE_TYPES


def get_department_for_issue_type(issue_type_name: str) -> Optional[str]:
    """Look up department for a predefined issue type name."""
    return _PREDEFINED_TYPE_TO_DEPT.get(issue_type_name)


def infer_department(text: str, area_type: str = "unknown") -> str:
    """Public helper — infer department from free-form text."""
    return _infer_department_from_text(text, area_type)
