"""
Training script for UserClassifier model

This script loads user profiles, trains the K-Means classifier,
evaluates the model using silhouette score, and saves the trained model.
"""

import sys
import os
import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import numpy as np
from sklearn.metrics import silhouette_score

from user_classifier import UserClassifier


def load_profiles_from_json(filepath: str) -> List[Dict[str, Any]]:
    """
    Load user profiles from JSON file.

    Args:
        filepath: Path to JSON file containing user profiles

    Returns:
        List of user profile dictionaries
    """
    with open(filepath, "r") as f:
        data = json.load(f)

    # Handle both list and dict with 'profiles' key
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "profiles" in data:
        return data["profiles"]
    else:
        raise ValueError("JSON file must contain a list of profiles or dict with 'profiles' key")


def generate_sample_profiles(n_profiles: int = 1000) -> List[Dict[str, Any]]:
    """
    Generate sample user profiles for training.

    Args:
        n_profiles: Number of profiles to generate

    Returns:
        List of user profile dictionaries
    """
    profiles = []

    states = [
        "Maharashtra",
        "Karnataka",
        "Tamil Nadu",
        "Delhi",
        "Gujarat",
        "Uttar Pradesh",
        "West Bengal",
        "Rajasthan",
        "Madhya Pradesh",
        "Bihar",
    ]
    genders = ["male", "female", "other"]
    marital_statuses = ["single", "married", "divorced", "widowed"]
    employment_statuses = ["employed", "self_employed", "unemployed", "student", "retired"]
    education_levels = [
        "no_formal",
        "primary",
        "secondary",
        "higher_secondary",
        "graduate",
        "postgraduate",
    ]
    castes = ["general", "obc", "sc", "st", "other"]
    rural_urban = ["rural", "urban", "semi_urban"]

    np.random.seed(42)

    for i in range(n_profiles):
        profile = {
            "user_id": f"user-{i:06d}",
            "age": int(np.random.normal(35, 15)),  # Mean 35, std 15
            "gender": np.random.choice(genders),
            "marital_status": np.random.choice(marital_statuses),
            "family_size": int(np.random.exponential(2)) + 1,  # Exponential distribution
            "annual_income": int(np.random.lognormal(13, 1)),  # Log-normal distribution
            "employment_status": np.random.choice(employment_statuses),
            "state": np.random.choice(states),
            "rural_urban": np.random.choice(rural_urban),
            "education_level": np.random.choice(education_levels),
            "caste": np.random.choice(castes),
            "disability": np.random.random() < 0.05,  # 5% disability rate
        }

        # Clamp values to valid ranges
        profile["age"] = max(18, min(100, profile["age"]))
        profile["family_size"] = max(1, min(10, profile["family_size"]))
        profile["annual_income"] = max(0, min(10000000, profile["annual_income"]))

        profiles.append(profile)

    return profiles


def evaluate_clustering(
    classifier: UserClassifier, profiles: List[Dict[str, Any]]
) -> Dict[str, float]:
    """
    Evaluate clustering quality using silhouette score.

    Args:
        classifier: Trained UserClassifier
        profiles: List of user profiles used for training

    Returns:
        Dictionary containing evaluation metrics
    """
    # Extract features
    features = [classifier.feature_extractor.extract_features(p) for p in profiles]
    X = np.array(features)

    # Scale features
    X_scaled = classifier.scaler.transform(X)

    # Get cluster labels from DBSCAN
    labels = classifier.dbscan.fit_predict(X_scaled)

    # Separate noise vs cluster labels
    unique_labels = set(labels)
    n_clusters = len([l for l in unique_labels if l != -1])
    n_noise = int((labels == -1).sum())

    # Calculate silhouette score (needs ≥2 non-noise clusters)
    non_noise_mask = labels != -1
    if non_noise_mask.sum() > 1 and n_clusters >= 2:
        silhouette = silhouette_score(X_scaled[non_noise_mask], labels[non_noise_mask])
    else:
        silhouette = 0.0

    # Calculate cluster sizes (excluding noise)
    cluster_labels = labels[labels != -1]
    if len(cluster_labels) > 0:
        unique_cls, counts = np.unique(cluster_labels, return_counts=True)
        cluster_sizes = dict(zip(unique_cls.tolist(), counts.tolist()))
    else:
        unique_cls, counts = np.array([]), np.array([0])
        cluster_sizes = {}

    return {
        "silhouette_score": float(silhouette),
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "n_samples": len(profiles),
        "cluster_sizes": cluster_sizes,
        "min_cluster_size": int(counts.min()) if len(counts) > 0 else 0,
        "max_cluster_size": int(counts.max()) if len(counts) > 0 else 0,
        "avg_cluster_size": float(counts.mean()) if len(counts) > 0 else 0.0,
    }


def print_training_summary(
    training_metrics: Dict[str, Any], evaluation_metrics: Dict[str, float], model_path: str
):
    """
    Print a summary of training results.

    Args:
        training_metrics: Metrics from training
        evaluation_metrics: Metrics from evaluation
        model_path: Path where model was saved
    """
    print("\n" + "=" * 70)
    print("USER CLASSIFIER TRAINING SUMMARY")
    print("=" * 70)

    print("\nTraining Configuration:")
    print(
        f"  Clustering: DBSCAN (eps={training_metrics['eps']}, min_samples={training_metrics['min_samples']})"
    )
    print(f"  Number of clusters: {training_metrics['n_clusters']}")
    print(f"  Noise points: {training_metrics['n_noise']}")
    print(f"  Number of samples: {training_metrics['n_samples']}")
    print(f"  Training timestamp: {training_metrics['timestamp']}")

    print("\nClustering Quality Metrics:")
    print(f"  Silhouette Score: {evaluation_metrics['silhouette_score']:.4f}")
    print(f"    (Range: -1 to 1, higher is better)")
    print(f"    (>0.5 = good, >0.7 = excellent)")

    print("\nCluster Distribution:")
    print(f"  Minimum cluster size: {evaluation_metrics['min_cluster_size']}")
    print(f"  Maximum cluster size: {evaluation_metrics['max_cluster_size']}")
    print(f"  Average cluster size: {evaluation_metrics['avg_cluster_size']:.1f}")

    print("\nModel Saved:")
    print(f"  Path: {model_path}")

    print("\n" + "=" * 70)

    # Interpretation
    silhouette = evaluation_metrics["silhouette_score"]
    if silhouette > 0.7:
        quality = "EXCELLENT"
    elif silhouette > 0.5:
        quality = "GOOD"
    elif silhouette > 0.3:
        quality = "FAIR"
    else:
        quality = "POOR"

    print(f"\nOverall Clustering Quality: {quality}")

    if silhouette < 0.5:
        print("\nRecommendations:")
        print("  - Consider adjusting the number of clusters")
        print("  - Ensure training data has sufficient diversity")
        print("  - Check for data quality issues")

    print("=" * 70 + "\n")


def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description="Train UserClassifier model for user grouping")
    parser.add_argument(
        "--input",
        type=str,
        help="Path to JSON file containing user profiles (optional, generates sample data if not provided)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/user_classifier.pkl",
        help="Path to save trained model (default: models/user_classifier.pkl)",
    )
    parser.add_argument(
        "--eps",
        type=float,
        default=0.5,
        help="DBSCAN eps (max distance between neighbours, default: 0.5)",
    )
    parser.add_argument(
        "--min-samples", type=int, default=5, help="DBSCAN min_samples (default: 5)"
    )
    parser.add_argument(
        "--n-samples",
        type=int,
        default=1000,
        help="Number of sample profiles to generate if no input file (default: 1000)",
    )

    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("USER CLASSIFIER TRAINING")
    print("=" * 70 + "\n")

    # Load or generate profiles
    if args.input:
        print(f"Loading profiles from: {args.input}")
        profiles = load_profiles_from_json(args.input)
        print(f"Loaded {len(profiles)} profiles")
    else:
        print(f"Generating {args.n_samples} sample profiles...")
        profiles = generate_sample_profiles(args.n_samples)
        print(f"Generated {len(profiles)} profiles")

    # Validate minimum profiles
    if len(profiles) < args.min_samples:
        print(f"\nERROR: Need at least {args.min_samples} profiles for DBSCAN min_samples")
        print(f"Got only {len(profiles)} profiles")
        sys.exit(1)

    # Initialize classifier
    print(
        f"\nInitializing UserClassifier (DBSCAN eps={args.eps}, min_samples={args.min_samples})..."
    )
    classifier = UserClassifier(eps=args.eps, min_samples=args.min_samples)

    # Train classifier
    print("Training DBSCAN classifier...")
    training_metrics = classifier.train(profiles)
    print("Training complete!")

    # Evaluate clustering
    print("\nEvaluating clustering quality...")
    evaluation_metrics = evaluate_clustering(classifier, profiles)

    # Create output directory if needed
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save model
    print(f"\nSaving model to: {args.output}")
    classifier.save_model(args.output)

    # Save metrics
    metrics_path = output_path.with_suffix(".json")
    metrics = {
        "training": training_metrics,
        "evaluation": evaluation_metrics,
        "config": {
            "eps": args.eps,
            "min_samples": args.min_samples,
            "n_samples": len(profiles),
        },
    }

    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to: {metrics_path}")

    # Print summary
    print_training_summary(training_metrics, evaluation_metrics, args.output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
