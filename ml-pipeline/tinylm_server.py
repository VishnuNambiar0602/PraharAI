from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from transformers import pipeline
import uvicorn
import os
from pathlib import Path
from dotenv import load_dotenv


def load_shared_env() -> None:
    current = Path(__file__).resolve()
    candidates = [
        Path.cwd() / ".env",
        current.parent / ".env",
        current.parent.parent / ".env",
    ]

    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate, override=False)
            return


load_shared_env()

app = FastAPI()

# Extremely small model for reliable localhost startup
MODEL_ID = os.getenv("TINYLM_MODEL_ID", "sshleifer/tiny-gpt2")
print(f"Loading TinyLM: {MODEL_ID}...")

pipe = pipeline("text-generation", model=MODEL_ID)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: int = 256


@app.get("/health")
async def health():
    return {"status": "ready", "model": MODEL_ID}


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    try:
        prompt = "\n".join([f"{m.role}: {m.content}" for m in request.messages])
        output = pipe(
            prompt,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            do_sample=request.temperature > 0,
            return_full_text=False,
        )
        response_text = output[0]["generated_text"].strip()

        return {
            "id": "chatcmpl-local",
            "object": "chat.completion",
            "model": request.model or MODEL_ID,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": response_text},
                    "finish_reason": "stop",
                }
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    host = os.getenv("TINYLM_HOST", "0.0.0.0")
    port = int(os.getenv("TINYLM_PORT", "8001"))
    uvicorn.run(app, host=host, port=port)
