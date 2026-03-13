"""
Prahar AI — ML Pipeline FastAPI Microservice (T-08)

Endpoints:
  POST /classify     — Intent classification + entity extraction
  POST /recommend    — Ranked scheme recommendations
  POST /eligibility  — Eligibility score for a user-scheme pair
  POST /chat         — Conversational chatbot (ReAct agent)
  GET  /health       — Service status

Run:  uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import logging
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Add src to path for local imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def _load_shared_env() -> None:
    """Load a single shared .env from repository root when present."""
    current = Path(__file__).resolve()
    candidates = [
        Path.cwd() / ".env",
        current.parent / ".env",
        current.parent.parent / ".env",
    ]

    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate, override=False)
            logging.getLogger(__name__).info("Loaded environment from %s", candidate)
            return


_load_shared_env()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Models ──────────────────────────────────────────────────────────────────


class ClassifyRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ClassifyResponse(BaseModel):
    primary_intent: str
    confidence: float
    entities: Dict[str, Any]
    secondary_intents: List[str] = []


class RecommendRequest(BaseModel):
    user_profile: Dict[str, Any]
    schemes: Optional[List[Dict[str, Any]]] = None
    max_results: int = 10
    min_score: float = 0.3


class RecommendResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    total: int
    cached: bool = False


class EligibilityRequest(BaseModel):
    user_profile: Dict[str, Any]
    scheme: Dict[str, Any]


class EligibilityResponse(BaseModel):
    scheme_id: str
    score: float
    percentage: int
    category: str  # highly_eligible | potentially_eligible | low_eligibility
    met_criteria: List[str]
    unmet_criteria: List[str]
    explanation: str


class ChatRequest(BaseModel):
    message: str
    user_profile: Dict[str, Any] = {}
    conversation_history: Optional[List[Dict[str, str]]] = None


class ChatResponse(BaseModel):
    response: str
    suggestions: List[str] = []
    extracted_entities: Dict[str, Any] = {}


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Prahar AI — ML Service",
    description="Intent classification, scheme recommendation, and eligibility scoring",
    version="1.0.0",
)

cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
allow_origins = ["*"]
if cors_origins_raw.strip() != "*":
    parsed = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
    allow_origins = parsed if parsed else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Eager-load models on startup ─────────────────────────────────────────────


@app.on_event("startup")
def load_models():
    """Load all ML models at startup so /health reports true immediately."""
    logger.info("Loading ML models...")
    get_intent_classifier()
    get_eligibility_engine()
    get_recommendation_engine()
    logger.info("ML models loaded")


_intent_classifier = None
_eligibility_engine = None
_recommendation_engine = None


def _resolve_recommendation_model_path() -> Optional[str]:
    """Resolve active recommendation model path from env or local pointer."""
    env_path = os.getenv("RECOMMENDER_MODEL_PATH", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

    pointer = Path(__file__).resolve().parent / "models" / "recommendation_active_model.json"
    if pointer.exists():
        try:
            payload = json.loads(pointer.read_text(encoding="utf-8"))
            active_path = str(payload.get("active_path", "")).strip()
            if active_path and Path(active_path).exists():
                return active_path
        except Exception as e:
            logger.warning("Failed reading recommendation model pointer: %s", e)

    fallback = (
        Path(__file__).resolve().parent / "models" / "recommendation_active" / "xgb_ranker.model"
    )
    if fallback.exists():
        return str(fallback)

    return None


def get_intent_classifier():
    global _intent_classifier
    if _intent_classifier is None:
        try:
            from intent_classifier import IntentClassifier

            _intent_classifier = IntentClassifier(use_onnx=False)
            logger.info("IntentClassifier loaded")
        except Exception as e:
            logger.warning(f"IntentClassifier not available: {e}")
    return _intent_classifier


def get_eligibility_engine():
    global _eligibility_engine
    if _eligibility_engine is None:
        try:
            from eligibility_engine import EligibilityEngine

            _eligibility_engine = EligibilityEngine()
            logger.info("EligibilityEngine loaded")
        except Exception as e:
            logger.warning(f"EligibilityEngine not available: {e}")
    return _eligibility_engine


def get_recommendation_engine():
    global _recommendation_engine
    if _recommendation_engine is None:
        try:
            from user_classifier import UserClassifier
            from eligibility_engine import EligibilityEngine
            from recommendation_engine import RecommendationEngine

            model_path = _resolve_recommendation_model_path()
            _recommendation_engine = RecommendationEngine(
                UserClassifier(), EligibilityEngine(), model_path=model_path
            )
            if model_path:
                logger.info("RecommendationEngine loaded with model: %s", model_path)
            else:
                logger.info("RecommendationEngine loaded without external LTR model")
        except Exception as e:
            logger.warning(f"RecommendationEngine not available: {e}")
    return _recommendation_engine


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    """Service health and model availability check."""
    return {
        "status": "ok",
        "models": {
            "intent_classifier": _intent_classifier is not None,
            "eligibility_engine": _eligibility_engine is not None,
            "recommendation_engine": _recommendation_engine is not None,
        },
        "version": "1.0.0",
    }


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    """
    Classify user message intent and extract entities.
    Falls back to rule-based classification if ML model unavailable.
    """
    try:
        classifier = get_intent_classifier()
        if classifier:
            result = classifier.classify(req.message)
            return ClassifyResponse(
                primary_intent=result.primary_intent.value,
                confidence=getattr(result, "confidence", 0.8),
                entities={e.type: e.value for e in getattr(result, "entities", [])},
                secondary_intents=[i.value for i in getattr(result, "secondary_intents", [])],
            )
    except Exception as e:
        logger.warning(f"ML classify failed, using rule-based fallback: {e}")

    # Rule-based fallback
    return _rule_based_classify(req.message)


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    """
    Generate personalized scheme recommendations for a user profile.
    Falls back to simple scoring if ML model unavailable.
    """
    try:
        engine = get_recommendation_engine()
        if engine and req.schemes:
            results = engine.generate_recommendations(
                user_profile=req.user_profile,
                schemes=req.schemes,
                max_recommendations=req.max_results,
                min_relevance_score=req.min_score,
            )
            return RecommendResponse(
                recommendations=results,
                total=len(results),
            )
    except Exception as e:
        logger.warning(f"ML recommend failed, using fallback: {e}")

    # Simple fallback: return schemes sorted by relevance heuristic
    schemes = req.schemes or []
    ranked = _heuristic_rank(req.user_profile, schemes, req.max_results, req.min_score)
    return RecommendResponse(recommendations=ranked, total=len(ranked))


@app.post("/eligibility", response_model=EligibilityResponse)
def eligibility(req: EligibilityRequest):
    """
    Calculate eligibility score for a user-scheme pair.
    Falls back to rule-based scoring if ML model unavailable.
    """
    scheme_id = req.scheme.get("id") or req.scheme.get("schemeId", "unknown")
    try:
        engine = get_eligibility_engine()
        if engine:
            result = engine.calculate_eligibility(req.user_profile, req.scheme)
            met = result.get("met_criteria", [])
            unmet = result.get("unmet_criteria", [])
            pct = result.get("percentage", int(result.get("score", 0) * 100))
            return EligibilityResponse(
                scheme_id=scheme_id,
                score=result.get("score", pct / 100),
                percentage=pct,
                category=result.get("category", _pct_to_category(pct)),
                met_criteria=met,
                unmet_criteria=unmet,
                explanation=_build_explanation(pct, met, unmet),
            )
    except Exception as e:
        logger.warning(f"ML eligibility failed, using rule-based fallback: {e}")

    # Rule-based fallback
    return _rule_based_eligibility(req.user_profile, req.scheme, scheme_id)


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Conversational chatbot endpoint using ReAct agent pattern.
    Handles scheme discovery, eligibility checks, and profile-aware responses.
    """
    try:
        from chat_service import process_chat, extract_entities

        # Extract entities from message
        extracted = extract_entities(req.message, req.user_profile)

        # Merge extracted entities into user profile for this request
        merged_profile = {**req.user_profile, **extracted}

        # Process the chat message
        result = await process_chat(
            message=req.message,
            user_profile=merged_profile,
            conversation_history=req.conversation_history,
        )

        return ChatResponse(
            response=result.get("response", "I couldn't process that request."),
            suggestions=result.get("suggestions", []),
            extracted_entities=extracted,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        return ChatResponse(
            response="I'm having trouble processing that request. Could you try rephrasing?",
            suggestions=["Show my profile", "Find schemes for me", "Check eligibility"],
            extracted_entities={},
        )


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _rule_based_classify(message: str) -> ClassifyResponse:
    """Simple rule-based intent classification fallback."""
    lower = message.lower()
    entities: Dict[str, Any] = {}

    # Extract age
    import re

    age_match = re.search(r"\b(\d{1,3})\s*(years?\s*old|yr)?\b", lower)
    if age_match:
        entities["age"] = int(age_match.group(1))

    if any(w in lower for w in ["deadline", "last date", "closing date"]):
        return ClassifyResponse(primary_intent="deadline_query", confidence=0.9, entities=entities)
    if any(w in lower for w in ["eligible", "qualify", "can i apply", "do i qualify"]):
        return ClassifyResponse(
            primary_intent="eligibility_check", confidence=0.9, entities=entities
        )
    if any(w in lower for w in ["how to apply", "application", "apply for", "process"]):
        return ClassifyResponse(
            primary_intent="application_info", confidence=0.85, entities=entities
        )
    if any(w in lower for w in ["find", "scheme", "recommend", "suggest", "benefit", "welfare"]):
        return ClassifyResponse(primary_intent="scheme_search", confidence=0.8, entities=entities)
    if any(w in lower for w in ["update", "change", "set my", "my age is", "i live in"]):
        return ClassifyResponse(primary_intent="profile_update", confidence=0.85, entities=entities)

    return ClassifyResponse(primary_intent="general_question", confidence=0.6, entities=entities)


def _heuristic_rank(
    user: Dict[str, Any], schemes: List[Dict[str, Any]], limit: int, min_score: float = 0.0
) -> List[Dict[str, Any]]:
    """Simple heuristic scoring for scheme ranking using all profile fields."""

    min_score = max(0.0, min(1.0, float(min_score)))

    def score(scheme: Dict[str, Any]) -> float:
        s = 0.5  # base
        tags = [t.lower() for t in (scheme.get("tags") or [])]
        tags_str = " ".join(tags)
        desc = (scheme.get("description") or "").lower()
        combined = tags_str + " " + desc
        if user.get("state") and user["state"].lower() in (scheme.get("state", "") or "").lower():
            s += 0.15
        if user.get("employment") and user["employment"].lower() in combined:
            s += 0.10
        if user.get("education") and user["education"].lower() in combined:
            s += 0.05
        # New fields
        cat = (user.get("social_category") or "").lower()
        if cat and cat in combined:
            s += 0.10
        ru = (user.get("rural_urban") or "").lower()
        if ru and ru in combined:
            s += 0.05
        pov = (user.get("poverty_status") or "").lower()
        if pov and pov in combined:
            s += 0.05
        if user.get("is_disabled") and ("disability" in combined or "divyang" in combined):
            s += 0.10
        marital = (user.get("marital_status") or "").lower()
        if marital and marital in combined:
            s += 0.05
        return min(s, 1.0)

    ranked = sorted(schemes, key=score, reverse=True)
    scored = [{**s, "relevanceScore": round(score(s), 2)} for s in ranked]
    thresholded = [s for s in scored if float(s.get("relevanceScore", 0.0)) >= min_score]
    if not thresholded:
        thresholded = scored
    return thresholded[:limit]


def _rule_based_eligibility(
    user: Dict[str, Any], scheme: Dict[str, Any], scheme_id: str
) -> EligibilityResponse:
    """Rule-based eligibility scoring using all profile fields."""
    met, unmet = [], []
    score = 0.5

    tags_str = " ".join(scheme.get("tags") or []).lower()
    desc = (scheme.get("description") or "").lower()
    combined = tags_str + " " + desc

    if user.get("state") and user["state"].lower() in (scheme.get("state", "") or tags_str):
        met.append(f"State ({user['state']}) matches")
        score += 0.10
    if user.get("employment") and user["employment"].lower() in combined:
        met.append(f"Employment ({user['employment']}) relevant")
        score += 0.10
    if user.get("gender") == "Female" and (
        "women" in combined or "female" in combined or "woman" in combined
    ):
        met.append("Gender (Female) matches scheme target")
        score += 0.15
    if (
        user.get("income")
        and user["income"] < 300000
        and ("bpl" in combined or "poor" in combined or "low income" in combined)
    ):
        met.append("Income below poverty threshold")
        score += 0.10

    # Social category
    cat = (user.get("social_category") or "").lower()
    if cat and cat in combined:
        met.append(f"Social category ({cat.upper()}) matches")
        score += 0.10

    # Rural/Urban
    ru = (user.get("rural_urban") or "").lower()
    if ru and ru in combined:
        met.append(f"Residence type ({ru.title()}) matches")
        score += 0.05

    # Poverty / BPL status
    pov = (user.get("poverty_status") or "").lower()
    if pov and pov in combined:
        met.append(f"Poverty status ({pov.upper()}) matches")
        score += 0.05

    # Ration card
    ration = (user.get("ration_card") or "").lower()
    if ration and ration != "none" and ration in combined:
        met.append(f"Ration card ({ration.upper()}) matches")
        score += 0.05

    # Disability
    if user.get("is_disabled") and (
        "disability" in combined or "divyang" in combined or "handicap" in combined
    ):
        met.append("Disability status matches")
        score += 0.10

    # Marital status (widow/single schemes)
    marital = (user.get("marital_status") or "").lower()
    if marital and marital in combined:
        met.append(f"Marital status ({marital.title()}) matches")
        score += 0.05

    # Land ownership (landless schemes)
    land = (user.get("land_ownership") or "").lower()
    if land and "landless" in land and "landless" in combined:
        met.append("Landless status matches")
        score += 0.05

    score = min(score, 1.0)
    pct = int(score * 100)
    return EligibilityResponse(
        scheme_id=scheme_id,
        score=score,
        percentage=pct,
        category=_pct_to_category(pct),
        met_criteria=met,
        unmet_criteria=unmet,
        explanation=_build_explanation(pct, met, unmet),
    )


def _pct_to_category(pct: int) -> str:
    if pct >= 80:
        return "highly_eligible"
    if pct >= 50:
        return "potentially_eligible"
    return "low_eligibility"


def _build_explanation(pct: int, met: List[str], unmet: List[str]) -> str:
    if pct >= 80:
        return f"You appear highly eligible ({pct}%). " + (
            f"Matching: {', '.join(met)}." if met else ""
        )
    if pct >= 50:
        return (
            f"You may be eligible ({pct}%). "
            + (f"Matching: {', '.join(met)}. " if met else "")
            + (f"Missing: {', '.join(unmet)}." if unmet else "")
        )
    return f"You may not meet the criteria ({pct}%). " + (
        f"Missing: {', '.join(unmet)}." if unmet else "Consider checking the official website."
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
