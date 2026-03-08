"""
Recommendation Engine for generating personalized scheme recommendations

This module provides the RecommendationEngine class that combines user
classification and eligibility scoring to generate ranked scheme recommendations.
"""

import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import os

# Optional: XGBoost for LTR
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

# Optional: LightGBM for LTR ensemble
try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False

try:
    from src.user_classifier import UserClassifier
    from src.eligibility_engine import EligibilityEngine
except ImportError:
    from user_classifier import UserClassifier
    from eligibility_engine import EligibilityEngine


class RecommendationEngine:
    """
    Generate personalized scheme recommendations using Learning to Rank (LTR).
    
    The engine:
    - Uses an XGBoost Gradient Boosted Tree to learn optimal ranking weights
    - Features inclusive of user groups, eligibility scores, and historical interactions
    - Ranks schemes by predicted likelihood of successful application
    """
    
    def __init__(
        self,
        user_classifier: UserClassifier,
        eligibility_engine: EligibilityEngine,
        model_path: Optional[str] = None
    ):
        """
        Initialize the recommendation engine.
        
        Args:
            user_classifier: Trained UserClassifier instance
            eligibility_engine: EligibilityEngine instance
            model_path: Path to trained XGBoost LTR model
        """
        self.user_classifier = user_classifier
        self.eligibility_engine = eligibility_engine
        self._recommendation_cache: Dict[str, Dict[str, Any]] = {}
        self._group_scheme_cache: Dict[int, List[str]] = {}

        # LTR Model Setup — XGBoost (primary) + LightGBM (secondary for ensemble)
        self.use_ltr = XGBOOST_AVAILABLE
        self.ranker = None
        self.lgb_ranker = None

        if model_path and os.path.exists(model_path):
            if XGBOOST_AVAILABLE:
                xgb_path = model_path if model_path.endswith(".model") else \
                    os.path.join(model_path, "xgb_ranker.model")
                if os.path.exists(xgb_path):
                    self.ranker = xgb.Booster()
                    self.ranker.load_model(xgb_path)

            if LIGHTGBM_AVAILABLE:
                lgb_path = os.path.join(
                    os.path.dirname(model_path), "lgb_ranker.txt"
                )
                if os.path.exists(lgb_path):
                    self.lgb_ranker = lgb.Booster(model_file=lgb_path)

        # Scoring weights (fallback if neither LTR model is available)
        self.group_relevance_weight = 0.4
        self.eligibility_weight = 0.6
    
    def generate_recommendations(
        self,
        user_profile: Dict[str, Any],
        schemes: List[Dict[str, Any]],
        min_recommendations: int = 5,
        max_recommendations: int = 20,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized scheme recommendations for a user.
        
        Args:
            user_profile: Dictionary containing user profile data
            schemes: List of available schemes
            min_recommendations: Minimum number of recommendations (default: 5)
            max_recommendations: Maximum number of recommendations (default: 20)
            use_cache: Whether to use cached recommendations (default: True)
            
        Returns:
            List of recommendation dictionaries, each containing:
                - scheme_id: Scheme identifier
                - scheme_name: Scheme name
                - relevance_score: Combined score (0.0 to 1.0)
                - eligibility_score: Eligibility percentage (0-100)
                - matching_criteria: List of met criteria
                - explanation: Natural language explanation
                - rank: Recommendation rank (1-based)
        """
        user_id = user_profile.get('user_id', '')
        
        # Check cache first
        if use_cache:
            cached = self._get_cached_recommendations(user_id)
            if cached:
                return cached[:max_recommendations]
        
        # Step 1: Classify user into groups
        classification = self.user_classifier.classify_user(user_profile)
        user_groups = classification['groups']
        
        # Step 2: Retrieve candidate schemes for user's groups
        candidate_schemes = self._get_candidate_schemes(user_groups, schemes)
        
        # Note: We don't enforce min_recommendations if we have fewer unique schemes
        # It's better to return fewer unique recommendations than duplicate schemes
        
        # Step 3: Calculate eligibility scores for all candidates
        eligibility_results = self.eligibility_engine.batch_calculate_eligibility(
            user_profile,
            candidate_schemes
        )
        
        # Step 4: Rank candidates — LTR models if available, else rich heuristic
        scored_schemes = []

        if (self.use_ltr and self.ranker) or (LIGHTGBM_AVAILABLE and self.lgb_ranker):
            scored_schemes = self._rank_with_ltr(
                candidate_schemes,
                eligibility_results,
                user_profile,
                user_groups
            )
        else:
            # Heuristic fallback using the 12-feature vector (first two features)
            for i, scheme in enumerate(candidate_schemes):
                eligibility = eligibility_results[i]
                feats = self._build_ranking_features(
                    scheme, eligibility, user_profile, user_groups
                )
                # Weighted sum: eligibility (0.45) + state_match (0.20) +
                #               category_match (0.10) + group_rel (0.15) +
                #               popularity (0.05) + age_range (0.05)
                combined_score = (
                    0.45 * feats[0] +
                    0.20 * feats[2] +
                    0.10 * feats[4] +
                    0.15 * feats[5] +
                    0.05 * feats[6] +
                    0.05 * feats[7]
                )
                scored_schemes.append({
                    "scheme": scheme,
                    "eligibility": eligibility,
                    "group_relevance": feats[5],
                    "combined_score": combined_score,
                })
            scored_schemes.sort(key=lambda x: x["combined_score"], reverse=True)
        
        # Step 6: Take top N recommendations (between min and max)
        num_recommendations = min(
            max(min_recommendations, len(scored_schemes)),
            max_recommendations
        )
        top_schemes = scored_schemes[:num_recommendations]
        
        # Step 7: Generate explanations for each recommendation
        recommendations = []
        for rank, item in enumerate(top_schemes, start=1):
            explanation = self._generate_explanation(
                item['scheme'],
                item['eligibility'],
                user_profile
            )
            
            recommendations.append({
                'scheme_id': item['scheme'].get('scheme_id', ''),
                'scheme_name': item['scheme'].get('scheme_name', ''),
                'relevance_score': float(item['combined_score']),
                'eligibility_score': float(item['eligibility']['percentage']),
                'matching_criteria': [
                    c['name'] for c in item['eligibility']['met_criteria']
                ],
                'explanation': explanation,
                'rank': rank,
                'generated_at': datetime.now().isoformat()
            })
        
        # Cache recommendations for 24 hours
        self._cache_recommendations(user_id, recommendations)
        
        return recommendations
    
    def _build_ranking_features(
        self,
        scheme: Dict[str, Any],
        eligibility: Dict[str, Any],
        profile: Dict[str, Any],
        groups: List[int],
    ) -> List[float]:
        """
        Build a 12-feature vector for learning-to-rank models.

        Features (in order):
         0  eligibility_score        — ML eligibility percentage [0,1]
         1  met_criteria_count       — number of eligibility criteria met [0,1 normalised]
         2  state_match              — 1 if scheme available in user's state
         3  state_specific           — 1 if scheme is state-specific (not central)
         4  category_match           — 1 if scheme category matches user occupation
         5  group_relevance          — heuristic group relevance [0,1]
         6  scheme_popularity        — prior popularity signal [0,1]
         7  age_in_range             — 1 if user age within scheme age bounds
         8  income_within_limit      — 1 if user income ≤ scheme income limit
         9  description_length_score — longer description ≈ richer scheme info [0,1]
        10  tag_overlap              — fraction of scheme tags matching profile keywords
        11  is_central_scheme        — 1 if national/central scheme (broader reach)
        """
        elig_score = eligibility.get("score", eligibility.get("percentage", 50) / 100.0)
        met = eligibility.get("met_criteria", [])
        total_criteria = max(len(eligibility.get("criteria", met)) or 1, 1)

        state_match = 1.0 if (
            profile.get("state") and
            profile["state"].lower() in (scheme.get("state") or "").lower()
        ) else 0.0

        state_specific = 0.0 if (
            not scheme.get("state") or
            scheme.get("state", "").lower() in ("", "all", "national", "central")
        ) else 1.0

        # Category / occupation match
        occ = (profile.get("employment") or profile.get("occupation") or "").lower()
        scheme_cat = (scheme.get("category") or scheme.get("tags") or "")
        if isinstance(scheme_cat, list):
            scheme_cat = " ".join(scheme_cat)
        category_match = 1.0 if occ and occ in scheme_cat.lower() else 0.0

        group_relevance = self._calculate_group_relevance(
            scheme.get("scheme_id", scheme.get("schemeId", "")), groups
        )

        popularity = float(scheme.get("popularity", 0.5))

        # Age range fit
        age = profile.get("age", 0) or 0
        min_age = scheme.get("minAge", scheme.get("min_age", 0)) or 0
        max_age = scheme.get("maxAge", scheme.get("max_age", 120)) or 120
        age_in_range = 1.0 if (min_age <= age <= max_age) else 0.0

        # Income limit fit
        income = profile.get("income", profile.get("annual_income", 0)) or 0
        income_limit = scheme.get("incomeLimit", scheme.get("income_limit", 0)) or 0
        income_within = 1.0 if (income_limit == 0 or income <= income_limit) else 0.0

        desc = scheme.get("description") or scheme.get("scheme_description") or ""
        desc_score = min(len(desc) / 500.0, 1.0)

        profile_keywords = {
            occ,
            (profile.get("state") or "").lower(),
            (profile.get("education") or "").lower(),
        } - {""}
        tags = scheme.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        tag_lower = {t.lower() for t in tags}
        tag_overlap = (
            len(profile_keywords & tag_lower) / max(len(profile_keywords), 1)
        )

        scheme_name_lower = (scheme.get("name") or scheme.get("scheme_name") or "").lower()
        is_central = 1.0 if any(
            kw in scheme_name_lower for kw in ("pradhan mantri", "pm ", "national", "central")
        ) else 0.0

        return [
            float(elig_score),
            float(len(met)) / float(total_criteria),
            state_match,
            state_specific,
            category_match,
            float(group_relevance),
            popularity,
            age_in_range,
            income_within,
            desc_score,
            float(tag_overlap),
            is_central,
        ]

    def _rank_with_ltr(
        self,
        schemes: List[Dict[str, Any]],
        eligibility: List[Dict[str, Any]],
        profile: Dict[str, Any],
        groups: List[int]
    ) -> List[Dict[str, Any]]:
        """Rank candidates using XGBoost + LightGBM ensemble (or XGBoost alone)."""
        feature_matrix = [
            self._build_ranking_features(schemes[i], eligibility[i], profile, groups)
            for i in range(len(schemes))
        ]
        arr = np.array(feature_matrix, dtype=np.float32)

        xgb_scores = np.zeros(len(schemes))
        lgb_scores = np.zeros(len(schemes))
        weights = (0.0, 0.0)

        if self.ranker and XGBOOST_AVAILABLE:
            dtest = xgb.DMatrix(arr)
            xgb_scores = np.array(self.ranker.predict(dtest), dtype=np.float32)
            weights = (0.6, 0.0)

        if self.lgb_ranker and LIGHTGBM_AVAILABLE:
            lgb_scores = np.array(self.lgb_ranker.predict(arr), dtype=np.float32)
            weights = (0.5, 0.5) if weights[0] > 0 else (0.0, 1.0)

        # Fall back to heuristic weighted sum if no trained model is available
        if weights == (0.0, 0.0):
            heuristic = np.array([f[0] * 0.6 + f[5] * 0.4 for f in feature_matrix])
            final_scores = heuristic
        else:
            final_scores = weights[0] * xgb_scores + weights[1] * lgb_scores

        results = []
        for i, score in enumerate(final_scores):
            results.append({
                "scheme": schemes[i],
                "eligibility": eligibility[i],
                "group_relevance": feature_matrix[i][5],
                "combined_score": float(score),
            })

        results.sort(key=lambda x: x["combined_score"], reverse=True)
        return results

    def _get_candidate_schemes(
        self,
        user_groups: List[int],
        all_schemes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Retrieve schemes relevant to user's groups.
        
        Args:
            user_groups: List of group IDs the user belongs to
            all_schemes: List of all available schemes
            
        Returns:
            List of unique candidate schemes (deduplicated by scheme_id)
        """
        # Deduplicate schemes by scheme_id
        seen_ids = set()
        unique_schemes = []
        
        for scheme in all_schemes:
            scheme_id = scheme.get('scheme_id', '')
            if scheme_id not in seen_ids:
                seen_ids.add(scheme_id)
                unique_schemes.append(scheme)
        
        # For now, return all unique schemes as candidates
        # In production, this would filter based on pre-computed group-scheme mappings
        return unique_schemes
    
    def _calculate_group_relevance(
        self,
        scheme_id: str,
        user_groups: List[int]
    ) -> float:
        """
        Calculate how relevant a scheme is to user's groups.
        
        Args:
            scheme_id: Scheme identifier
            user_groups: List of group IDs
            
        Returns:
            Relevance score (0.0 to 1.0)
        """
        # For now, return a baseline relevance score
        # In production, this would use pre-computed group-scheme relevance scores
        # based on historical data and scheme characteristics
        
        # Simple heuristic: schemes are more relevant if user is in multiple groups
        # that typically match this scheme
        base_relevance = 0.5
        group_bonus = min(len(user_groups) * 0.1, 0.5)
        
        return min(base_relevance + group_bonus, 1.0)
    
    def _generate_explanation(
        self,
        scheme: Dict[str, Any],
        eligibility: Dict[str, Any],
        user_profile: Dict[str, Any]
    ) -> str:
        """
        Generate natural language explanation for recommendation.
        
        Args:
            scheme: Scheme dictionary
            eligibility: Eligibility result dictionary
            user_profile: User profile dictionary
            
        Returns:
            Natural language explanation string
        """
        reasons = []
        
        # Get top 3 matching criteria
        met_criteria = eligibility.get('met_criteria', [])
        top_criteria = sorted(
            met_criteria,
            key=lambda c: c.get('weight', 0),
            reverse=True
        )[:3]
        
        # Format each criterion
        for criterion in top_criteria:
            name = criterion['name']
            user_value = criterion['user_value']
            
            if name == 'age':
                reasons.append(f"your age ({user_value} years) matches the requirements")
            elif name == 'income':
                reasons.append("your income level qualifies")
            elif name == 'location':
                reasons.append(f"this scheme is available in {user_value}")
            elif name == 'occupation':
                reasons.append(f"your occupation ({user_value}) is eligible")
            elif name == 'education':
                reasons.append(f"your education level ({user_value}) meets the criteria")
            elif name == 'caste':
                reasons.append(f"your category ({user_value}) is eligible")
            elif name == 'disability':
                reasons.append("your disability status matches the criteria")
        
        # Build explanation
        if reasons:
            explanation = "This scheme is recommended because " + ", ".join(reasons)
        else:
            explanation = "This scheme matches your profile"
        
        # Add eligibility context
        percentage = eligibility.get('percentage', 0)
        category = eligibility.get('category', '')
        
        if category == 'highly_eligible':
            explanation += f". You are highly eligible with a {percentage:.1f}% match."
        elif category == 'potentially_eligible':
            explanation += f". You meet most criteria with a {percentage:.1f}% match."
        else:
            explanation += f". You have a {percentage:.1f}% match."
        
        return explanation
    
    def invalidate_cache(self, user_id: str) -> None:
        """
        Invalidate cached recommendations for a user.
        
        Should be called when user profile is updated.
        
        Args:
            user_id: User identifier
        """
        if user_id in self._recommendation_cache:
            del self._recommendation_cache[user_id]
    
    def _get_cached_recommendations(
        self,
        user_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieve cached recommendations if not expired.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of recommendations or None if cache miss/expired
        """
        if user_id not in self._recommendation_cache:
            return None
        
        cached = self._recommendation_cache[user_id]
        cached_time = datetime.fromisoformat(cached['timestamp'])
        
        # Check if cache is still valid (24 hours)
        if datetime.now() - cached_time > timedelta(hours=24):
            del self._recommendation_cache[user_id]
            return None
        
        return cached['recommendations']
    
    def _cache_recommendations(
        self,
        user_id: str,
        recommendations: List[Dict[str, Any]]
    ) -> None:
        """
        Cache recommendations for 24 hours.
        
        Args:
            user_id: User identifier
            recommendations: List of recommendations to cache
        """
        self._recommendation_cache[user_id] = {
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }
