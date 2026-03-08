"""
LLM Service — Abstracted LLM interface for chat responses.

Supports:
  - ollama  (local, free) — default if running on localhost:11434
  - openai  — requires LLM_API_KEY
  - gemini  — requires LLM_API_KEY
  - none    — falls back to template responses

Config via environment:
  LLM_PROVIDER=ollama          # ollama | openai | gemini | none
  LLM_MODEL=llama3             # model name for the provider
  LLM_API_KEY=sk-...           # required for openai / gemini
  LLM_BASE_URL=http://...      # override API base (optional)
"""

import os
import json
import logging
import httpx
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

PROVIDER = os.getenv("LLM_PROVIDER", "none").lower()
MODEL = os.getenv("LLM_MODEL", "llama3")
API_KEY = os.getenv("LLM_API_KEY", "")
BASE_URL = os.getenv("LLM_BASE_URL", "")
TIMEOUT_S = 15


class LLMService:
    """Unified LLM abstraction supporting Ollama, OpenAI, and Gemini."""

    def __init__(self):
        self.provider = PROVIDER
        self.model = MODEL

    @property
    def is_configured(self) -> bool:
        if self.provider == "none":
            return False
        if self.provider == "ollama":
            return True
        return bool(API_KEY)

    async def chat(self, messages: List[Dict[str, str]]) -> Optional[str]:
        """Send a chat completion request. Returns content string or None."""
        if not self.is_configured:
            return None

        try:
            if self.provider == "ollama":
                return await self._call_ollama(messages)
            elif self.provider == "openai":
                return await self._call_openai(messages)
            elif self.provider == "gemini":
                return await self._call_gemini(messages)
        except Exception as e:
            logger.warning(f"[LLM] {self.provider} call failed: {e}")
        return None

    async def complete(self, system_prompt: str, user_message: str) -> Optional[str]:
        """Single-turn completion shorthand."""
        return await self.chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ]
        )

    async def chat_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Chat completion with tool/function calling support.

        Returns one of:
          {"type": "tool_call", "name": str, "parameters": dict}
          {"type": "text", "content": str}
          {"type": "none"}
        """
        if not self.is_configured:
            return {"type": "none"}

        try:
            if self.provider == "openai":
                return await self._call_openai_with_tools(messages, tools)
            elif self.provider == "ollama":
                return await self._call_ollama_with_tools(messages, tools)
            else:
                # gemini and others: structured prompt fallback
                return await self._call_structured_prompt_tools(messages, tools)
        except Exception as e:
            logger.warning(f"[LLM] {self.provider} tool call failed: {e}")
        return {"type": "none"}

    # ── Provider implementations ─────────────────────────────────────────────

    async def _call_ollama(self, messages: List[Dict[str, str]]) -> str:
        base = BASE_URL or "http://localhost:11434"
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            res = await client.post(
                f"{base}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                },
            )
            res.raise_for_status()
            data = res.json()
            return data.get("message", {}).get("content", "")

    async def _call_openai(self, messages: List[Dict[str, str]]) -> str:
        base = BASE_URL or "https://api.openai.com/v1"
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            res = await client.post(
                f"{base}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}",
                },
                json={"model": self.model or "gpt-4o-mini", "messages": messages},
            )
            res.raise_for_status()
            data = res.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def _call_gemini(self, messages: List[Dict[str, str]]) -> str:
        model = self.model or "gemini-1.5-flash"
        base = (
            BASE_URL
            or f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        )
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
            if m["role"] != "system"
        ]
        system_msg = next((m for m in messages if m["role"] == "system"), None)

        body: Dict[str, Any] = {"contents": contents}
        if system_msg:
            body["systemInstruction"] = {"parts": [{"text": system_msg["content"]}]}

        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            res = await client.post(
                f"{base}?key={API_KEY}",
                headers={"Content-Type": "application/json"},
                json=body,
            )
            res.raise_for_status()
            data = res.json()
            return (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

    # ── Tool-calling implementations ─────────────────────────────────────────

    async def _call_openai_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """OpenAI native function calling via tools= parameter."""
        base = BASE_URL or "https://api.openai.com/v1"
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            res = await client.post(
                f"{base}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}",
                },
                json={
                    "model": self.model or "gpt-4o-mini",
                    "messages": messages,
                    "tools": tools,
                    "tool_choice": "auto",
                },
            )
            res.raise_for_status()
            data = res.json()
            choice = data.get("choices", [{}])[0]
            msg = choice.get("message", {})

            tool_calls = msg.get("tool_calls")
            if tool_calls:
                tc = tool_calls[0]
                fn = tc.get("function", {})
                try:
                    params = json.loads(fn.get("arguments", "{}"))
                except json.JSONDecodeError:
                    params = {}
                return {"type": "tool_call", "name": fn.get("name", ""), "parameters": params}

            return {"type": "text", "content": msg.get("content", "")}

    async def _call_ollama_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Ollama tool calling — tries native API first, falls back to structured prompt."""
        base = BASE_URL or "http://localhost:11434"
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            try:
                res = await client.post(
                    f"{base}/api/chat",
                    json={
                        "model": self.model,
                        "messages": messages,
                        "tools": tools,
                        "stream": False,
                    },
                )
                res.raise_for_status()
                data = res.json()
                msg = data.get("message", {})
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    tc = tool_calls[0]
                    fn = tc.get("function", {})
                    params = fn.get("arguments", {})
                    if isinstance(params, str):
                        try:
                            params = json.loads(params)
                        except json.JSONDecodeError:
                            params = {}
                    return {"type": "tool_call", "name": fn.get("name", ""), "parameters": params}
                content = msg.get("content", "")
                if content:
                    return {"type": "text", "content": content}
            except Exception:
                pass  # fall through to structured prompt

        return await self._call_structured_prompt_tools(messages, tools)

    async def _call_structured_prompt_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Structured prompt fallback for providers without native function calling."""
        tool_descs = []
        for t in tools:
            fn = t.get("function", t)
            props = fn.get("parameters", {}).get("properties", {})
            param_desc = ", ".join(
                f"{k} ({v.get('type', 'any')}): {v.get('description', '')}"
                for k, v in props.items()
            )
            tool_descs.append(f"- {fn['name']}: {fn.get('description', '')}. Params: {param_desc}")

        tool_list = "\n".join(tool_descs)
        tool_names = [t.get("function", t).get("name", "") for t in tools]

        augmented = list(messages)
        augmented.append(
            {
                "role": "user",
                "content": (
                    f"Available tools:\n{tool_list}\n\n"
                    "If you need a tool, respond ONLY with this JSON (no extra text):\n"
                    '{"tool_call":true,"name":"<tool_name>","parameters":{...}}\n'
                    f"Valid tool names: {tool_names}\n"
                    "Otherwise respond normally."
                ),
            }
        )

        raw = await self.chat(augmented)
        if not raw:
            return {"type": "none"}

        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            parsed = json.loads(raw[start:end])
            if parsed.get("tool_call") and parsed.get("name"):
                return {
                    "type": "tool_call",
                    "name": parsed["name"],
                    "parameters": parsed.get("parameters", {}),
                }
        except (ValueError, json.JSONDecodeError):
            pass

        return {"type": "text", "content": raw}


# Singleton
llm_service = LLMService()
