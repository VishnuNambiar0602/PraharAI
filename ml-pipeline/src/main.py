"""
Prahar AI — ML Pipeline Entry Point (T-08)

Initialises the FastAPI application, loads ML models on startup,
and starts uvicorn on the configured port (default 5000).

Run directly:
    python src/main.py

Or via uvicorn:
    uvicorn api:app --host 0.0.0.0 --port 5000 --reload
"""

import os
import sys
import logging

from dotenv import load_dotenv

load_dotenv()

# Make the ml-pipeline root importable so `api` can be found
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import uvicorn
from api import app  # noqa: F401 -- imported so it is reachable as a module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", "5000"))
ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")

if __name__ == "__main__":
    logger.info("ML Pipeline starting on %s:%s", ML_SERVICE_HOST, ML_SERVICE_PORT)
    uvicorn.run(
        "api:app",
        host=ML_SERVICE_HOST,
        port=ML_SERVICE_PORT,
        reload=bool(os.getenv("ML_RELOAD", "")),
        log_level="info",
    )
