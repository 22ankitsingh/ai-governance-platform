"""
AI Service Layer — supports Google Gemini multimodal when API key present,
otherwise uses a robust keyword-based fallback.

Issue types are now fully structured and linked to real government departments.
The AI (or fallback) ALWAYS returns a valid issue_type from the predefined list.

Logs:
  - "Using Gemini AI" when Gemini is active
  - "Using fallback classification" when falling back to keyword mode
"""
import json
import re
import random
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DEPARTMENT → ISSUE TYPES master mapping
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

# Flat set for fast validation
ALL_ISSUE_TYPES: set[str] = {it for types in DEPT_ISSUE_TYPES.values() for it in types}

# Reverse map: issue_type → department
ISSUE_TYPE_TO_DEPT: dict[str, str] = {
    it: dept
    for dept, types in DEPT_ISSUE_TYPES.items()
    for it in types
}

# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD MAPPING for fallback classifier
# ─────────────────────────────────────────────────────────────────────────────
KEYWORD_RULES: list[tuple[list[str], str]] = [
    # Municipal / Urban
    (["garbage", "trash", "waste", "litter", "dump", "rubbish", "collect", "bin"], "Garbage Accumulation"),
    (["sewer", "sewage", "drain", "blockage", "blocked", "overflow", "drainage"], "Sewer Blockage"),
    (["pothole", "road damage", "road broken", "crater", "pavement", "road condition"], "Potholes / Road Damage"),
    (["water supply", "water cut", "no water", "tap dry", "pipe burst", "water pipe", "supply disruption"], "Water Supply Issues"),
    (["street light", "streetlight", "lamp post", "light not working", "dark road", "no light"], "Streetlight Failure"),
    (["stray animal", "stray dog", "stray cattle", "animal menace", "cattle on road", "dog bite"], "Stray Animal Menace"),
    (["flood", "waterlogging", "waterlogged", "inundated", "water logging", "rain water"], "Urban Flooding / Waterlogging"),
    (["encroachment", "illegal structure", "footpath blocked", "pavement encroach", "squatter"], "Illegal Encroachments"),
    (["property tax", "house tax", "tax overpaid", "tax demand", "tax error"], "Property Tax Issues"),

    # Panchayat / Rural
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

SEVERITY_PRIORITY_MAP: dict[str, tuple[str, int, float]] = {
    # severity → (severity, priority, base_confidence)
    "critical": ("critical", 1, 0.88),
    "high":     ("high",     2, 0.82),
    "medium":   ("medium",   3, 0.75),
    "low":      ("low",      4, 0.68),
}

# Default severity bias by department
DEPT_SEVERITY: dict[str, str] = {
    "Municipal Administration & Urban Development": "high",
    "Panchayat Raj and Rural Development":          "medium",
    "Consumer Affairs, Food & Civil Supplies":      "medium",
    "Transport, Roads and Buildings":               "high",
    "Energy":                                       "high",
    "Health, Medical & Family Welfare":             "critical",
    "Environment, Forests, Science and Technology": "medium",
    "Agriculture and Co-operation":                 "medium",
}


# ─────────────────────────────────────────────────────────────────────────────
def _keyword_classify(title: str, description: str) -> dict:
    """
    Rule-based keyword classifier — FALLBACK.
    Always returns a valid issue_type from the predefined list.
    Logs "Using fallback classification".
    """
    logger.info("Using fallback classification")
    text = f"{title} {description}".lower()

    best_type: Optional[str] = None
    best_score: int = 0

    for keywords, issue_type in KEYWORD_RULES:
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_type = issue_type

    if best_type is None:
        # Absolute fallback — pick a common one
        best_type = "Garbage Accumulation"
        best_score = 0

    department = ISSUE_TYPE_TO_DEPT[best_type]
    severity_key = DEPT_SEVERITY.get(department, "medium")
    severity, priority, base_conf = SEVERITY_PRIORITY_MAP[severity_key]

    confidence = min(0.75, base_conf + (best_score * 0.03))
    if best_score == 0:
        confidence = round(random.uniform(0.30, 0.50), 2)

    if best_score > 0:
        reasoning = (
            f"Fallback classifier matched {best_score} keyword(s) for issue type "
            f"'{best_type}' under '{department}'. "
            f"Severity '{severity}' based on department risk profile."
        )
    else:
        reasoning = (
            f"No strong keyword matches found. Defaulted to '{best_type}' under '{department}'. "
            "Manual review recommended."
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


# ─────────────────────────────────────────────────────────────────────────────
async def _analyze_with_gemini(
    title: str, description: str, image_url: Optional[str] = None
) -> dict:
    """
    Use Google Gemini for multimodal analysis.
    Logs "Using Gemini AI".
    Falls back to keyword classifier on any error.
    """
    try:
        logger.info("Using Gemini AI")

        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        # Build the exact list of valid issue types for the prompt
        all_types_list = "\n".join(f"  - {t}" for t in sorted(ALL_ISSUE_TYPES))

        prompt = f"""You are an AI assistant for an Indian government civic issue management platform.
Analyze this citizen-reported issue and classify it into the predefined issue type system.

Title: {title}
Description: {description}

You MUST return one of the following issue types EXACTLY as written (case-sensitive):
{all_types_list}

Respond in JSON format with exactly these fields:
- issue_type: (must be one from the list above, copied exactly)
- department: (the government department that handles this issue type)
- predicted_severity: one of ["low", "medium", "high", "critical"]
- predicted_priority: integer 1 (highest urgency) to 5 (lowest urgency)
- confidence: float 0.0 to 1.0
- reasoning: brief 1-2 sentence explanation

Return ONLY valid JSON. No markdown, no code fences, no extra text."""

        model = genai.GenerativeModel("gemini-1.5-flash")

        if image_url:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    img_resp = await client.get(image_url)
                    if img_resp.status_code == 200:
                        import PIL.Image
                        import io
                        image = PIL.Image.open(io.BytesIO(img_resp.content))
                        response = model.generate_content([prompt, image])
                    else:
                        response = model.generate_content(prompt)
            except Exception:
                response = model.generate_content(prompt)
        else:
            response = model.generate_content(prompt)

        text = response.text.strip()
        # Strip markdown code fences if present
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)
        raw_issue_type = result.get("issue_type", "")

        # Validate: ensure returned issue_type is in our predefined list
        if raw_issue_type not in ALL_ISSUE_TYPES:
            # Try fuzzy match (case-insensitive)
            matched = next(
                (t for t in ALL_ISSUE_TYPES if t.lower() == raw_issue_type.lower()),
                None
            )
            if matched:
                result["issue_type"] = matched
            else:
                # Gemini returned something invalid — fall back
                logger.warning(
                    f"Gemini returned invalid issue_type '{raw_issue_type}'. "
                    "Falling back to keyword classifier."
                )
                fb = _keyword_classify(title, description)
                fb["model_version"] = "gemini-invalid-fallback-v1"
                fb["reasoning"] = (
                    f"Gemini returned unrecognized issue type '{raw_issue_type}'. "
                    + fb["reasoning"]
                )
                return fb

        # Ensure department is correct for the returned issue_type
        result["department"] = ISSUE_TYPE_TO_DEPT.get(
            result["issue_type"], result.get("department", "")
        )
        result["model_version"] = "gemini-1.5-flash"
        result["raw_response"] = response.text
        return result

    except Exception as e:
        logger.warning(f"Gemini API error: {str(e)[:200]}. Using fallback classification.")
        fb = _keyword_classify(title, description)
        fb["model_version"] = "gemini-error-fallback-v1"
        fb["reasoning"] = (
            f"Gemini API error ({str(e)[:80]}). " + fb["reasoning"]
        )
        return fb


# ─────────────────────────────────────────────────────────────────────────────
async def analyze_issue(
    title: str, description: str, image_url: Optional[str] = None
) -> dict:
    """
    Main entry point for AI analysis.
    - Uses Gemini if GEMINI_API_KEY is configured
    - Falls back to keyword-based classification otherwise
    - ALWAYS returns a valid issue_type from the predefined list
    - NEVER raises an exception
    """
    try:
        if settings.gemini_configured:
            return await _analyze_with_gemini(title, description, image_url)
        return _keyword_classify(title, description)
    except Exception as e:
        # Absolute safety net — should never reach here
        logger.error(f"analyze_issue failed entirely: {e}. Using hardcoded fallback.")
        return {
            "issue_type": "Garbage Accumulation",
            "department": "Municipal Administration & Urban Development",
            "predicted_severity": "medium",
            "predicted_priority": 3,
            "confidence": 0.30,
            "reasoning": "Analysis failed. Manual classification required.",
            "model_version": "emergency-fallback-v1",
            "raw_response": None,
        }


def get_all_issue_types() -> dict[str, list[str]]:
    """Return the full department → issue types mapping."""
    return DEPT_ISSUE_TYPES


def get_issue_type_department(issue_type_name: str) -> Optional[str]:
    """Look up department for a given issue type name."""
    return ISSUE_TYPE_TO_DEPT.get(issue_type_name)
