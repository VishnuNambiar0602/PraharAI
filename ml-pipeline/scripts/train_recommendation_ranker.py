"""
Train an XGBoost ranking model from exported recommendation feedback data.

This script consumes the dataset produced by:
  scripts/export_recommendation_feedback_dataset.py

It builds a 12-dimensional feature vector aligned with
src/recommendation_engine.py::_build_ranking_features and trains an
XGBoost LambdaMART ranker (objective rank:ndcg). The output is a candidate
model directory with training metadata and quality-gate status.
"""

# pyright: reportMissingImports=false

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    import xgboost as xgb
except ImportError as exc:  # pragma: no cover - runtime dependency guard
    raise RuntimeError(
        "xgboost is required for training. Install dependencies with: pip install -r requirements.txt"
    ) from exc


FEATURE_NAMES: List[str] = [
    "eligibility_score",
    "met_criteria_count",
    "state_match",
    "state_specific",
    "category_match",
    "group_relevance",
    "scheme_popularity",
    "age_in_range",
    "income_within_limit",
    "description_length_score",
    "tag_overlap",
    "is_central_scheme",
]


@dataclass
class TrainConfig:
    dataset: Path
    output_root: Path
    seed: int
    min_user_rows: int
    validation_ratio: float
    min_ndcg5: float
    min_ndcg10: float
    baseline_metrics: Optional[Path]
    min_delta_ndcg5: float
    min_delta_ndcg10: float
    num_boost_round: int
    max_depth: int
    learning_rate: float


def _parse_list_field(raw: object) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(v).strip() for v in raw if str(v).strip()]

    text = str(raw).strip()
    if not text:
        return []

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if str(v).strip()]
        except json.JSONDecodeError:
            pass

    return [part.strip() for part in text.split(",") if part.strip()]


def _normalize_score(raw: object) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return 0.0

    if value > 1.0:
        value /= 100.0
    return max(0.0, min(1.0, value))


def _build_feature_row(row: pd.Series) -> List[float]:
    eligibility_score = _normalize_score(row.get("served_score", 0.0))
    met_criteria_count = max(0.0, min(1.0, float(row.get("label", 0.0))))

    user_state = str(row.get("user_state", "") or "").strip().lower()
    scheme_state = str(row.get("scheme_state", "") or "").strip().lower()
    state_match = 1.0 if user_state and scheme_state and user_state == scheme_state else 0.0
    state_specific = 0.0 if scheme_state in {"", "all", "national", "central"} else 1.0

    occupation = str(row.get("user_employment", "") or "").strip().lower()
    scheme_category = str(row.get("scheme_category", "") or "").strip().lower()
    tags = [tag.lower() for tag in _parse_list_field(row.get("scheme_tags", []))]
    description = str(row.get("scheme_description", "") or "")
    description_lower = description.lower()

    category_corpus = " ".join([scheme_category, " ".join(tags), description_lower])
    category_match = 1.0 if occupation and occupation in category_corpus else 0.0

    # Without explicit group labels in dataset, use neutral prior.
    group_relevance = 0.5

    viewed_count = float(row.get("viewed_count", 0) or 0)
    clicked_count = float(row.get("clicked_count", 0) or 0)
    saved_count = float(row.get("saved_count", 0) or 0)
    applied_count = float(row.get("applied_count", 0) or 0)
    popularity_raw = (
        0.05 * viewed_count + 0.2 * clicked_count + 0.4 * saved_count + 1.0 * applied_count
    )
    scheme_popularity = max(0.0, min(1.0, popularity_raw / 5.0))

    # Age and income bounds are not yet exported from scheme metadata; use permissive defaults.
    age_in_range = 1.0
    income_within_limit = 1.0

    description_length_score = min(len(description) / 500.0, 1.0)

    profile_keywords = {
        str(row.get("user_employment", "") or "").strip().lower(),
        str(row.get("user_state", "") or "").strip().lower(),
        str(row.get("user_education", "") or "").strip().lower(),
        str(row.get("user_social_category", "") or "").strip().lower(),
        str(row.get("user_rural_urban", "") or "").strip().lower(),
    }
    profile_keywords = {kw for kw in profile_keywords if kw}
    tag_overlap = (
        len(profile_keywords & set(tags)) / float(max(len(profile_keywords), 1))
        if profile_keywords
        else 0.0
    )

    scheme_name = str(row.get("scheme_name", "") or "").strip().lower()
    is_central_scheme = (
        1.0
        if any(kw in scheme_name for kw in ("pradhan mantri", "pm ", "national", "central"))
        else 0.0
    )

    return [
        float(eligibility_score),
        float(met_criteria_count),
        float(state_match),
        float(state_specific),
        float(category_match),
        float(group_relevance),
        float(scheme_popularity),
        float(age_in_range),
        float(income_within_limit),
        float(description_length_score),
        float(tag_overlap),
        float(is_central_scheme),
    ]


def _dcg(scores: np.ndarray, k: int) -> float:
    top = scores[:k]
    if top.size == 0:
        return 0.0
    gains = np.power(2.0, top) - 1.0
    discounts = np.log2(np.arange(2, top.size + 2))
    return float(np.sum(gains / discounts))


def _ndcg_by_groups(y_true: np.ndarray, y_pred: np.ndarray, groups: List[int], k: int) -> float:
    start = 0
    values: List[float] = []

    for group_size in groups:
        end = start + group_size
        y_slice = y_true[start:end]
        p_slice = y_pred[start:end]

        order_pred = np.argsort(-p_slice)
        order_true = np.argsort(-y_slice)

        dcg = _dcg(y_slice[order_pred], k)
        idcg = _dcg(y_slice[order_true], k)
        values.append((dcg / idcg) if idcg > 0 else 0.0)
        start = end

    return float(np.mean(values)) if values else 0.0


def _validate_cfg(args: argparse.Namespace) -> TrainConfig:
    dataset = Path(args.dataset).expanduser().resolve()
    if not dataset.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset}")

    output_root = Path(args.output_root).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    baseline = None
    if args.baseline_metrics:
        baseline = Path(args.baseline_metrics).expanduser().resolve()

    return TrainConfig(
        dataset=dataset,
        output_root=output_root,
        seed=int(args.seed),
        min_user_rows=max(2, int(args.min_user_rows)),
        validation_ratio=min(0.9, max(0.1, float(args.validation_ratio))),
        min_ndcg5=max(0.0, min(1.0, float(args.min_ndcg5))),
        min_ndcg10=max(0.0, min(1.0, float(args.min_ndcg10))),
        baseline_metrics=baseline,
        min_delta_ndcg5=float(args.min_delta_ndcg5),
        min_delta_ndcg10=float(args.min_delta_ndcg10),
        num_boost_round=max(20, int(args.num_boost_round)),
        max_depth=max(2, int(args.max_depth)),
        learning_rate=max(0.01, float(args.learning_rate)),
    )


def _prepare_dataset(cfg: TrainConfig) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    df = pd.read_csv(cfg.dataset)
    required = {"user_id", "scheme_id", "label", "served_score"}
    missing = sorted(col for col in required if col not in df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {', '.join(missing)}")

    clean = df.dropna(subset=["user_id", "scheme_id", "label"]).copy()
    clean["label"] = pd.to_numeric(clean["label"], errors="coerce").fillna(0.0)
    clean["served_score"] = pd.to_numeric(clean["served_score"], errors="coerce").fillna(0.0)
    clean = clean[clean.groupby("user_id")["scheme_id"].transform("count") >= cfg.min_user_rows]
    clean = clean.sort_values(["user_id", "scheme_id"]).reset_index(drop=True)

    if clean.empty:
        raise ValueError("No usable rows after filtering. Need more feedback data.")

    feature_rows = np.array(
        [_build_feature_row(row) for _, row in clean.iterrows()], dtype=np.float32
    )

    # Convert label to [0,3] graded relevance for ranking objective.
    labels = np.clip((clean["label"].astype(float).values * 3.0), 0.0, 3.0).astype(np.float32)
    return clean, feature_rows, labels


def _split_users(df: pd.DataFrame, cfg: TrainConfig) -> Tuple[set, set]:
    users = np.array(sorted(df["user_id"].unique()))
    rng = np.random.default_rng(cfg.seed)
    rng.shuffle(users)

    n_val = max(1, int(len(users) * cfg.validation_ratio))
    val_users = set(users[:n_val])
    train_users = set(users[n_val:])

    if not train_users:
        train_users = set(users[:-1])
        val_users = {users[-1]}

    return train_users, val_users


def _to_grouped_matrix(
    df: pd.DataFrame, X: np.ndarray, y: np.ndarray, users: set
) -> Tuple[np.ndarray, np.ndarray, List[int]]:
    mask = df["user_id"].isin(users).values
    part_df = df[mask].copy()
    part_X = X[mask]
    part_y = y[mask]

    ordered_indices: List[int] = []
    groups: List[int] = []

    for _, group in part_df.groupby("user_id", sort=True):
        idx = group.index.to_list()
        groups.append(len(idx))
        ordered_indices.extend(idx)

    if not ordered_indices:
        return np.empty((0, X.shape[1]), dtype=np.float32), np.empty((0,), dtype=np.float32), []

    # Map global index to local row in mask slice.
    local_pos = {global_idx: pos for pos, global_idx in enumerate(part_df.index.to_list())}
    local_order = [local_pos[idx] for idx in ordered_indices]

    return part_X[local_order], part_y[local_order], groups


def _load_baseline_metrics(path: Optional[Path]) -> Dict[str, float]:
    if not path or not path.exists():
        return {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "ndcg@5": float(payload.get("ndcg@5", 0.0)),
        "ndcg@10": float(payload.get("ndcg@10", 0.0)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train recommendation ranker from feedback dataset"
    )
    parser.add_argument("--dataset", required=True, help="Path to exported feedback dataset CSV")
    parser.add_argument(
        "--output-root",
        default="models/recommendation_candidates",
        help="Directory for candidate model artifacts",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-user-rows", type=int, default=5)
    parser.add_argument("--validation-ratio", type=float, default=0.2)
    parser.add_argument("--min-ndcg5", type=float, default=0.25)
    parser.add_argument("--min-ndcg10", type=float, default=0.35)
    parser.add_argument("--baseline-metrics", default=None)
    parser.add_argument("--min-delta-ndcg5", type=float, default=0.0)
    parser.add_argument("--min-delta-ndcg10", type=float, default=0.0)
    parser.add_argument("--num-boost-round", type=int, default=240)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    args = parser.parse_args()

    cfg = _validate_cfg(args)

    df, X, y = _prepare_dataset(cfg)
    train_users, val_users = _split_users(df, cfg)

    X_train, y_train, g_train = _to_grouped_matrix(df, X, y, train_users)
    X_val, y_val, g_val = _to_grouped_matrix(df, X, y, val_users)

    if len(g_train) == 0 or len(g_val) == 0:
        raise ValueError("Need at least one train and one validation user group.")

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_NAMES)
    dtrain.set_group(g_train)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=FEATURE_NAMES)
    dval.set_group(g_val)

    params = {
        "objective": "rank:ndcg",
        "eval_metric": ["ndcg@5", "ndcg@10"],
        "max_depth": cfg.max_depth,
        "learning_rate": cfg.learning_rate,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "min_child_weight": 1.0,
        "seed": cfg.seed,
        "verbosity": 1,
    }

    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=cfg.num_boost_round,
        evals=[(dtrain, "train"), (dval, "val")],
        verbose_eval=False,
    )

    train_pred = booster.predict(dtrain)
    val_pred = booster.predict(dval)

    train_ndcg5 = _ndcg_by_groups(y_train, train_pred, g_train, 5)
    train_ndcg10 = _ndcg_by_groups(y_train, train_pred, g_train, 10)
    val_ndcg5 = _ndcg_by_groups(y_val, val_pred, g_val, 5)
    val_ndcg10 = _ndcg_by_groups(y_val, val_pred, g_val, 10)

    baseline = _load_baseline_metrics(cfg.baseline_metrics)
    baseline_ndcg5 = float(baseline.get("ndcg@5", 0.0))
    baseline_ndcg10 = float(baseline.get("ndcg@10", 0.0))

    gate_reasons: List[str] = []
    if val_ndcg5 < cfg.min_ndcg5:
        gate_reasons.append(f"val ndcg@5 {val_ndcg5:.4f} < min {cfg.min_ndcg5:.4f}")
    if val_ndcg10 < cfg.min_ndcg10:
        gate_reasons.append(f"val ndcg@10 {val_ndcg10:.4f} < min {cfg.min_ndcg10:.4f}")
    if (val_ndcg5 - baseline_ndcg5) < cfg.min_delta_ndcg5:
        gate_reasons.append(
            f"delta ndcg@5 {(val_ndcg5 - baseline_ndcg5):.4f} < min delta {cfg.min_delta_ndcg5:.4f}"
        )
    if (val_ndcg10 - baseline_ndcg10) < cfg.min_delta_ndcg10:
        gate_reasons.append(
            f"delta ndcg@10 {(val_ndcg10 - baseline_ndcg10):.4f} < min delta {cfg.min_delta_ndcg10:.4f}"
        )

    gate_passed = len(gate_reasons) == 0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    candidate_dir = cfg.output_root / f"ranker-{stamp}"
    candidate_dir.mkdir(parents=True, exist_ok=True)

    model_path = candidate_dir / "xgb_ranker.model"
    booster.save_model(str(model_path))

    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset": str(cfg.dataset),
        "candidate_dir": str(candidate_dir),
        "model_path": str(model_path),
        "feature_names": FEATURE_NAMES,
        "train_rows": int(len(X_train)),
        "val_rows": int(len(X_val)),
        "train_users": int(len(g_train)),
        "val_users": int(len(g_val)),
        "metrics": {
            "train_ndcg@5": train_ndcg5,
            "train_ndcg@10": train_ndcg10,
            "val_ndcg@5": val_ndcg5,
            "val_ndcg@10": val_ndcg10,
            "baseline_ndcg@5": baseline_ndcg5,
            "baseline_ndcg@10": baseline_ndcg10,
            "delta_ndcg@5": val_ndcg5 - baseline_ndcg5,
            "delta_ndcg@10": val_ndcg10 - baseline_ndcg10,
        },
        "gates": {
            "min_ndcg5": cfg.min_ndcg5,
            "min_ndcg10": cfg.min_ndcg10,
            "min_delta_ndcg5": cfg.min_delta_ndcg5,
            "min_delta_ndcg10": cfg.min_delta_ndcg10,
            "passed": gate_passed,
            "reasons": gate_reasons,
        },
        "params": {
            "seed": cfg.seed,
            "min_user_rows": cfg.min_user_rows,
            "validation_ratio": cfg.validation_ratio,
            "num_boost_round": cfg.num_boost_round,
            "max_depth": cfg.max_depth,
            "learning_rate": cfg.learning_rate,
        },
    }

    (candidate_dir / "training_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    print("Saved candidate model:", model_path)
    print("Validation metrics: ndcg@5=%.4f ndcg@10=%.4f" % (val_ndcg5, val_ndcg10))
    print("Quality gate:", "PASS" if gate_passed else "FAIL")
    if gate_reasons:
        print("Gate reasons:")
        for reason in gate_reasons:
            print(" -", reason)


if __name__ == "__main__":
    main()
