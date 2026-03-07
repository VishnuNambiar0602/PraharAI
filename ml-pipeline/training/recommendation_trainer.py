"""
Recommendation Trainer

Trains an XGBoost Learning-to-Rank (LTR) model for scheme recommendation.
Uses user-scheme interaction data produced by data_extractor.py to learn
optimal ranking weights.

If XGBoost is unavailable, falls back to a simple heuristic scoring model
saved as JSON weights.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

import numpy as np
from sklearn.model_selection import GroupKFold

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from feature_extractor import FeatureExtractor  # noqa: E402

# Optional XGBoost
try:
    import xgboost as xgb

    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

_fe = FeatureExtractor()


def _build_features(
    user: Dict[str, Any],
    scheme: Dict[str, Any],
) -> np.ndarray:
    """
    Build a feature vector for a (user, scheme) pair.

    Features:
      0   - user age (normalized)
      1   - user income (normalized)
      2   - user family size (normalized)
      3   - state match (1 if user.state == scheme.state)
      4   - n_categories (scheme)
      5   - n_tags (scheme)
      6-9 - category overlap indicators (age_group, income_level, occupation, social_category)
    """
    u_age = _fe.normalize_age(user.get("age", 30))
    u_income = _fe.normalize_income(user.get("annual_income", 0))
    u_family = _fe.normalize_family_size(user.get("family_size", 1))

    state_match = (
        1.0
        if (scheme.get("state", "") and user.get("state", "") == scheme.get("state", ""))
        else 0.0
    )

    categories = scheme.get("categories", [])
    n_cats = len(categories) / 5.0  # normalize roughly
    tags_raw = scheme.get("tags", "[]")
    if isinstance(tags_raw, str):
        try:
            n_tags = len(json.loads(tags_raw)) / 4.0
        except (json.JSONDecodeError, TypeError):
            n_tags = 0.0
    else:
        n_tags = len(tags_raw) / 4.0

    # category overlap signals
    cat_types_present = {c["type"] for c in categories if isinstance(c, dict)}
    overlap = [
        1.0 if "age_group" in cat_types_present else 0.0,
        1.0 if "income_level" in cat_types_present else 0.0,
        1.0 if "occupation" in cat_types_present else 0.0,
        1.0 if "social_category" in cat_types_present else 0.0,
    ]

    return np.array([u_age, u_income, u_family, state_match, n_cats, n_tags] + overlap)


def _action_to_relevance(action: str) -> int:
    """Map interaction action to a relevance grade for LTR."""
    return {"APPLIED": 3, "BOOKMARKED": 2, "VIEWED": 1}.get(action, 0)


# ---------------------------------------------------------------------------
# Dataset assembly
# ---------------------------------------------------------------------------


def prepare_ltr_dataset(
    users: List[Dict[str, Any]],
    schemes: List[Dict[str, Any]],
    interactions: List[Dict[str, Any]],
) -> tuple:
    """
    Build X (features), y (relevance grades), groups (query group sizes)
    suitable for XGBoost ranker.

    Each "group" is one user — we rank all schemes for that user.
    """
    user_map = {u["user_id"]: u for u in users}
    scheme_map = {s["scheme_id"]: s for s in schemes}

    # Build interaction lookup: user_id -> {scheme_id: best_action}
    inter_lookup: Dict[str, Dict[str, str]] = {}
    for inter in interactions:
        uid = inter["user_id"]
        sid = inter["scheme_id"]
        action = inter["action"]
        prev = inter_lookup.setdefault(uid, {}).get(sid)
        if prev is None or _action_to_relevance(action) > _action_to_relevance(prev):
            inter_lookup[uid][sid] = action

    X_list: List[np.ndarray] = []
    y_list: List[int] = []
    groups: List[int] = []
    scheme_ids = list(scheme_map.keys())

    for uid, uid_interactions in inter_lookup.items():
        user = user_map.get(uid)
        if user is None:
            continue
        group_size = 0
        for sid in scheme_ids:
            scheme = scheme_map.get(sid)
            if scheme is None:
                continue
            feats = _build_features(user, scheme)
            relevance = _action_to_relevance(uid_interactions.get(sid, ""))
            X_list.append(feats)
            y_list.append(relevance)
            group_size += 1
        if group_size > 0:
            groups.append(group_size)

    return np.array(X_list), np.array(y_list), groups


# ---------------------------------------------------------------------------
# Heuristic fallback (when XGBoost is missing)
# ---------------------------------------------------------------------------


def train_heuristic_weights(
    users: List[Dict[str, Any]],
    schemes: List[Dict[str, Any]],
    interactions: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Learn simple linear weights via logistic-style scoring.
    Returns a JSON-serialisable dict of feature name → weight.
    """
    X, y, _ = prepare_ltr_dataset(users, schemes, interactions)
    if len(X) == 0:
        return _default_weights()

    # Binary: relevant (y > 0) vs irrelevant
    y_bin = (y > 0).astype(float)

    # Per-feature correlation with relevance → use as weight
    feature_names = [
        "age_norm",
        "income_norm",
        "family_norm",
        "state_match",
        "n_categories",
        "n_tags",
        "cat_age_group",
        "cat_income_level",
        "cat_occupation",
        "cat_social_category",
    ]
    weights: Dict[str, float] = {}
    for i, name in enumerate(feature_names):
        col = X[:, i]
        if col.std() == 0:
            weights[name] = 0.0
        else:
            corr = float(np.corrcoef(col, y_bin)[0, 1])
            weights[name] = max(0.0, corr)  # clamp negatives

    # Normalize so weights sum to 1
    total = sum(weights.values()) or 1.0
    weights = {k: round(v / total, 4) for k, v in weights.items()}
    return weights


def _default_weights() -> Dict[str, float]:
    return {
        "age_norm": 0.05,
        "income_norm": 0.10,
        "family_norm": 0.05,
        "state_match": 0.25,
        "n_categories": 0.10,
        "n_tags": 0.05,
        "cat_age_group": 0.10,
        "cat_income_level": 0.10,
        "cat_occupation": 0.10,
        "cat_social_category": 0.10,
    }


# ---------------------------------------------------------------------------
# NDCG evaluation
# ---------------------------------------------------------------------------


def dcg_at_k(scores: np.ndarray, k: int) -> float:
    scores = scores[:k]
    gains = 2.0**scores - 1.0
    discounts = np.log2(np.arange(len(scores)) + 2.0)
    return float(np.sum(gains / discounts))


def ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, groups: List[int], k: int = 10) -> float:
    """Compute mean NDCG@k across query groups."""
    ndcgs = []
    start = 0
    for g in groups:
        end = start + g
        true_slice = y_true[start:end]
        pred_slice = y_pred[start:end]

        # Sort by predicted score descending
        order = np.argsort(-pred_slice)
        sorted_true = true_slice[order]

        actual_dcg = dcg_at_k(sorted_true, k)
        ideal_order = np.argsort(-true_slice)
        ideal_dcg = dcg_at_k(true_slice[ideal_order], k)

        ndcgs.append(actual_dcg / ideal_dcg if ideal_dcg > 0 else 0.0)
        start = end

    return float(np.mean(ndcgs)) if ndcgs else 0.0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Train a recommendation ranking model")
    parser.add_argument("--users", default="data/training/users.json")
    parser.add_argument("--schemes", default="data/training/schemes.json")
    parser.add_argument("--interactions", default="data/training/interactions.json")
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--n-estimators", type=int, default=100)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    np.random.seed(args.seed)
    out = args.output_dir
    Path(out).mkdir(parents=True, exist_ok=True)

    # Load data
    print("\n" + "=" * 60)
    print("RECOMMENDATION TRAINER")
    print("=" * 60)

    print(f"\nLoading data ...")
    with open(args.users) as f:
        users = json.load(f)
    with open(args.schemes) as f:
        schemes = json.load(f)
    with open(args.interactions) as f:
        interactions = json.load(f)
    print(f"  {len(users)} users, {len(schemes)} schemes, {len(interactions)} interactions")

    # Build dataset
    print("\nBuilding feature matrix ...")
    X, y, groups = prepare_ltr_dataset(users, schemes, interactions)
    print(f"  Matrix shape: {X.shape}, {len(groups)} query groups")

    if len(X) == 0:
        print("ERROR: No valid training samples. Check data files.")
        return 1

    if XGBOOST_AVAILABLE:
        print("\nTraining XGBoost LambdaMART ranker ...")
        model_path = _train_xgboost(X, y, groups, args, out)
    else:
        print("\nXGBoost not available — training heuristic weights ...")
        model_path = _train_heuristic(users, schemes, interactions, out)

    print(f"\nModel saved to: {model_path}")
    print("=" * 60 + "\n")
    return 0


def _train_xgboost(
    X: np.ndarray,
    y: np.ndarray,
    groups: List[int],
    args,
    out: str,
) -> str:
    """Train XGBoost ranker and return model path."""
    dtrain = xgb.DMatrix(X, label=y)
    dtrain.set_group(groups)

    params = {
        "objective": "rank:ndcg",
        "eval_metric": "ndcg@10",
        "max_depth": args.max_depth,
        "learning_rate": args.learning_rate,
        "seed": args.seed,
        "verbosity": 1,
    }

    bst = xgb.train(
        params,
        dtrain,
        num_boost_round=args.n_estimators,
        evals=[(dtrain, "train")],
        verbose_eval=10,
    )

    model_path = os.path.join(out, "recommendation_ranker.xgb")
    bst.save_model(model_path)

    # Evaluate on training set
    preds = bst.predict(dtrain)
    train_ndcg = ndcg_at_k(y, preds, groups, k=10)
    print(f"\n  Train NDCG@10: {train_ndcg:.4f}")

    # Save metrics
    metrics = {
        "model_type": "xgboost_lambdamart",
        "n_estimators": args.n_estimators,
        "max_depth": args.max_depth,
        "learning_rate": args.learning_rate,
        "train_ndcg_10": train_ndcg,
        "n_samples": len(y),
        "n_groups": len(groups),
        "trained_at": datetime.now().isoformat(),
    }
    with open(os.path.join(out, "recommendation_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    return model_path


def _train_heuristic(
    users: List[Dict[str, Any]],
    schemes: List[Dict[str, Any]],
    interactions: List[Dict[str, Any]],
    out: str,
) -> str:
    """Train simple heuristic weights and return model path."""
    weights = train_heuristic_weights(users, schemes, interactions)

    model_path = os.path.join(out, "recommendation_weights.json")
    with open(model_path, "w") as f:
        json.dump(
            {
                "model_type": "heuristic_linear",
                "weights": weights,
                "trained_at": datetime.now().isoformat(),
            },
            f,
            indent=2,
        )

    # Evaluate
    X, y, groups = prepare_ltr_dataset(users, schemes, interactions)
    feature_names = list(weights.keys())
    w_arr = np.array([weights[n] for n in feature_names])
    preds = X @ w_arr  # linear scoring
    train_ndcg = ndcg_at_k(y, preds, groups, k=10)
    print(f"\n  Train NDCG@10 (heuristic): {train_ndcg:.4f}")

    return model_path


if __name__ == "__main__":
    sys.exit(main())
