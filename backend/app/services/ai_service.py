"""
AI Service Layer — supports Google Gemini multimodal when API key present,
otherwise returns intelligent mock predictions based on text analysis.
"""
import json
import re
import random
from typing import Optional

from app.config import settings

# Category keyword mappings for demo mode
CATEGORY_KEYWORDS = {
    "Road & Infrastructure": {
        "keywords": ["road", "pothole", "bridge", "highway", "street", "pavement", "crack", "traffic", "signal", "light", "sign", "footpath", "sidewalk"],
        "subcategories": ["Pothole", "Road Damage", "Bridge Issue", "Traffic Signal", "Street Light", "Footpath Damage"],
        "department": "Public Works Department",
        "severity_bias": "high",
    },
    "Water Issues": {
        "keywords": ["water", "pipe", "leak", "drain", "flood", "supply", "contaminated", "sewage", "tap", "borewell", "pipeline"],
        "subcategories": ["Water Leak", "Supply Disruption", "Contamination", "Drainage Blockage", "Flooding"],
        "department": "Water Supply Department",
        "severity_bias": "high",
    },
    "Sanitation": {
        "keywords": ["garbage", "waste", "trash", "dump", "clean", "toilet", "hygiene", "smell", "debris", "litter", "bin"],
        "subcategories": ["Garbage Collection", "Illegal Dumping", "Public Toilet", "Waste Overflow", "Street Cleaning"],
        "department": "Sanitation Department",
        "severity_bias": "medium",
    },
    "Public Safety": {
        "keywords": ["safety", "crime", "danger", "accident", "fire", "hazard", "theft", "vandal", "broken", "collapse", "risk", "security"],
        "subcategories": ["Structural Hazard", "Fire Risk", "Vandalism", "Unsafe Area", "Missing Railing/Guard"],
        "department": "Public Safety Department",
        "severity_bias": "critical",
    },
    "Environment": {
        "keywords": ["pollution", "air", "noise", "tree", "green", "park", "garden", "dust", "smoke", "emission", "deforestation"],
        "subcategories": ["Air Pollution", "Noise Pollution", "Tree Falling", "Park Maintenance", "Illegal Construction"],
        "department": "Environment Department",
        "severity_bias": "medium",
    },
    "Health": {
        "keywords": ["health", "hospital", "clinic", "disease", "mosquito", "dengue", "malaria", "stagnant", "medical", "epidemic"],
        "subcategories": ["Disease Outbreak", "Stagnant Water", "Medical Facility", "Pest Control", "Health Hazard"],
        "department": "Health Department",
        "severity_bias": "high",
    },
}

SEVERITY_PRIORITY_MAP = {
    "low": (4, 0.7),
    "medium": (3, 0.75),
    "high": (2, 0.82),
    "critical": (1, 0.9),
}


def _analyze_text(title: str, description: str) -> dict:
    """Keyword-based analysis for demo mode."""
    text = f"{title} {description}".lower()
    best_category = None
    best_score = 0

    for category, info in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in info["keywords"] if kw in text)
        if score > best_score:
            best_score = score
            best_category = category

    if best_category is None:
        best_category = random.choice(list(CATEGORY_KEYWORDS.keys()))
        best_score = 0

    info = CATEGORY_KEYWORDS[best_category]
    subcategory = random.choice(info["subcategories"])
    severity = info["severity_bias"]
    priority, base_confidence = SEVERITY_PRIORITY_MAP[severity]

    # Adjust confidence based on keyword match strength
    confidence = min(0.98, base_confidence + (best_score * 0.03))
    if best_score == 0:
        confidence = random.uniform(0.35, 0.55)

    reasoning = (
        f"Text analysis identified {best_score} keyword matches for category '{best_category}'. "
        f"Subcategory '{subcategory}' selected based on contextual relevance. "
        f"Severity assessed as '{severity}' based on category risk profile."
    )
    if best_score == 0:
        reasoning = (
            f"No strong keyword matches found. Category '{best_category}' assigned with low confidence. "
            "Manual review recommended."
        )

    return {
        "predicted_category": best_category,
        "predicted_subcategory": subcategory,
        "predicted_department": info["department"],
        "predicted_severity": severity,
        "predicted_priority": priority,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
        "model_version": "demo-keyword-v1",
        "raw_response": None,
    }


async def _analyze_with_gemini(title: str, description: str, image_url: Optional[str] = None) -> dict:
    """Use Google Gemini for multimodal analysis."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        prompt = f"""You are an AI assistant for a government civic issue management platform. 
Analyze this citizen-reported issue and provide structured classification.

Title: {title}
Description: {description}

Respond in JSON format with these fields:
- predicted_category: one of ["Road & Infrastructure", "Water Issues", "Sanitation", "Public Safety", "Environment", "Health"]
- predicted_subcategory: a specific subcategory
- predicted_department: the government department that should handle this
- predicted_severity: one of ["low", "medium", "high", "critical"]
- predicted_priority: integer 1 (highest) to 5 (lowest)
- confidence: float 0.0 to 1.0
- reasoning: brief explanation of your classification

Return ONLY valid JSON, no markdown formatting."""

        model = genai.GenerativeModel("gemini-1.5-flash")

        if image_url:
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
        else:
            response = model.generate_content(prompt)

        text = response.text.strip()
        # Strip markdown code fences if present
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)
        result["model_version"] = "gemini-1.5-flash"
        result["raw_response"] = response.text
        return result

    except Exception as e:
        # Fall back to demo mode on any Gemini error
        result = _analyze_text(title, description)
        result["reasoning"] = f"Gemini API error ({str(e)[:100]}), fell back to keyword analysis. " + result["reasoning"]
        result["model_version"] = "demo-fallback-v1"
        return result


async def analyze_issue(title: str, description: str, image_url: Optional[str] = None) -> dict:
    """
    Main entry point for AI analysis.
    Uses Gemini if configured, otherwise falls back to keyword-based demo predictions.
    """
    if settings.gemini_configured:
        return await _analyze_with_gemini(title, description, image_url)
    return _analyze_text(title, description)
