"""
Chat Service — ReAct-based conversational agent for scheme discovery.

Implements:
  - Intent classification (ML or rule-based)
  - ReAct reasoning loop (Thought → Action → Observation)
  - Tool execution (search schemes, check eligibility, get details)
  - LLM-powered response generation with template fallback
  - Profile entity extraction from messages

Tools call the Node.js backend API for scheme data (Neo4j access).
"""

import os
import re
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from llm_service import llm_service

logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
MAX_REASONING_STEPS = 5

# ── System prompt for LLM-based response generation ─────────────────────────

SYSTEM_PROMPT = (
    "You are Prahar AI, a helpful assistant that helps Indian citizens find "
    "government welfare schemes. Respond in a friendly, concise tone. Always "
    "include the scheme name and application URL when available. Format lists "
    "with bullet points. Keep responses under 300 words. Language: English "
    "unless user writes in another language."
)

WRAPPER_PROMPT = (
    "You are a conversational assistant that writes only style text around factual content. "
    "Return STRICT JSON with keys: intro, outro. "
    "Do not include scheme names, numbers, percentages, rupee amounts, URLs, deadlines, "
    "or eligibility criteria in intro/outro. Keep each field under 35 words."
)


# ── Entity extraction ────────────────────────────────────────────────────────

INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu",
    "Kashmir",
    "Puducherry",
    "Chandigarh",
]

EMPLOYMENT_MAP = {
    "farmer": "Farmer",
    "agriculture": "Farmer",
    "salaried": "Salaried",
    "job": "Salaried",
    "employee": "Salaried",
    "self-employed": "Self-Employed",
    "business": "Self-Employed",
    "unemployed": "Unemployed",
    "jobless": "Unemployed",
    "student": "Student",
    "studying": "Student",
    "retired": "Retired",
}


def extract_entities(message: str, current_profile: Dict[str, Any]) -> Dict[str, Any]:
    """Extract profile fields from a user message."""
    entities: Dict[str, Any] = {}
    lower = message.lower()

    # Age
    age_match = re.search(
        r"(?:my age is|i am|i'm|age[:\s]+)\s*(\d{1,3})\s*(?:years?\s*(?:old)?)?", message, re.I
    )
    if age_match:
        age = int(age_match.group(1))
        if 5 <= age <= 120 and age != current_profile.get("age"):
            entities["age"] = age

    # Income
    income_match = re.search(
        r"(?:my income is|earning|income[:\s]+)\s*([\d.,]+)\s*(lakh|lakhs|k|cr)?", message, re.I
    )
    if income_match:
        income = float(income_match.group(1).replace(",", ""))
        unit = (income_match.group(2) or "").lower()
        if unit in ("lakh", "lakhs"):
            income *= 100_000
        elif unit == "k":
            income *= 1_000
        elif unit == "cr":
            income *= 10_000_000
        if income > 0 and income != current_profile.get("income"):
            entities["income"] = round(income)

    # State
    for state in INDIAN_STATES:
        if state.lower() in lower and state != current_profile.get("state"):
            entities["state"] = state
            break

    # Employment
    for keyword, value in EMPLOYMENT_MAP.items():
        if keyword in lower and value != current_profile.get("employment"):
            entities["employment"] = value
            break

    return entities


# ── Backend API helpers ──────────────────────────────────────────────────────


async def _backend_search_schemes(query: str, limit: int = 6) -> List[Dict]:
    """Search schemes via the Node.js backend API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                f"{BACKEND_URL}/api/schemes",
                params={"q": query, "limit": limit},
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("schemes", data) if isinstance(data, dict) else data
    except Exception as e:
        logger.warning(f"Backend search failed: {e}")
    return []


async def _backend_get_scheme(scheme_id: str) -> Optional[Dict]:
    """Get a single scheme by ID from the backend API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{BACKEND_URL}/api/schemes/{scheme_id}")
            if res.status_code == 200:
                return res.json()
    except Exception as e:
        logger.warning(f"Backend get scheme failed: {e}")
    return None


# ── Tool definitions ─────────────────────────────────────────────────────────


async def tool_search_schemes(params: Dict, user_profile: Dict) -> Dict:
    """Search for government schemes based on query and user profile."""
    query = params.get("query", "")
    limit = params.get("limit", 6)

    # Build search query from user profile if no explicit query
    if not query and user_profile:
        parts = []
        if user_profile.get("employment"):
            parts.append(user_profile["employment"])
        if user_profile.get("state"):
            parts.append(user_profile["state"])
        query = " ".join(parts) or "schemes"

    schemes = await _backend_search_schemes(query, limit)
    return {"success": True, "data": schemes, "count": len(schemes)}


async def tool_get_scheme_details(params: Dict, _user_profile: Dict) -> Dict:
    """Get detailed information about a specific scheme."""
    query = params.get("query", "")
    schemes = await _backend_search_schemes(query, 3)
    if not schemes:
        return {"success": False, "error": f'No scheme found matching "{query}"'}

    scheme = schemes[0]
    return {
        "success": True,
        "data": {
            "id": scheme.get("id") or scheme.get("schemeId"),
            "name": scheme.get("name") or scheme.get("title"),
            "description": scheme.get("description", ""),
            "ministry": scheme.get("ministry", ""),
            "tags": scheme.get("tags", []),
            "applicationUrl": scheme.get("applicationUrl")
            or scheme.get("schemeUrl")
            or f"https://www.myscheme.gov.in/schemes/{scheme.get('id') or scheme.get('schemeId', '')}",
            "otherMatches": [s.get("name") or s.get("title", "") for s in schemes[1:]],
        },
    }


async def tool_check_eligibility(params: Dict, user_profile: Dict) -> Dict:
    """Check user eligibility for schemes using the ML eligibility engine."""
    # First search for relevant schemes
    query = params.get("query", "")
    schemes = await _backend_search_schemes(query or "schemes", 10)

    # Use local eligibility engine
    try:
        from eligibility_engine import EligibilityEngine

        engine = EligibilityEngine()
        results = []
        for s in schemes[:5]:
            result = engine.calculate_eligibility(user_profile, s)
            pct = result.get("percentage", int(result.get("score", 0.5) * 100))
            if pct >= 50:
                results.append(
                    {
                        "schemeId": s.get("id") or s.get("schemeId"),
                        "name": s.get("name") or s.get("title"),
                        "eligibilityScore": pct,
                        "description": s.get("description", "")[:150],
                        "applicationUrl": s.get("applicationUrl")
                        or s.get("schemeUrl")
                        or f"https://www.myscheme.gov.in/schemes/{s.get('id') or s.get('schemeId', '')}",
                    }
                )
        results.sort(key=lambda x: x["eligibilityScore"], reverse=True)
        return {"success": True, "data": {"eligibleSchemes": results, "mlEnhanced": True}}
    except Exception as e:
        logger.warning(f"Eligibility engine failed: {e}")
        # Fallback: return schemes as-is
        return {
            "success": True,
            "data": {
                "eligibleSchemes": [
                    {
                        "schemeId": s.get("id") or s.get("schemeId"),
                        "name": s.get("name") or s.get("title"),
                        "eligibilityScore": 60,
                        "description": s.get("description", "")[:150],
                        "applicationUrl": s.get("applicationUrl")
                        or f"https://www.myscheme.gov.in/schemes/{s.get('id') or s.get('schemeId', '')}",
                    }
                    for s in schemes[:5]
                ],
                "mlEnhanced": False,
            },
        }


TOOLS = {
    "search_schemes": tool_search_schemes,
    "get_scheme_details": tool_get_scheme_details,
    "check_eligibility": tool_check_eligibility,
}

# ── OpenAI-compatible tool schemas for structured function calling ───────────

AGENT_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_schemes",
            "description": (
                "Search for Indian government welfare schemes matching a query and user profile. "
                "Use when the user wants to find or explore schemes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keywords, e.g. 'farmer loan Punjab' or 'education scholarship'",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default 6)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scheme_details",
            "description": (
                "Get detailed information about a specific scheme by name or keyword. "
                "Use when the user mentions a scheme by name or asks how to apply."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Scheme name or descriptive keywords",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_eligibility",
            "description": (
                "Check which schemes the user is eligible for based on their profile. "
                "Use when the user asks 'am I eligible', 'do I qualify', or wants personalised scheme matching."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional scheme category or keyword to narrow the search",
                    },
                },
                "required": [],
            },
        },
    },
]


# ── Quick response handlers ─────────────────────────────────────────────────


def _handle_greeting() -> Optional[Dict]:
    return {
        "response": (
            "Hello! 👋 I'm your personalized scheme recommendation assistant. "
            "I can help you:\n\n"
            "• Find government schemes you're eligible for\n"
            "• Check eligibility for specific schemes\n"
            "• Get application details for any scheme\n"
            "• View and update your profile\n\n"
            "What would you like to know?"
        ),
        "suggestions": [
            "Show my profile",
            "Find schemes for me",
            "What schemes am I eligible for?",
        ],
    }


def _handle_profile_view(profile: Dict) -> Optional[Dict]:
    fields = ["name", "email", "age", "income", "state", "employment", "education"]
    filled = sum(1 for f in fields if profile.get(f))
    completeness = round(filled / len(fields) * 100)

    response = f"📋 Your Profile ({completeness}% complete):\n\n"
    response += f"👤 Name: {profile.get('name', 'Not set')}\n"
    response += f"📧 Email: {profile.get('email', 'Not set')}\n"
    response += f"🎂 Age: {profile.get('age', 'Not set')}\n"
    response += (
        f"💰 Income: {'₹' + str(profile.get('income')) if profile.get('income') else 'Not set'}\n"
    )
    response += f"📍 State: {profile.get('state', 'Not set')}\n"
    response += f"🏢 Employment: {profile.get('employment', 'Not set')}\n"
    response += f"🎓 Education: {profile.get('education', 'Not set')}\n"

    if completeness < 100:
        response += (
            "\n💡 Complete your profile to get better recommendations! You can say:\n"
            '• "My age is 25"\n'
            '• "I live in Maharashtra"\n'
            '• "I am unemployed"\n'
            '• "My income is 300000"'
        )

    return {
        "response": response,
        "suggestions": ["Find schemes for me", "Update my details", "Check eligibility"],
    }


def _quick_response(message: str, user_profile: Dict) -> Optional[Dict]:
    """Handle simple queries without the ReAct loop."""
    lower = message.lower().strip()

    # Greetings
    if re.match(
        r"^(hello|hi|hey|good morning|good afternoon|good evening|namaste|namaskar)[!.,?]*$",
        lower,
    ):
        return _handle_greeting()

    # Profile viewing
    if any(kw in lower for kw in ["my profile", "my details", "my information", "about me"]):
        return _handle_profile_view(user_profile)

    return None


# ── ReAct loop ───────────────────────────────────────────────────────────────

FEW_SHOT = """
EXAMPLE 1:
User: "I am a farmer in Karnataka, are there any schemes for me?"
Thought: The user is looking for schemes. I should search for schemes in Karnataka for farmers.
Action: search_schemes({"query": "farmer Karnataka"})

EXAMPLE 2:
User: "How do I apply for the Post-Matric Scholarship?"
Thought: The user wants application details for a specific scheme.
Action: get_scheme_details({"query": "Post-Matric Scholarship"})

EXAMPLE 3:
User: "Am I eligible for PM-KISAN?"
Thought: The user wants to check eligibility for a specific scheme.
Action: check_eligibility({"query": "PM-KISAN"})
"""


async def _get_agent_step(query: str, user_profile: Dict, conversation_snippet: str) -> Dict:
    """Use LLM to decide the next ReAct step (tool to call)."""
    if not llm_service.is_configured:
        # Rule-based fallback
        lower = query.lower()
        if any(w in lower for w in ["eligible", "qualify", "can i"]):
            return {
                "thought": "Check eligibility",
                "tool": "check_eligibility",
                "parameters": {"query": query},
            }
        if any(w in lower for w in ["details", "tell me about", "what is", "how to apply"]):
            return {
                "thought": "Get scheme details",
                "tool": "get_scheme_details",
                "parameters": {"query": query},
            }
        return {
            "thought": "Search for schemes",
            "tool": "search_schemes",
            "parameters": {"query": query},
        }

    # --- Path 1: native function/tool calling (structured, reliable) ---
    messages = [
        {
            "role": "system",
            "content": (
                "You are a ReAct agent for Indian government welfare schemes. "
                "Use the provided tools to answer the user's query. "
                "Pick the most appropriate tool based on the user's intent."
            ),
        },
    ]
    if conversation_snippet:
        messages.append({"role": "assistant", "content": conversation_snippet})
    messages.append(
        {
            "role": "user",
            "content": (f"{query}\n\nMy profile: {json.dumps(user_profile, default=str)}"),
        }
    )

    tc_result = await llm_service.chat_with_tools(messages, AGENT_TOOLS_SCHEMA)
    if tc_result.get("type") == "tool_call" and tc_result.get("name") in TOOLS:
        return {
            "thought": f"Using tool {tc_result['name']}",
            "tool": tc_result["name"],
            "parameters": tc_result.get("parameters", {}),
        }

    # --- Path 2: text-based JSON extraction (legacy fallback) ---
    prompt = f"""You are a ReAct Agent for Indian Government Schemes.
{FEW_SHOT}
CURRENT QUERY: "{query}"
USER PROFILE: {json.dumps(user_profile, default=str)}
{conversation_snippet}

STRICT OUTPUT FORMAT — return a single JSON object:
{{"thought": "your reasoning", "tool": "tool_name_or_null", "parameters": {{"param": "value"}}}}

AVAILABLE TOOLS: [search_schemes, check_eligibility, get_scheme_details]
If no tool is needed (e.g., a general greeting), set "tool" to null.
"""
    raw = await llm_service.complete(
        "You are a strict JSON planning assistant. Return only valid JSON.", prompt
    )
    if not raw:
        return {
            "thought": "LLM empty, fallback to search",
            "tool": "search_schemes",
            "parameters": {"query": query},
        }

    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return {
            "thought": "Parse failed, fallback to search",
            "tool": "search_schemes",
            "parameters": {"query": query},
        }


def _build_template_response(tool_name: str, tool_data: Any, user_profile: Dict) -> str:
    """Template-based response when LLM is unavailable."""
    user_name = (user_profile.get("name") or "").split(" ")[0]
    name_suffix = f", {user_name}" if user_name else ""

    if not tool_data:
        return (
            f"I couldn't find specific information for that query{name_suffix}. "
            "Try rephrasing, or browse the **Schemes** page for the full list of 4,600+ "
            "government schemes."
        )

    # search_schemes
    if tool_name == "search_schemes":
        schemes = tool_data if isinstance(tool_data, list) else tool_data.get("matches", tool_data)
        if isinstance(schemes, dict):
            schemes = schemes.get("data", [])
        if not schemes:
            return f"No schemes found matching your query{name_suffix}. Try broader keywords."

        resp = f"📚 **Matching Schemes**{' for ' + user_name if user_name else ''} ({len(schemes)} found)\n\n"
        for s in (schemes if isinstance(schemes, list) else [])[:5]:
            name = s.get("name") or s.get("title") or "Unknown"
            desc = (s.get("description") or "")[:110].strip()
            score = f" — {s['eligibilityScore']}% match" if s.get("eligibilityScore") else ""
            resp += f"• **{name}**{score}\n  {desc}{'...' if len(desc) >= 110 else ''}\n\n"
        resp += '💡 Say **"am I eligible for [scheme name]?"** to check eligibility.'
        return resp

    # check_eligibility
    if tool_name == "check_eligibility":
        eligible = tool_data.get("eligibleSchemes", [])
        if not eligible:
            return "Based on your current profile I couldn't find highly matching schemes. Complete your profile for better results."
        resp = f"✅ **Eligible Schemes** for you{name_suffix}:\n\n"
        for s in eligible[:5]:
            name = s.get("name") or "Unknown"
            score = s.get("eligibilityScore", 0)
            url = s.get("applicationUrl", "")
            resp += f"• **{name}** — {score}% eligible\n"
            if url:
                resp += f"  🔗 [Apply Now]({url})\n"
            resp += "\n"
        resp += "📝 Update your details for more accurate results."
        return resp

    # get_scheme_details
    if tool_name == "get_scheme_details":
        s = tool_data
        resp = f"📋 **{s.get('name', 'Scheme Details')}**\n\n"
        if s.get("description"):
            resp += (
                f"{s['description'][:200]}{'...' if len(s.get('description','')) > 200 else ''}\n\n"
            )
        if s.get("ministry"):
            resp += f"🏛️ Ministry: {s['ministry']}\n"
        if s.get("tags"):
            resp += f"🏷️ Tags: {', '.join(s['tags'][:5])}\n"
        if s.get("applicationUrl"):
            resp += f"\n🔗 **[Apply Now]({s['applicationUrl']})**"
        if s.get("otherMatches"):
            resp += f"\n\nRelated: {', '.join(s['otherMatches'])}"
        return resp

    return "I found some information. Use the **Schemes** page to browse by category."


def _contains_factual_claims(text: str) -> bool:
    """Detect generated content that appears to include factual scheme claims."""
    if not text:
        return False
    patterns = [
        r"https?://",  # URL
        r"₹\s*\d",  # rupee amount
        r"\d+\s*%",  # percentage
        r"\b(deadline|last date|apply by|eligible|eligibility)\b",  # factual terms
    ]
    return any(re.search(p, text, re.I) for p in patterns)


def _extract_known_scheme_names(tool_name: str, tool_data: Any) -> set:
    """
    Extract the set of scheme names that the tool actually returned.
    Used as an allowlist when validating wrapper text.
    """
    names: set = set()
    if not tool_data:
        return names

    if tool_name == "search_schemes":
        schemes = tool_data if isinstance(tool_data, list) else tool_data.get("data", [])
        for s in schemes if isinstance(schemes, list) else []:
            n = s.get("name") or s.get("title", "")
            if n:
                names.add(n.lower())

    elif tool_name == "check_eligibility":
        for s in tool_data.get("eligibleSchemes", []):
            n = s.get("name", "")
            if n:
                names.add(n.lower())

    elif tool_name == "get_scheme_details":
        n = tool_data.get("name") or tool_data.get("title", "")
        if n:
            names.add(n.lower())
        for n2 in tool_data.get("otherMatches", []):
            if n2:
                names.add(n2.lower())

    return names


def _wrapper_mentions_unknown_scheme(text: str, known_names: set) -> bool:
    """
    Return True if the text references a capitalised multi-word phrase that
    looks like a scheme name but is NOT in the known allowlist.
    """
    if not text or not known_names:
        return False
    # Match patterns like "PM-KISAN" or "Pradhan Mantri Awas Yojana"
    candidates = re.findall(r"\b([A-Z][A-Za-z-]{1,}(?:\s+[A-Z][A-Za-z-]{1,}){1,})\b", text)
    for phrase in candidates:
        phrase_lower = phrase.lower()
        # If none of the known names contains this phrase, it may be hallucinated
        if not any(phrase_lower in known or known in phrase_lower for known in known_names):
            return True
    return False


async def _get_conversational_wrapper(
    user_message: str,
    user_profile: Dict[str, Any],
    tool_name: str,
    known_scheme_names: set = frozenset(),
) -> Dict[str, str]:
    """Generate a human-like intro/outro while preserving factual integrity."""
    fallback = {
        "intro": "I understand what you're looking for. I checked the latest scheme records for you.",
        "outro": "If you want, I can also help with eligibility checks or the application process next.",
    }

    if not llm_service.is_configured:
        return fallback

    profile_hint = (
        f"state={user_profile.get('state', 'N/A')}, "
        f"employment={user_profile.get('employment', 'N/A')}"
    )
    prompt = (
        f"User message: {user_message}\n"
        f"Tool used: {tool_name or 'none'}\n"
        f"Profile hint: {profile_hint}\n\n"
        "Generate only supportive conversational framing text. "
        "Output valid JSON exactly as: "
        '{"intro":"...","outro":"..."}'
    )

    raw = await llm_service.complete(WRAPPER_PROMPT, prompt)
    if not raw:
        return fallback

    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        parsed = json.loads(raw[start:end])
        intro = (parsed.get("intro") or "").strip()
        outro = (parsed.get("outro") or "").strip()
        if not intro or not outro:
            return fallback
        if _contains_factual_claims(intro) or _contains_factual_claims(outro):
            logger.debug("[wrapper] factual claims detected — using fallback")
            return fallback
        if _wrapper_mentions_unknown_scheme(
            intro, known_scheme_names
        ) or _wrapper_mentions_unknown_scheme(outro, known_scheme_names):
            logger.debug("[wrapper] unknown scheme name in wrapper — using fallback")
            return fallback
        return {"intro": intro, "outro": outro}
    except (ValueError, json.JSONDecodeError):
        return fallback


async def process_chat(
    message: str,
    user_profile: Dict[str, Any],
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Main chat processing function.

    Args:
        message: The user's message.
        user_profile: Dict with keys like name, age, income, state, employment, etc.
        conversation_history: Optional list of {role, content} dicts.

    Returns:
        Dict with 'response' (str) and 'suggestions' (list[str]).
    """
    # 1. Quick response check
    quick = _quick_response(message, user_profile)
    if quick:
        return quick

    # 2. Build conversation snippet for LLM context
    history = conversation_history or []
    recent = history[-6:]  # last 6 messages for context
    snippet = ""
    if recent:
        snippet = "RECENT CONVERSATION:\n" + "\n".join(
            f"  {m['role']}: {m['content'][:100]}" for m in recent
        )

    # 3. ReAct loop
    tool_name = ""
    tool_data: Any = None

    for _step in range(MAX_REASONING_STEPS):
        agent_step = await _get_agent_step(message, user_profile, snippet)
        tool = agent_step.get("tool")

        if not tool or tool == "null":
            break

        tool_name = tool
        tool_fn = TOOLS.get(tool)
        if not tool_fn:
            break

        result = await tool_fn(agent_step.get("parameters", {}), user_profile)
        if result.get("success"):
            tool_data = result.get("data")
            break  # Got data, generate response
        else:
            # Tool failed, try another step
            continue

    # 4. Build factual response block from tool output only.
    factual_block = _build_template_response(tool_name, tool_data, user_profile)

    # 5. Add guarded conversational framing (no facts allowed in generated text).
    if tool_data:
        known_names = _extract_known_scheme_names(tool_name, tool_data)
        wrapper = await _get_conversational_wrapper(message, user_profile, tool_name, known_names)
        response_text = f"{wrapper['intro']}\n\n{factual_block}\n\n{wrapper['outro']}"
    else:
        response_text = factual_block

    # 6. Return response
    return {
        "response": response_text,
        "suggestions": _build_suggestions(tool_name),
    }


def _build_suggestions(tool_name: str) -> List[str]:
    if tool_name == "check_eligibility":
        return ["Show matching schemes", "Update my profile", "Tell me more about a scheme"]
    if tool_name == "get_scheme_details":
        return ["Am I eligible for this?", "Find similar schemes", "Show my profile"]
    return ["Check my eligibility", "Show all schemes", "Update my profile"]
