"""
User classification using Agglomerative Hierarchical Clustering

This module provides the UserClassifier class that groups users with similar
characteristics using Agglomerative Hierarchical Clustering, replacing the
previous DBSCAN approach which produced excessive noise points and poor
silhouette scores.
"""

import numpy as np
import pickle
from typing import Dict, List, Any, Optional, Tuple
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from datetime import datetime

try:
    from src.feature_extractor import FeatureExtractor
except ImportError:
    from feature_extractor import FeatureExtractor


def _find_optimal_clusters(X_scaled: np.ndarray, k_range: Tuple[int, int] = (3, 10)) -> int:
    """
    Find the optimal number of clusters using silhouette score.

    Args:
        X_scaled: Standardised feature matrix
        k_range: (min_k, max_k) range to evaluate (inclusive)

    Returns:
        Optimal k with highest silhouette score
    """
    best_k = k_range[0]
    best_score = -1.0

    for k in range(k_range[0], min(k_range[1] + 1, len(X_scaled))):
        clustering = AgglomerativeClustering(n_clusters=k, linkage="ward")
        labels = clustering.fit_predict(X_scaled)
        # silhouette_score requires at least 2 distinct labels
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(X_scaled, labels)
        if score > best_score:
            best_score = score
            best_k = k

    return best_k


class UserClassifier:
    """
    Classify users into groups using Agglomerative Hierarchical Clustering.

    Agglomerative clustering with Ward linkage is preferred over DBSCAN because:
    - Every user is assigned to a cluster (no noise points)
    - Deterministic results
    - Optimal k is selected automatically via silhouette score
    - Better suited for the sparse, diverse government-scheme user base
    """

    def __init__(self, n_clusters: Optional[int] = None, k_range: Tuple[int, int] = (3, 10)):
        """
        Initialise UserClassifier.

        Args:
            n_clusters: Fixed number of clusters. If None, the optimal k is
                        determined automatically from the training data.
            k_range: (min_k, max_k) range searched when n_clusters is None.
        """
        self.n_clusters = n_clusters
        self.k_range = k_range
        self.clustering: Optional[AgglomerativeClustering] = None
        self.scaler = StandardScaler()
        self.feature_extractor = FeatureExtractor()
        self.is_fitted = False
        self.cluster_metadata: Dict[int, Dict[str, Any]] = {}
        self._fitted_n_clusters: int = 0

    def train(self, profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train the classifier on user profiles.

        Args:
            profiles: List of user profile dictionaries

        Returns:
            Dictionary containing training metrics including silhouette score
        """
        if len(profiles) < 3:
            raise ValueError(f"Need at least 3 profiles to train, got {len(profiles)}")

        # Extract and standardise features
        features = [self.feature_extractor.extract_features(p) for p in profiles]
        X = np.array(features)
        X_scaled = self.scaler.fit_transform(X)

        # Determine number of clusters
        k = self.n_clusters or _find_optimal_clusters(X_scaled, self.k_range)
        k = min(k, len(profiles))  # cannot exceed sample count

        # Fit Agglomerative Clustering
        self.clustering = AgglomerativeClustering(n_clusters=k, linkage="ward")
        labels = self.clustering.fit_predict(X_scaled)
        self._fitted_n_clusters = k
        self.is_fitted = True

        # Compute silhouette score (quality metric)
        sil_score = float(silhouette_score(X_scaled, labels)) if len(set(labels)) > 1 else 0.0

        # Analyse and store cluster characteristics (including centroids for prediction)
        self.cluster_metadata = self._analyze_clusters(profiles, X_scaled, labels)

        return {
            "n_clusters": k,
            "silhouette_score": sil_score,
            "n_samples": len(profiles),
            "is_fitted": self.is_fitted,
            "timestamp": datetime.now().isoformat(),
        }

    def classify_user(
        self,
        profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Classify a user into the nearest cluster.

        Uses nearest-centroid assignment so new users can be classified without
        retraining. Every user is assigned to exactly one cluster (no noise).

        Args:
            profile: User profile dictionary

        Returns:
            Dictionary containing:
                - user_id: User identifier
                - groups: List with a single assigned cluster ID
                - confidence: Confidence score based on distance to centroid
                - features: Extracted feature vector
                - timestamp: Classification timestamp
        """
        if not self.is_fitted:
            raise ValueError("Classifier must be trained before classification")

        features = self.feature_extractor.extract_features(profile)
        features_scaled = self.scaler.transform(features.reshape(1, -1))

        best_cluster = 0
        min_dist = float("inf")

        for cluster_id, metadata in self.cluster_metadata.items():
            centroid = np.array(metadata["centroid"])
            dist = float(np.linalg.norm(features_scaled - centroid))
            if dist < min_dist:
                min_dist = dist
                best_cluster = cluster_id

        # Confidence inversely proportional to distance (max 1.0 at centroid)
        confidence = 1.0 / (1.0 + min_dist)

        return {
            "user_id": profile.get("user_id", "unknown"),
            "groups": [int(best_cluster)],
            "confidence": float(confidence),
            "features": features.tolist(),
            "timestamp": datetime.now().isoformat(),
        }

    def _analyze_clusters(
        self, profiles: List[Dict[str, Any]], features_scaled: np.ndarray, labels: np.ndarray
    ) -> Dict[int, Dict[str, Any]]:
        """
        Analyze cluster characteristics and compute metadata.

        Args:
            profiles: List of user profiles
            features_scaled: Scaled feature matrix
            labels: DBSCAN output labels

        Returns:
            Dictionary mapping cluster IDs to metadata
        """
        unique_labels = set(labels)
        cluster_info = {}

        for cluster_id in unique_labels:
            # Get profiles in this cluster
            mask = labels == cluster_id
            cluster_profiles = [p for p, m in zip(profiles, mask) if m]
            cluster_features = features_scaled[mask]

            # Compute centroid (mean of points in cluster)
            centroid = cluster_features.mean(axis=0).tolist()

            # Compute typical profile characteristics
            typical_profile = self._compute_typical_profile(cluster_profiles)

            # Compute feature statistics
            feature_stats = {
                "mean": centroid,
                "std": cluster_features.std(axis=0).tolist(),
                "min": cluster_features.min(axis=0).tolist(),
                "max": cluster_features.max(axis=0).tolist(),
            }

            cluster_info[int(cluster_id)] = {
                "size": len(cluster_profiles),
                "centroid": centroid,
                "typical_profile": typical_profile,
                "feature_stats": feature_stats,
            }

        return cluster_info

    def _compute_typical_profile(self, profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute typical characteristics of a cluster.

        Args:
            profiles: List of profiles in the cluster

        Returns:
            Dictionary of typical profile characteristics
        """
        if not profiles:
            return {}

        # Calculate age range
        ages = [p.get("age", 0) for p in profiles]
        age_range = [min(ages), max(ages)] if ages else [0, 0]

        # Calculate income range
        incomes = [p.get("annual_income", 0) for p in profiles]
        income_range = [min(incomes), max(incomes)] if incomes else [0, 0]

        # Find most common categorical values
        def most_common(values):
            if not values:
                return None
            return max(set(values), key=values.count)

        common_gender = most_common([p.get("gender", "") for p in profiles])
        common_marital = most_common([p.get("marital_status", "") for p in profiles])
        common_employment = most_common([p.get("employment_status", "") for p in profiles])
        common_education = most_common([p.get("education_level", "") for p in profiles])
        common_state = most_common([p.get("state", "") for p in profiles])
        common_rural_urban = most_common([p.get("rural_urban", "") for p in profiles])

        return {
            "age_range": age_range,
            "income_range": income_range,
            "common_gender": common_gender,
            "common_marital_status": common_marital,
            "common_employment_status": common_employment,
            "common_education_level": common_education,
            "common_state": common_state,
            "common_rural_urban": common_rural_urban,
            "member_count": len(profiles),
        }

    def _get_default_group_id(self) -> int:
        """
        Get the default group ID for low-confidence classifications.

        Returns:
            Default group ID (uses cluster 0 as default)
        """
        return 0

    def get_cluster_info(self, cluster_id: int) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific cluster.

        Args:
            cluster_id: Cluster identifier

        Returns:
            Cluster metadata dictionary or None if not found
        """
        return self.cluster_metadata.get(cluster_id)

    def get_all_clusters_info(self) -> Dict[int, Dict[str, Any]]:
        """
        Get metadata for all clusters.

        Returns:
            Dictionary mapping cluster IDs to metadata
        """
        return self.cluster_metadata

    def save_model(self, filepath: str) -> None:
        """
        Save the trained model to disk.

        Args:
            filepath: Path to save the model
        """
        if not self.is_fitted:
            raise ValueError("Cannot save unfitted model")

        model_data = {
            "clustering": self.clustering,
            "scaler": self.scaler,
            "n_clusters": self._fitted_n_clusters,
            "k_range": self.k_range,
            "cluster_metadata": self.cluster_metadata,
            "is_fitted": self.is_fitted,
        }

        with open(filepath, "wb") as f:
            pickle.dump(model_data, f)

    def load_model(self, filepath: str) -> None:
        """
        Load a trained model from disk.

        Args:
            filepath: Path to the saved model
        """
        with open(filepath, "rb") as f:
            model_data = pickle.load(f)

        self.clustering = model_data["clustering"]
        self.scaler = model_data["scaler"]
        self._fitted_n_clusters = model_data.get("n_clusters", 0)
        self.k_range = model_data.get("k_range", self.k_range)
        self.cluster_metadata = model_data["cluster_metadata"]
        self.is_fitted = model_data["is_fitted"]
