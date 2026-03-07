"""
ML Pipeline Entry Point

This module starts the FastAPI ML service defined in api.py.
Run: python src/main.py

The service provides:
- POST /classify     — Intent classification + entity extraction
- POST /recommend    — Ranked scheme recommendations
- POST /eligibility  — Eligibility score for user-scheme pair
- POST /chat         — Conversational chatbot (ReAct agent)
- GET  /health       — Service status
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to Python path so we can import api module
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)


def main():
    """Start the ML Pipeline FastAPI service."""
    print("╔════════════════════════════════════════════════════════════╗")
    print("║         PraharAI ML Pipeline Service Starting...          ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"Service Port: {os.getenv('ML_SERVICE_PORT', '8000')}")
    print(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    print()

    # Import and run the FastAPI app
    try:
        import uvicorn
        from api import app

        # Get configuration from environment
        host = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
        port = int(os.getenv("ML_SERVICE_PORT", "8000"))
        env = os.getenv("ENVIRONMENT", "development")

        # Disable reload on Windows to avoid multiprocessing issues
        reload = env == "development" and sys.platform != "win32"

        print(f"Starting ML Service at http://{host}:{port}")
        print(f"Health check: http://{host}:{port}/health")
        print(f"API docs: http://{host}:{port}/docs")
        if not reload:
            print("Note: Hot reload disabled (Windows or production mode)")
        print()

        # Start the server
        uvicorn.run(
            app,  # Pass app directly instead of string to avoid reload issues
            host=host,
            port=port,
            reload=False,  # Always disable reload to avoid Windows issues
            log_level="info",
        )

    except ImportError as e:
        print(f"❌ Error: Could not import required modules: {e}")
        print("\nPlease ensure you have installed all dependencies:")
        print("  pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error starting ML service: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
