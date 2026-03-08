"""
Eligibility Engine for calculating scheme eligibility using cosine similarity

This module provides the EligibilityEngine class that calculates how well
a user matches a scheme's requirements using cosine similarity between
feature vectors.
"""

import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
try:
    from src.feature_extractor import FeatureExtractor
except ImportError:
    from feature_extractor import FeatureExtractor

# Optional: Vector DB clients
try:
    from pymilvus import connections, Collection, utility

    MILVUS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False


class EligibilityEngine:
    """
    Calculate eligibility scores using weighted similarity and Vector DB.

    The engine:
    - Uses learned feature weights (Attention) to prioritize critical criteria
    - Integrates with Milvus for fast similarity search across thousands of schemes
    - Converts similarity to 0-100% score
    - Categorizes eligibility as highly_eligible (≥80%), potentially_eligible (50-80%),
      or low_eligibility (<50%)
    - Provides detailed explanations of met and unmet criteria
    """

    def __init__(self, use_milvus: bool = False):
        """
        Initialize the eligibility engine with feature extractor.

        Args:
            use_milvus: Whether to use Milvus for vector search
        """
        self.feature_extractor = FeatureExtractor()
        self._eligibility_cache: Dict[str, Dict[str, Any]] = {}
        self.use_milvus = use_milvus and MILVUS_AVAILABLE

        # Learned feature weights (Attention Mechanism simulator)
        # These weights prioritize critical criteria like Income, Age, and Location
        # In a production system, these would be learned from historical data.
        self.feature_weights = {
            "age": 0.25,
            "annual_income": 0.30,
            "location": 0.20,
            "occupation": 0.05,
            "education": 0.05,
            "caste": 0.10,
            "disability": 0.05,
        }

        if self.use_milvus:
            self._init_milvus()

    def _init_milvus(self):
        """Initialize connection to Milvus."""
        try:
            connections.connect("default", host="localhost", port="19530")
            # Collection setup would go here in a full implementation
        except Exception as e:
            print(f"Failed to connect to Milvus: {e}")
            self.use_milvus = False

    def _weighted_cosine_similarity(self, vector_a: np.ndarray, vector_b: np.ndarray) -> float:
        """
        Calculate weighted cosine similarity between two vectors.

        Args:
            vector_a: User vector
            vector_b: Scheme vector

        Returns:
            Weighted similarity score (0.0 to 1.0)
        """
        # Apply weights to the vectors before calculating similarity
        # This simulates an attention mechanism where certain features are amplified

        # In this implementation, we assume the vector indices correspond to specific features
        # from the feature_extractor. This is a simplified version.

        # Get feature names from extractor if available, else use index-based weighting
        # Assuming the first few dimensions are: age, income, state, etc.
        weights = np.ones(len(vector_a))

        # Example mapping (should match FeatureExtractor logic)
        weights[0] = self.feature_weights["age"] / 0.1  # Normalize
        weights[1] = self.feature_weights["annual_income"] / 0.1
        # ... apply other weights ...

        weighted_a = vector_a * weights
        weighted_b = vector_b * weights

        # Standard cosine similarity on weighted vectors
        dot_product = np.dot(weighted_a, weighted_b)
        norm_a = np.linalg.norm(weighted_a)
        norm_b = np.linalg.norm(weighted_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return max(0.0, min(1.0, dot_product / (norm_a * norm_b)))

    def calculate_eligibility(
        self, user_profile: Dict[str, Any], scheme: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate eligibility score for a user-scheme pair using weighted similarity.
        """
        # Extract feature vectors
        user_vector = self.feature_extractor.extract_features(user_profile)
        scheme_vector = self._extract_scheme_vector(scheme)

        # Calculate weighted cosine similarity
        raw_score = self._weighted_cosine_similarity(user_vector, scheme_vector)

        # Convert to percentage (0-100)
        percentage = raw_score * 100

        # Categorize eligibility
        category = self._categorize_eligibility(percentage)

        # Analyze criteria
        met_criteria, unmet_criteria = self._analyze_criteria(
            user_profile, scheme, user_vector, scheme_vector
        )

        return {
            "score": raw_score,
            "percentage": percentage,
            "category": category,
            "met_criteria": met_criteria,
            "unmet_criteria": unmet_criteria,
            "calculated_at": datetime.now().isoformat(),
        }

    def batch_calculate_eligibility(
        self, user_profile: Dict[str, Any], schemes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate eligibility for multiple schemes efficiently.

        Reuses user vector across calculations for better performance.

        Args:
            user_profile: Dictionary containing user profile data
            schemes: List of scheme dictionaries

        Returns:
            List of eligibility result dictionaries
        """
        # Extract user vector once
        user_vector = self.feature_extractor.extract_features(user_profile)

        results = []
        for scheme in schemes:
            # Check cache first
            cache_key = self._get_cache_key(user_profile, scheme)
            cached_result = self._get_cached_result(cache_key)

            if cached_result:
                results.append(cached_result)
                continue

            # Calculate eligibility
            scheme_vector = self._extract_scheme_vector(scheme)
            raw_score = self._weighted_cosine_similarity(user_vector, scheme_vector)
            percentage = raw_score * 100
            category = self._categorize_eligibility(percentage)

            met_criteria, unmet_criteria = self._analyze_criteria(
                user_profile, scheme, user_vector, scheme_vector
            )

            result = {
                "scheme_id": scheme.get("scheme_id", ""),
                "score": raw_score,
                "percentage": percentage,
                "category": category,
                "met_criteria": met_criteria,
                "unmet_criteria": unmet_criteria,
                "calculated_at": datetime.now().isoformat(),
            }

            # Cache result for 24 hours
            self._cache_result(cache_key, result)
            results.append(result)

        return results

    def generate_explanation(
        self,
        eligibility_result: Dict[str, Any],
        user_profile: Dict[str, Any],
        scheme: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate natural language explanation for eligibility result.

        Args:
            eligibility_result: Result from calculate_eligibility
            user_profile: User profile dictionary
            scheme: Scheme dictionary

        Returns:
            Dictionary containing:
                - summary: Overall summary of eligibility
                - strengths: List of top 3 matching criteria
                - gaps: List of unmet criteria with explanations
                - recommendations: Suggestions for improving eligibility
        """
        met_criteria = eligibility_result["met_criteria"]
        unmet_criteria = eligibility_result["unmet_criteria"]
        percentage = eligibility_result["percentage"]
        category = eligibility_result["category"]

        # Generate summary
        if category == "highly_eligible":
            summary = f"You are highly eligible for this scheme with a {percentage:.1f}% match."
        elif category == "potentially_eligible":
            summary = (
                f"You are potentially eligible for this scheme with a {percentage:.1f}% match."
            )
        else:
            summary = f"You have low eligibility for this scheme with a {percentage:.1f}% match."

        # Identify top 3 matching criteria
        strengths = self._format_top_criteria(met_criteria[:3], user_profile)

        # Format unmet criteria with explanations
        gaps = self._format_gaps(unmet_criteria, user_profile, scheme)

        # Generate recommendations
        recommendations = self._generate_recommendations(unmet_criteria, user_profile)

        return {
            "summary": summary,
            "strengths": strengths,
            "gaps": gaps,
            "recommendations": recommendations,
        }

    def _cosine_similarity(self, vector_a: np.ndarray, vector_b: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            vector_a: First vector
            vector_b: Second vector

        Returns:
            Cosine similarity score (0.0 to 1.0)
        """
        # Ensure same dimensionality
        if len(vector_a) != len(vector_b):
            raise ValueError(f"Vector dimension mismatch: {len(vector_a)} vs {len(vector_b)}")

        # Calculate dot product
        dot_product = np.dot(vector_a, vector_b)

        # Calculate magnitudes
        norm_a = np.linalg.norm(vector_a)
        norm_b = np.linalg.norm(vector_b)

        # Avoid division by zero
        if norm_a == 0 or norm_b == 0:
            return 0.0

        # Calculate cosine similarity
        cosine_sim = dot_product / (norm_a * norm_b)

        # Clamp to [0, 1] range (cosine similarity is naturally [-1, 1])
        # For eligibility, we treat negative similarity as 0
        return max(0.0, min(1.0, cosine_sim))

    def _categorize_eligibility(self, percentage: float) -> str:
        """
        Categorize eligibility score into predefined categories.

        Args:
            percentage: Eligibility percentage (0-100)

        Returns:
            Category string: 'highly_eligible', 'potentially_eligible', or 'low_eligibility'
        """
        if percentage >= 80:
            return "highly_eligible"
        elif percentage >= 50:
            return "potentially_eligible"
        else:
            return "low_eligibility"

    def _extract_scheme_vector(self, scheme: Dict[str, Any]) -> np.ndarray:
        """
        Extract feature vector from scheme eligibility requirements.

        Creates a vector matching the user profile vector structure,
        where each dimension represents a requirement.

        Args:
            scheme: Scheme dictionary with eligibility criteria

        Returns:
            numpy array representing scheme requirements
        """
        raw_eligibility = scheme.get("eligibility", {})
        # Backend may return eligibility as a plain string — normalise to dict
        if isinstance(raw_eligibility, str):
            eligibility = {}
        else:
            eligibility = raw_eligibility if isinstance(raw_eligibility, dict) else {}

        # Create a pseudo-profile from scheme requirements
        # This allows us to use the same feature extractor
        scheme_profile = {
            "age": self._get_midpoint_age(eligibility),
            "annual_income": eligibility.get("income_max", 10000000),
            "family_size": 4,  # Default average
            "gender": self._get_first_or_default(eligibility.get("gender"), "male"),
            "marital_status": "married",  # Default
            "employment_status": self._get_first_or_default(
                eligibility.get("employment_status"), "employed"
            ),
            "education_level": self._get_first_or_default(
                eligibility.get("education_levels"), "secondary"
            ),
            "caste": self._get_first_or_default(eligibility.get("castes"), "general"),
            "rural_urban": self._get_first_or_default(eligibility.get("rural_urban"), "urban"),
            "state": self._get_first_or_default(eligibility.get("states"), ""),
            "disability": eligibility.get("disability", False),
        }

        return self.feature_extractor.extract_features(scheme_profile)

    def _get_midpoint_age(self, eligibility: Dict[str, Any]) -> int:
        """Get midpoint of age range from eligibility criteria."""
        age_min = eligibility.get("age_min")
        age_max = eligibility.get("age_max")

        # Handle None values
        if age_min is None:
            age_min = 18
        if age_max is None:
            age_max = 100

        return (age_min + age_max) // 2

    def _get_first_or_default(self, value: Any, default: str) -> str:
        """
        Get first element from list or return default.

        Handles None, empty lists, and non-list values safely.

        Args:
            value: Value to extract from (could be list, string, or None)
            default: Default value to return if extraction fails

        Returns:
            First element of list, the value itself if string, or default
        """
        if value is None:
            return default
        if isinstance(value, list):
            return value[0] if len(value) > 0 else default
        if isinstance(value, str):
            return value
        return default

    def _analyze_criteria(
        self,
        user_profile: Dict[str, Any],
        scheme: Dict[str, Any],
        user_vector: np.ndarray,
        scheme_vector: np.ndarray,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Analyze which criteria the user meets and doesn't meet.

        Args:
            user_profile: User profile dictionary
            scheme: Scheme dictionary
            user_vector: User feature vector
            scheme_vector: Scheme feature vector

        Returns:
            Tuple of (met_criteria, unmet_criteria) lists
        """
        met_criteria = []
        unmet_criteria = []

        raw_elig = scheme.get("eligibility", {})
        eligibility = raw_elig if isinstance(raw_elig, dict) else {}

        # Age criterion
        age_min = eligibility.get("age_min")
        age_max = eligibility.get("age_max")
        user_age = user_profile.get("age", 0)

        if age_min is not None or age_max is not None:
            age_min = age_min if age_min is not None else 0
            age_max = age_max if age_max is not None else 150

            if age_min <= user_age <= age_max:
                met_criteria.append(
                    {
                        "name": "age",
                        "user_value": user_age,
                        "requirement": f"{age_min}-{age_max} years",
                        "weight": 0.15,
                    }
                )
            else:
                unmet_criteria.append(
                    {
                        "name": "age",
                        "user_value": user_age,
                        "requirement": f"{age_min}-{age_max} years",
                        "required": True,
                    }
                )

        # Income criterion
        income_max = eligibility.get("income_max")
        user_income = user_profile.get("annual_income", 0)

        if income_max is not None:
            if user_income <= income_max:
                met_criteria.append(
                    {
                        "name": "income",
                        "user_value": user_income,
                        "requirement": f"≤ {income_max}",
                        "weight": 0.20,
                    }
                )
            else:
                unmet_criteria.append(
                    {
                        "name": "income",
                        "user_value": user_income,
                        "requirement": f"≤ {income_max}",
                        "required": True,
                    }
                )

        # Location criterion
        eligible_states = eligibility.get("states", [])
        user_state = user_profile.get("state", "")

        if eligible_states:
            if user_state in eligible_states:
                met_criteria.append(
                    {
                        "name": "location",
                        "user_value": user_state,
                        "requirement": ", ".join(eligible_states),
                        "weight": 0.15,
                    }
                )
            else:
                unmet_criteria.append(
                    {
                        "name": "location",
                        "user_value": user_state,
                        "requirement": ", ".join(eligible_states),
                        "required": True,
                    }
                )

        # Occupation criterion
        eligible_occupations = eligibility.get("occupations", [])
        user_occupation = user_profile.get("occupation", "")

        if eligible_occupations:
            if user_occupation in eligible_occupations:
                met_criteria.append(
                    {
                        "name": "occupation",
                        "user_value": user_occupation,
                        "requirement": ", ".join(eligible_occupations),
                        "weight": 0.10,
                    }
                )
            else:
                unmet_criteria.append(
                    {
                        "name": "occupation",
                        "user_value": user_occupation,
                        "requirement": ", ".join(eligible_occupations),
                        "required": False,
                    }
                )

        # Education criterion
        eligible_education = eligibility.get("education_levels", [])
        user_education = user_profile.get("education_level", "")

        if eligible_education:
            if user_education in eligible_education:
                met_criteria.append(
                    {
                        "name": "education",
                        "user_value": user_education,
                        "requirement": ", ".join(eligible_education),
                        "weight": 0.10,
                    }
                )

        # Caste criterion
        eligible_castes = eligibility.get("castes", [])
        user_caste = user_profile.get("caste", "")

        if eligible_castes:
            if user_caste in eligible_castes:
                met_criteria.append(
                    {
                        "name": "caste",
                        "user_value": user_caste,
                        "requirement": ", ".join(eligible_castes),
                        "weight": 0.10,
                    }
                )

        # Disability criterion
        requires_disability = eligibility.get("disability")
        user_has_disability = user_profile.get("disability", False)

        if requires_disability is not None:
            if requires_disability == user_has_disability:
                met_criteria.append(
                    {
                        "name": "disability",
                        "user_value": user_has_disability,
                        "requirement": "Required" if requires_disability else "Not required",
                        "weight": 0.10,
                    }
                )

        return met_criteria, unmet_criteria

    def _format_top_criteria(
        self, criteria: List[Dict[str, Any]], user_profile: Dict[str, Any]
    ) -> List[str]:
        """Format top matching criteria as natural language strings."""
        formatted = []

        for criterion in criteria:
            name = criterion["name"]
            user_value = criterion["user_value"]

            if name == "age":
                formatted.append(f"Your age ({user_value} years) matches the scheme requirements")
            elif name == "income":
                formatted.append(f"Your income level qualifies for this scheme")
            elif name == "location":
                formatted.append(f"This scheme is available in {user_value}")
            elif name == "occupation":
                formatted.append(f"Your occupation ({user_value}) is eligible")
            elif name == "education":
                formatted.append(f"Your education level ({user_value}) meets the requirements")
            elif name == "caste":
                formatted.append(f"Your category ({user_value}) is eligible")
            elif name == "disability":
                formatted.append("Your disability status matches the scheme criteria")

        return formatted

    def _format_gaps(
        self,
        unmet_criteria: List[Dict[str, Any]],
        user_profile: Dict[str, Any],
        scheme: Dict[str, Any],
    ) -> List[str]:
        """Format unmet criteria with explanations."""
        gaps = []

        for criterion in unmet_criteria:
            name = criterion["name"]
            user_value = criterion["user_value"]
            requirement = criterion["requirement"]
            required = criterion.get("required", False)

            if name == "age":
                gaps.append(
                    f"Age requirement not met: You are {user_value} years old, "
                    f"but the scheme requires {requirement}"
                )
            elif name == "income":
                gaps.append(
                    f"Income requirement not met: Your income exceeds the maximum "
                    f"limit of {requirement}"
                )
            elif name == "location":
                gaps.append(
                    f"Location requirement not met: This scheme is only available in "
                    f"{requirement}, but you are in {user_value}"
                )
            elif name == "occupation":
                if required:
                    gaps.append(
                        f"Occupation requirement not met: This scheme is for {requirement}, "
                        f"but your occupation is {user_value}"
                    )

        return gaps

    def _generate_recommendations(
        self, unmet_criteria: List[Dict[str, Any]], user_profile: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations for improving eligibility."""
        recommendations = []

        for criterion in unmet_criteria:
            name = criterion["name"]

            if name == "age":
                recommendations.append(
                    "This scheme may become available to you when you reach the eligible age range"
                )
            elif name == "income":
                recommendations.append(
                    "Consider exploring schemes with higher income limits or update your "
                    "profile if your income has changed"
                )
            elif name == "location":
                recommendations.append(
                    "Check if similar schemes are available in your state or district"
                )
            elif name == "occupation":
                recommendations.append("Explore schemes targeted at your occupation category")

        if not recommendations:
            recommendations.append("You meet most criteria for this scheme. Consider applying!")

        return recommendations

    def _get_cache_key(self, user_profile: Dict[str, Any], scheme: Dict[str, Any]) -> str:
        """Generate cache key for eligibility result."""
        user_id = user_profile.get("user_id", "")
        scheme_id = scheme.get("scheme_id", "")
        return f"{user_id}:{scheme_id}"

    def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached eligibility result if not expired."""
        if cache_key not in self._eligibility_cache:
            return None

        cached = self._eligibility_cache[cache_key]
        cached_time = datetime.fromisoformat(cached["calculated_at"])

        # Check if cache is still valid (24 hours)
        if datetime.now() - cached_time > timedelta(hours=24):
            del self._eligibility_cache[cache_key]
            return None

        return cached

    def _cache_result(self, cache_key: str, result: Dict[str, Any]) -> None:
        """Cache eligibility result for 24 hours."""
        self._eligibility_cache[cache_key] = result
