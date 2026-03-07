"""
Model Evaluation Framework

Unified evaluation for all PraharAI ML models:
  - Intent classifier: accuracy, precision, recall, F1, per-class report
  - User classifier: silhouette score, cluster quality
  - Recommendation ranker: NDCG@k

Can evaluate saved models against held-out data or generate a quick
benchmark with synthetic data.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    silhouette_score,
)

# Add src to path for model imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from user_classifier import UserClassifier  # noqa: E402
from feature_extractor import FeatureExtractor  # noqa: E402

INTENT_LABELS = [
    "scheme_search",
    "eligibility_check",
    "application_info",
    "deadline_query",
    "profile_update",
    "general_question",
    "nudge_preferences",
]


# ---------------------------------------------------------------------------
# Intent classifier evaluation
# ---------------------------------------------------------------------------


def evaluate_intent_classifier(
    model_path: str,
    val_data_path: str,
) -> Dict[str, Any]:
    """
    Evaluate a saved intent classifier on validation data.

    Args:
        model_path: Directory containing saved DistilBERT model
        val_data_path: JSON file with list of {query, intent} dicts

    Returns:
        Dict with accuracy, precision, recall, f1, per_class report
    """
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    print("\n── Intent Classifier Evaluation ──")

    with open(val_data_path) as f:
        val_data = json.load(f)
    print(f"  Loaded {len(val_data)} validation samples")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path).to(device)
    model.eval()

    preds = []
    labels = []
    for item in val_data:
        enc = tokenizer(
            item["query"], return_tensors="pt", truncation=True, max_length=128, padding=True
        ).to(device)
        with torch.no_grad():
            logits = model(**enc).logits
        pred_idx = torch.argmax(logits, dim=-1).item()
        preds.append(INTENT_LABELS[pred_idx])
        labels.append(item["intent"])

    accuracy = accuracy_score(labels, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels,
        preds,
        average="weighted",
        zero_division=0,
    )

    report_str = classification_report(
        labels,
        preds,
        target_names=INTENT_LABELS,
        zero_division=0,
    )
    print(f"\n  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1:        {f1:.4f}")
    print(f"\n{report_str}")

    return {
        "model": "intent_classifier",
        "model_path": model_path,
        "n_samples": len(val_data),
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "per_class": report_str,
    }


# ---------------------------------------------------------------------------
# User classifier evaluation
# ---------------------------------------------------------------------------


def evaluate_user_classifier(
    model_path: str,
    profiles_path: str,
) -> Dict[str, Any]:
    """
    Evaluate a saved user classifier (DBSCAN) on user profiles.

    Args:
        model_path: Path to saved .pkl model
        profiles_path: JSON file with user profiles

    Returns:
        Dict with silhouette_score, n_clusters, cluster sizes
    """
    print("\n── User Classifier Evaluation ──")

    with open(profiles_path) as f:
        profiles = json.load(f)
    print(f"  Loaded {len(profiles)} user profiles")

    classifier = UserClassifier()
    classifier.load_model(model_path)

    fe = FeatureExtractor()
    features = np.array([fe.extract_features(p) for p in profiles])
    X_scaled = classifier.scaler.transform(features)

    # Re-predict labels
    labels = classifier.dbscan.fit_predict(X_scaled)
    unique_labels = set(labels)
    n_clusters = len([l for l in unique_labels if l != -1])
    n_noise = int((labels == -1).sum())

    # Silhouette score needs ≥2 labels (excluding noise-only)
    non_noise_mask = labels != -1
    if non_noise_mask.sum() > 1 and n_clusters >= 2:
        sil = float(silhouette_score(X_scaled[non_noise_mask], labels[non_noise_mask]))
    else:
        sil = 0.0

    # Cluster size distribution
    unique, counts = np.unique(labels[labels != -1], return_counts=True)
    cluster_sizes = dict(zip(unique.astype(int).tolist(), counts.tolist()))

    print(f"  Clusters:        {n_clusters}")
    print(f"  Noise points:    {n_noise}")
    print(f"  Silhouette:      {sil:.4f}")
    if cluster_sizes:
        print(f"  Min cluster:     {min(cluster_sizes.values())}")
        print(f"  Max cluster:     {max(cluster_sizes.values())}")

    quality = "EXCELLENT" if sil > 0.7 else "GOOD" if sil > 0.5 else "FAIR" if sil > 0.3 else "POOR"
    print(f"  Quality:         {quality}")

    return {
        "model": "user_classifier",
        "model_path": model_path,
        "n_profiles": len(profiles),
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "silhouette_score": sil,
        "cluster_sizes": cluster_sizes,
        "quality": quality,
    }


# ---------------------------------------------------------------------------
# Recommendation ranker evaluation
# ---------------------------------------------------------------------------


def _dcg_at_k(scores: np.ndarray, k: int) -> float:
    scores = scores[:k]
    gains = 2.0**scores - 1.0
    discounts = np.log2(np.arange(len(scores)) + 2.0)
    return float(np.sum(gains / discounts))


def _ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, groups: List[int], k: int) -> float:
    ndcgs = []
    start = 0
    for g in groups:
        end = start + g
        true_s = y_true[start:end]
        pred_s = y_pred[start:end]
        order = np.argsort(-pred_s)
        sorted_true = true_s[order]
        actual = _dcg_at_k(sorted_true, k)
        ideal = _dcg_at_k(true_s[np.argsort(-true_s)], k)
        ndcgs.append(actual / ideal if ideal > 0 else 0.0)
        start = end
    return float(np.mean(ndcgs)) if ndcgs else 0.0


def evaluate_recommendation(
    model_path: str,
    users_path: str,
    schemes_path: str,
    interactions_path: str,
    k: int = 10,
) -> Dict[str, Any]:
    """
    Evaluate recommendation ranker on interaction data.

    Supports both XGBoost (.xgb) and heuristic JSON (.json) models.
    """
    print("\n── Recommendation Ranker Evaluation ──")

    with open(users_path) as f:
        users = json.load(f)
    with open(schemes_path) as f:
        schemes = json.load(f)
    with open(interactions_path) as f:
        interactions = json.load(f)

    # Reuse dataset builder from recommendation_trainer
    sys.path.insert(0, str(Path(__file__).parent))
    from recommendation_trainer import prepare_ltr_dataset, _build_features  # noqa: E402

    X, y, groups = prepare_ltr_dataset(users, schemes, interactions)
    if len(X) == 0:
        print("  No evaluation data available")
        return {"model": "recommendation", "error": "no data"}

    print(f"  {len(y)} samples, {len(groups)} groups")

    if model_path.endswith(".xgb"):
        import xgboost as xgb

        bst = xgb.Booster()
        bst.load_model(model_path)
        dtest = xgb.DMatrix(X)
        preds = bst.predict(dtest)
    elif model_path.endswith(".json"):
        with open(model_path) as f:
            model_data = json.load(f)
        weights = model_data.get("weights", {})
        w_arr = np.array(list(weights.values()))
        preds = X @ w_arr
    else:
        print(f"  Unknown model format: {model_path}")
        return {"model": "recommendation", "error": "unknown format"}

    ndcg_5 = _ndcg_at_k(y, preds, groups, k=5)
    ndcg_10 = _ndcg_at_k(y, preds, groups, k=k)

    print(f"  NDCG@5:  {ndcg_5:.4f}")
    print(f"  NDCG@10: {ndcg_10:.4f}")

    return {
        "model": "recommendation",
        "model_path": model_path,
        "n_samples": len(y),
        "n_groups": len(groups),
        "ndcg_5": ndcg_5,
        "ndcg_10": ndcg_10,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate PraharAI ML models")
    parser.add_argument(
        "--model",
        choices=["intent", "user", "recommendation", "all"],
        default="all",
        help="Which model to evaluate (default: all)",
    )
    parser.add_argument("--intent-model", default="models/intent_classifier")
    parser.add_argument("--intent-val", default="data/training/intent_val.json")
    parser.add_argument("--user-model", default="models/user_classifier.pkl")
    parser.add_argument("--user-profiles", default="data/training/users.json")
    parser.add_argument("--rec-model", default="models/recommendation_ranker.xgb")
    parser.add_argument("--rec-users", default="data/training/users.json")
    parser.add_argument("--rec-schemes", default="data/training/schemes.json")
    parser.add_argument("--rec-interactions", default="data/training/interactions.json")
    parser.add_argument("--output", default="models/evaluation_report.json")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    results: Dict[str, Any] = {}

    if args.model in ("intent", "all"):
        if os.path.isdir(args.intent_model) and os.path.exists(args.intent_val):
            results["intent"] = evaluate_intent_classifier(args.intent_model, args.intent_val)
        else:
            print(f"\n  Skipping intent eval — model or data not found")

    if args.model in ("user", "all"):
        if os.path.exists(args.user_model) and os.path.exists(args.user_profiles):
            results["user"] = evaluate_user_classifier(args.user_model, args.user_profiles)
        else:
            print(f"\n  Skipping user eval — model or data not found")

    if args.model in ("recommendation", "all"):
        rec_model = args.rec_model
        # Try XGBoost model first, fallback to heuristic JSON
        if not os.path.exists(rec_model):
            rec_model = rec_model.replace(".xgb", "_weights.json")
            if not os.path.exists(rec_model):
                rec_model = "models/recommendation_weights.json"
        if os.path.exists(rec_model) and os.path.exists(args.rec_interactions):
            results["recommendation"] = evaluate_recommendation(
                rec_model,
                args.rec_users,
                args.rec_schemes,
                args.rec_interactions,
            )
        else:
            print(f"\n  Skipping recommendation eval — model or data not found")

    # Save consolidated report
    if results:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n  Report saved to: {args.output}")

    print("\n" + "=" * 60)
    if not results:
        print("No models evaluated. Train models first.")
    else:
        print(f"Evaluated {len(results)} model(s).")
    print("=" * 60 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
