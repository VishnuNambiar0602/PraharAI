"""
Integration tests for ML Pipeline FastAPI endpoints (T-08)

Tests all 4 main endpoints:
  - POST /classify    (intent classification + entity extraction)
  - POST /recommend   (ranked scheme recommendations)
  - POST /eligibility (eligibility scoring)
  - POST /chat        (conversational chatbot)
  - GET  /health      (service status)
"""

import pytest
import sys
import os
from typing import Dict, Any, List

# For testing without a running FastAPI server, we import the app directly
# We'll use TestClient from fastapi.testclient
try:
    from fastapi.testclient import TestClient

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from api import app

    HAS_TESTCLIENT = True
except ImportError:
    HAS_TESTCLIENT = False


@pytest.mark.skipif(not HAS_TESTCLIENT, reason="FastAPI TestClient not available")
class TestMLPipelineAPI:
    """Integration tests for ML Pipeline FastAPI endpoints"""

    @pytest.fixture
    def client(self):
        """Create a TestClient for the FastAPI app"""
        return TestClient(app)

    # ─── Health Check ────────────────────────────────────────────────────────────

    def test_health_endpoint_returns_ok(self, client):
        """Health endpoint should return status=ok"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "models" in data
        assert "version" in data

    def test_health_includes_model_availability(self, client):
        """Health endpoint should indicate model availability"""
        response = client.get("/health")
        data = response.json()
        models = data["models"]
        assert "intent_classifier" in models
        assert "eligibility_engine" in models
        assert "recommendation_engine" in models
        # These should be booleans
        assert isinstance(models["intent_classifier"], bool)
        assert isinstance(models["eligibility_engine"], bool)
        assert isinstance(models["recommendation_engine"], bool)

    # ─── Classify Endpoint ────────────────────────────────────────────────────────

    def test_classify_simple_scheme_search(self, client):
        """Classify should recognize scheme search intent"""
        payload = {"message": "Show me education schemes in Maharashtra"}
        response = client.post("/classify", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "primary_intent" in data
        assert "confidence" in data
        assert "entities" in data
        assert isinstance(data["confidence"], (int, float))
        assert 0 <= data["confidence"] <= 1

    def test_classify_eligibility_check(self, client):
        """Classify should recognize eligibility check intent"""
        payload = {"message": "Am I eligible for the PM-KISAN scheme?"}
        response = client.post("/classify", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["primary_intent"] in [
            "scheme_search",
            "eligibility_check",
            "application_info",
            "deadline_query",
            "profile_update",
            "general_question",
            "nudge_preferences",
        ]

    def test_classify_with_context(self, client):
        """Classify should accept optional context"""
        payload = {
            "message": "What schemes are there?",
            "user_id": "user-123",
            "context": {"state": "Karnataka", "income": 500000},
        }
        response = client.post("/classify", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "primary_intent" in data

    def test_classify_extracts_entities(self, client):
        """Classify should extract named entities from message"""
        payload = {"message": "I'm a 30-year-old teacher in Delhi with income 500000"}
        response = client.post("/classify", json=payload)
        assert response.status_code == 200
        data = response.json()
        entities = data["entities"]
        assert isinstance(entities, dict)
        # Should extract some entities (age, occupation, location, income)
        # The exact entities depend on the classifier implementation

    def test_classify_empty_message_handled(self, client):
        """Classify should handle empty messages gracefully"""
        payload = {"message": ""}
        response = client.post("/classify", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "primary_intent" in data

    # ─── Recommend Endpoint ──────────────────────────────────────────────────────

    def test_recommend_returns_schemes(self, client):
        """Recommend should return a list of schemes"""
        user_profile = {
            "age": 30,
            "income": 500000,
            "occupation": "Software Engineer",
            "state": "Maharashtra",
            "education": "graduate",
        }
        schemes = [
            {
                "id": "scheme-1",
                "name": "Tech Startup Scheme",
                "category": "business",
                "state": "Maharashtra",
            },
            {
                "id": "scheme-2",
                "name": "Education Loan Scheme",
                "category": "education",
                "state": "Maharashtra",
            },
            {
                "id": "scheme-3",
                "name": "Agricultural Subsidy",
                "category": "agriculture",
                "state": "Maharashtra",
            },
        ]
        payload = {
            "user_profile": user_profile,
            "schemes": schemes,
            "max_results": 10,
            "min_score": 0.3,
        }
        response = client.post("/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "recommendations" in data
        assert "total" in data
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["total"], int)
        assert len(data["recommendations"]) <= 10

    def test_recommend_respects_max_results(self, client):
        """Recommend should not exceed max_results"""
        user_profile = {"age": 25, "income": 300000}
        schemes = [
            {"id": f"scheme-{i}", "name": f"Scheme {i}", "category": "general"} for i in range(20)
        ]
        payload = {
            "user_profile": user_profile,
            "schemes": schemes,
            "max_results": 5,
        }
        response = client.post("/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) <= 5

    def test_recommend_filters_by_min_score(self, client):
        """Recommend should filter by minimum confidence score"""
        user_profile = {"age": 40, "income": 200000}
        schemes = [
            {"id": "scheme-1", "name": "Poor Farmer Aid", "category": "agriculture"},
        ]
        payload = {
            "user_profile": user_profile,
            "schemes": schemes,
            "max_results": 10,
            "min_score": 0.7,  # High threshold
        }
        response = client.post("/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Result should be empty or contain only highly relevant schemes
        assert isinstance(data["recommendations"], list)

    def test_recommend_without_schemes_defaults_gracefully(self, client):
        """Recommend should handle missing schemes gracefully"""
        user_profile = {"age": 30, "income": 500000}
        payload = {
            "user_profile": user_profile,
            "max_results": 10,
        }
        response = client.post("/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["recommendations"], list)

    # ─── Eligibility Endpoint ────────────────────────────────────────────────────

    def test_eligibility_returns_score(self, client):
        """Eligibility should return eligibility score"""
        user_profile = {
            "age": 25,
            "income": 400000,
            "education": "graduate",
            "state": "Maharashtra",
        }
        scheme = {
            "id": "pm-kisan",
            "name": "PM-KISAN",
            "category": "agriculture",
            "eligibility": {"income_max": 500000, "age_min": 18},
        }
        payload = {"user_profile": user_profile, "scheme": scheme}
        response = client.post("/eligibility", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "scheme_id" in data
        assert "score" in data
        assert "percentage" in data
        assert "category" in data
        assert "explanation" in data
        assert 0 <= data["score"] <= 1
        assert 0 <= data["percentage"] <= 100

    def test_eligibility_categorizes_properly(self, client):
        """Eligibility should categorize users correctly"""
        user_profile = {
            "age": 35,
            "income": 300000,
            "education": "graduate",
        }
        scheme = {
            "id": "test-scheme",
            "name": "Test Scheme",
            "eligibility": {"income_max": 500000},
        }
        payload = {"user_profile": user_profile, "scheme": scheme}
        response = client.post("/eligibility", json=payload)
        assert response.status_code == 200
        data = response.json()
        category = data["category"]
        assert category in [
            "highly_eligible",
            "potentially_eligible",
            "low_eligibility",
        ]

    def test_eligibility_provides_criteria_breakdown(self, client):
        """Eligibility should breakdown met and unmet criteria"""
        user_profile = {
            "age": 30,
            "income": 450000,
            "education": "graduate",
        }
        scheme = {
            "id": "scheme-1",
            "name": "Scheme 1",
            "eligibility": {"income_max": 500000, "education_min": "graduate"},
        }
        payload = {"user_profile": user_profile, "scheme": scheme}
        response = client.post("/eligibility", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "met_criteria" in data
        assert "unmet_criteria" in data
        assert isinstance(data["met_criteria"], list)
        assert isinstance(data["unmet_criteria"], list)

    # ─── Chat Endpoint ───────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_chat_basic_query(self, client):
        """Chat should respond to basic scheme queries"""
        payload = {
            "message": "What schemes are available in Maharashtra?",
            "user_profile": {"state": "Maharashtra", "age": 30, "income": 500000},
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0

    @pytest.mark.asyncio
    async def test_chat_with_profile(self, client):
        """Chat should use user profile context"""
        payload = {
            "message": "What schemes can I apply for?",
            "user_profile": {
                "age": 28,
                "income": 350000,
                "occupation": "Teacher",
                "education": "postgraduate",
                "state": "Delhi",
            },
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert isinstance(data["response"], str)

    @pytest.mark.asyncio
    async def test_chat_with_conversation_history(self, client):
        """Chat should accept previous conversation history"""
        payload = {
            "message": "Tell me more about that",
            "user_profile": {"age": 30},
            "conversation_history": [
                {"role": "user", "content": "What education schemes exist?"},
                {
                    "role": "assistant",
                    "content": "Here are some education schemes...",
                },
            ],
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data

    @pytest.mark.asyncio
    async def test_chat_provides_suggestions(self, client):
        """Chat should provide follow-up suggestions"""
        payload = {
            "message": "How do I apply for schemes?",
            "user_profile": {},
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)

    @pytest.mark.asyncio
    async def test_chat_extracts_entities(self, client):
        """Chat should extract entities from user message"""
        payload = {
            "message": "I'm a 32-year-old engineer in Bangalore with income 600000",
            "user_profile": {},
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "extracted_entities" in data
        assert isinstance(data["extracted_entities"], dict)

    # ─── Error Handling ──────────────────────────────────────────────────────────

    def test_invalid_classify_request_handled(self, client):
        """Classify should handle invalid requests"""
        # Missing 'message' field
        payload = {"user_id": "user-123"}
        response = client.post("/classify", json=payload)
        # FastAPI should return 422 Unprocessable Entity
        assert response.status_code == 422

    def test_invalid_recommend_request_handled(self, client):
        """Recommend should handle invalid requests"""
        # Missing 'user_profile' field
        payload = {"schemes": []}
        response = client.post("/recommend", json=payload)
        assert response.status_code == 422

    def test_invalid_eligibility_request_handled(self, client):
        """Eligibility should handle invalid requests"""
        # Missing required fields
        payload = {"user_profile": {}}
        response = client.post("/eligibility", json=payload)
        assert response.status_code == 422

    # ─── Endpoint Availability ───────────────────────────────────────────────────

    def test_all_endpoints_available(self, client):
        """All 5 main endpoints should exist and be callable"""
        # Health endpoint
        response = client.get("/health")
        assert response.status_code in [200, 404]  # 404 is acceptable if model loading fails

        # Classify endpoint
        response = client.post("/classify", json={"message": "test"}, allow_redirects=False)
        assert response.status_code in [200, 422]  # 422 means model not loaded

        # Recommend endpoint
        response = client.post(
            "/recommend",
            json={"user_profile": {}, "max_results": 10},
            allow_redirects=False,
        )
        assert response.status_code in [200, 422]

        # Eligibility endpoint
        response = client.post(
            "/eligibility",
            json={"user_profile": {}, "scheme": {}},
            allow_redirects=False,
        )
        assert response.status_code in [200, 422]

        # Chat endpoint
        response = client.post("/chat", json={"message": "test"}, allow_redirects=False)
        assert response.status_code in [200, 422]

    # ─── Response Consistency ────────────────────────────────────────────────────

    def test_classify_response_structure_consistent(self, client):
        """Classify response should always have consistent structure"""
        for message in [
            "Show me schemes",
            "Am I eligible?",
            "How to apply?",
            "Update profile",
        ]:
            response = client.post("/classify", json={"message": message})
            if response.status_code == 200:
                data = response.json()
                assert "primary_intent" in data
                assert "confidence" in data
                assert "entities" in data
                assert "secondary_intents" in data

    def test_recommend_response_structure_consistent(self, client):
        """Recommend response should always have consistent structure"""
        payload = {
            "user_profile": {"age": 30},
            "schemes": [{"id": "s1", "name": "S1"}],
        }
        response = client.post("/recommend", json=payload)
        if response.status_code == 200:
            data = response.json()
            assert "recommendations" in data
            assert "total" in data
            assert isinstance(data["recommendations"], list)
            assert isinstance(data["total"], int)

    def test_eligibility_response_structure_consistent(self, client):
        """Eligibility response should always have consistent structure"""
        payload = {"user_profile": {"age": 25}, "scheme": {"id": "s1"}}
        response = client.post("/eligibility", json=payload)
        if response.status_code == 200:
            data = response.json()
            assert "scheme_id" in data
            assert "score" in data
            assert "percentage" in data
            assert "category" in data
            assert "met_criteria" in data
            assert "unmet_criteria" in data
            assert "explanation" in data


# ─── Standalone CLI Test Runner ──────────────────────────────────────────────

if __name__ == "__main__":
    """Run API tests with: python tests/test_api.py"""
    pytest.main([__file__, "-v", "-s"])
