# ML Pipeline Service

## Overview

The ML Pipeline is a FastAPI-based microservice that provides AI-powered features for the PraharAI platform:

- **Intent Classification**: Classifies user queries into actionable intents
- **Scheme Recommendations**: Generates personalized scheme recommendations
- **Eligibility Scoring**: Calculates eligibility scores for user-scheme pairs
- **Chat Service**: Conversational AI with ReAct agent pattern

## Architecture

```
┌─────────────────────────────────────────┐
│         FastAPI ML Service              │
│         (Port 8000)                     │
├─────────────────────────────────────────┤
│  Endpoints:                             │
│  • POST /classify    - Intent & entities│
│  • POST /recommend   - Scheme ranking   │
│  • POST /eligibility - Eligibility score│
│  • POST /chat        - Conversational AI│
│  • GET  /health      - Service status   │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd ml-pipeline
python -m venv venv

# On Windows
venv\Scripts\activate

# On Unix/MacOS
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings (optional)
# Defaults are fine for development
```

### 3. Start the Service

```bash
python src/main.py
```

The service will start on `http://localhost:8000`

- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### POST /classify

Classify user message intent and extract entities.

**Request:**

```json
{
  "message": "I am a farmer looking for agriculture schemes",
  "user_id": "user123",
  "context": {}
}
```

**Response:**

```json
{
  "primary_intent": "scheme_search",
  "confidence": 0.85,
  "entities": {
    "occupation": "farmer",
    "category": "agriculture"
  },
  "secondary_intents": []
}
```

### POST /recommend

Generate personalized scheme recommendations.

**Request:**

```json
{
  "user_profile": {
    "age": 35,
    "state": "Maharashtra",
    "employment": "Farmer",
    "income": 150000
  },
  "schemes": [...],
  "max_results": 10,
  "min_score": 0.3
}
```

**Response:**

```json
{
  "recommendations": [
    {
      "schemeId": "scheme123",
      "name": "PM-KISAN",
      "relevanceScore": 0.92,
      "reasoning": "Matches farmer occupation and income criteria"
    }
  ],
  "total": 1,
  "cached": false
}
```

### POST /eligibility

Calculate eligibility score for a user-scheme pair.

**Request:**

```json
{
  "user_profile": {
    "age": 25,
    "state": "Maharashtra",
    "gender": "Female",
    "income": 200000
  },
  "scheme": {
    "id": "scheme123",
    "name": "Women Empowerment Scheme",
    "state": "Maharashtra",
    "tags": ["women", "employment"]
  }
}
```

**Response:**

```json
{
  "scheme_id": "scheme123",
  "score": 0.85,
  "percentage": 85,
  "category": "highly_eligible",
  "met_criteria": ["State (Maharashtra) matches", "Gender (Female) matches scheme target"],
  "unmet_criteria": [],
  "explanation": "You appear highly eligible (85%). Matching: State, Gender."
}
```

### POST /chat

Conversational chatbot with ReAct agent pattern.

**Request:**

```json
{
  "message": "What schemes are available for farmers?",
  "user_profile": {
    "age": 35,
    "state": "Punjab",
    "employment": "Farmer"
  },
  "conversation_history": []
}
```

**Response:**

```json
{
  "response": "Based on your profile, here are relevant schemes...",
  "suggestions": ["Check eligibility", "Show application process", "Update profile"],
  "extracted_entities": {
    "occupation": "farmer"
  }
}
```

### GET /health

Service health check.

**Response:**

```json
{
  "status": "ok",
  "models": {
    "intent_classifier": true,
    "eligibility_engine": true,
    "recommendation_engine": true
  },
  "version": "1.0.0"
}
```

## ML Models

The service uses three main ML components:

### 1. Intent Classifier

- **Location**: `src/intent_classifier.py`
- **Model**: DistilBERT/BERT-based
- **Intents**: scheme_search, eligibility_check, application_info, deadline_query, profile_update, general_question, nudge_preferences

### 2. Recommendation Engine

- **Location**: `src/recommendation_engine.py`
- **Approach**: User clustering (K-Means) + eligibility scoring + LTR (XGBoost)
- **Features**: User demographics, scheme tags, historical interactions

### 3. Eligibility Engine

- **Location**: `src/eligibility_engine.py`
- **Approach**: Cosine similarity on feature vectors
- **Output**: Score (0-1), percentage, category, met/unmet criteria

## Fallback Mechanisms

All endpoints have rule-based fallbacks if ML models fail to load:

- **Classify**: Keyword matching for intent detection
- **Recommend**: Heuristic scoring based on profile matches
- **Eligibility**: Rule-based criteria checking
- **Chat**: Template-based responses with entity extraction

## LLM Integration (Optional)

The service supports optional LLM integration for enhanced chat responses:

### Supported Providers

1. **Ollama** (Local, Free)

   ```bash
   # Install Ollama: https://ollama.ai
   ollama pull llama2

   # In .env:
   LLM_PROVIDER=ollama
   LLM_MODEL=llama2
   ```

2. **OpenAI**

   ```bash
   # In .env:
   LLM_PROVIDER=openai
   LLM_API_KEY=sk-your-key-here
   LLM_MODEL=gpt-3.5-turbo
   ```

3. **Google Gemini**
   ```bash
   # In .env:
   LLM_PROVIDER=gemini
   LLM_API_KEY=your-gemini-key
   LLM_MODEL=gemini-pro
   ```

Without LLM configuration, the service uses template-based responses.

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run property-based tests
pytest tests/test_*_properties.py
```

## Development

### Code Structure

```
ml-pipeline/
├── api.py                    # FastAPI app entry point
├── src/
│   ├── main.py              # Service startup script
│   ├── intent_classifier.py # Intent classification
│   ├── recommendation_engine.py
│   ├── eligibility_engine.py
│   ├── user_classifier.py   # K-Means clustering
│   ├── feature_extractor.py # Feature engineering
│   ├── chat_service.py      # ReAct agent
│   └── llm_service.py       # LLM abstraction
├── models/                   # Trained model files
├── tests/                    # Test suite
└── requirements.txt
```

### Hot Reload

For faster development, you can use uvicorn directly with hot reload:

```bash
# Note: Hot reload doesn't work on Windows with the default config
# Use this instead:
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

On Windows, `src/main.py` automatically disables reload to avoid multiprocessing issues.

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8000
netstat -ano | findstr :8000

# Kill the process (Windows)
taskkill /F /PID <process_id>

# Or use a different port
ML_SERVICE_PORT=8001 python src/main.py
```

### Import Errors

Make sure you're in the virtual environment:

```bash
# Windows
venv\Scripts\activate

# Unix/MacOS
source venv/bin/activate

# Verify
which python
pip list
```

### Model Loading Issues

Models are lazy-loaded on first use. If you see warnings about models not loading, it's normal - the service will use fallback mechanisms.

To check model status:

```bash
curl http://localhost:8000/health
```

## Performance

- **Startup time**: ~2-3 seconds
- **Response time** (without ML): <50ms
- **Response time** (with ML): 100-500ms
- **Concurrent requests**: Supports async processing

## Integration with Backend

The backend (Node.js/Express on port 3000) connects to this service via:

**File**: `backend/src/services/ml.service.ts`

```typescript
const ML_BASE = 'http://localhost:8000';

// Example: Classify intent
const result = await mlService.classify(message, userId);

// Example: Get recommendations
const recommendations = await mlService.recommend(userProfile, schemes);

// Example: Check eligibility
const eligibility = await mlService.checkEligibility(userProfile, scheme);
```

## Production Deployment

For production, use a production-grade ASGI server:

```bash
# Install gunicorn
pip install gunicorn

# Start with 4 workers
gunicorn api:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

Or use Docker (see `docker-compose.yml` in project root).

## Further Reading

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)
- [Scheme Recommendation Architecture](../docs/ARCHITECTURE.md)
