"""
Offline evaluation for recommendation ranking quality.

Input is an aggregated feedback dataset produced by:
  scripts/export_recommendation_feedback_dataset.py

Metrics:
- NDCG@5, NDCG@10 based on graded feedback label
- Apply-hit@5, Apply-hit@10 (proxy for conversion)
- Engagement-hit@5, Engagement-hit@10 (proxy for usefulness)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List

import numpy as np
import pandas as pd


def _dcg(relevances: Iterable[float], k: int) -> float:
    rel = np.asarray(list(relevances), dtype=np.float64)[:k]
    if rel.size == 0:
        return 0.0
    discounts = 1.0 / np.log2(np.arange(2, rel.size + 2))
    return float(np.sum(rel * discounts))


def _ndcg_for_user(df_user: pd.DataFrame, score_col: str, label_col: str, k: int) -> float:
    ranked = df_user.sort_values(score_col, ascending=False)
    actual = ranked[label_col].astype(float).values

    ideal = np.sort(df_user[label_col].astype(float).values)[::-1]

    denom = _dcg(ideal, k)
    if denom <= 0.0:
        return 0.0
    return _dcg(actual, k) / denom


def _hit_for_user(df_user: pd.DataFrame, score_col: str, target_col: str, k: int) -> float:
    ranked = df_user.sort_values(score_col, ascending=False).head(k)
    return float((ranked[target_col].astype(float) > 0).any())


def evaluate(df: pd.DataFrame, score_col: str, label_col: str) -> Dict[str, float]:
    user_groups = list(df.groupby("user_id"))
    if not user_groups:
        return {
            "users": 0,
            "pairs": 0,
            "ndcg@5": 0.0,
            "ndcg@10": 0.0,
            "apply_hit@5": 0.0,
            "apply_hit@10": 0.0,
            "engagement_hit@5": 0.0,
            "engagement_hit@10": 0.0,
        }

    ndcg_5: List[float] = []
    ndcg_10: List[float] = []
    apply_hit_5: List[float] = []
    apply_hit_10: List[float] = []
    engage_hit_5: List[float] = []
    engage_hit_10: List[float] = []

    for _, user_df in user_groups:
        ndcg_5.append(_ndcg_for_user(user_df, score_col, label_col, 5))
        ndcg_10.append(_ndcg_for_user(user_df, score_col, label_col, 10))
        apply_hit_5.append(_hit_for_user(user_df, score_col, "applied_binary", 5))
        apply_hit_10.append(_hit_for_user(user_df, score_col, "applied_binary", 10))
        engage_hit_5.append(_hit_for_user(user_df, score_col, "engaged_binary", 5))
        engage_hit_10.append(_hit_for_user(user_df, score_col, "engaged_binary", 10))

    return {
        "users": float(len(user_groups)),
        "pairs": float(len(df)),
        "ndcg@5": float(np.mean(ndcg_5)),
        "ndcg@10": float(np.mean(ndcg_10)),
        "apply_hit@5": float(np.mean(apply_hit_5)),
        "apply_hit@10": float(np.mean(apply_hit_10)),
        "engagement_hit@5": float(np.mean(engage_hit_5)),
        "engagement_hit@10": float(np.mean(engage_hit_10)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate recommendation ranking dataset")
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to feedback dataset CSV",
    )
    parser.add_argument(
        "--score-column",
        default="served_score",
        help="Column used as ranking score (default: served_score)",
    )
    parser.add_argument(
        "--label-column",
        default="label",
        help="Column used as graded relevance label (default: label)",
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path to write evaluation metrics as JSON",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset).expanduser().resolve()
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    df = pd.read_csv(dataset_path)
    required_cols = {
        "user_id",
        args.score_column,
        args.label_column,
        "applied_binary",
        "engaged_binary",
    }
    missing = sorted(col for col in required_cols if col not in df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing)}")

    clean = df.copy()
    clean[args.score_column] = pd.to_numeric(clean[args.score_column], errors="coerce")
    clean[args.label_column] = pd.to_numeric(clean[args.label_column], errors="coerce")
    clean["applied_binary"] = pd.to_numeric(clean["applied_binary"], errors="coerce").fillna(0)
    clean["engaged_binary"] = pd.to_numeric(clean["engaged_binary"], errors="coerce").fillna(0)
    clean = clean.dropna(subset=[args.score_column, args.label_column, "user_id"]).copy()

    metrics = evaluate(clean, args.score_column, args.label_column)

    print("Offline Recommendation Evaluation")
    print("dataset:", dataset_path)
    print("score_column:", args.score_column)
    print("label_column:", args.label_column)
    print("users:", int(metrics["users"]))
    print("pairs:", int(metrics["pairs"]))
    print(f"ndcg@5: {metrics['ndcg@5']:.4f}")
    print(f"ndcg@10: {metrics['ndcg@10']:.4f}")
    print(f"apply_hit@5: {metrics['apply_hit@5']:.4f}")
    print(f"apply_hit@10: {metrics['apply_hit@10']:.4f}")
    print(f"engagement_hit@5: {metrics['engagement_hit@5']:.4f}")
    print(f"engagement_hit@10: {metrics['engagement_hit@10']:.4f}")

    if args.output_json:
        output_path = Path(args.output_json).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        print("Saved metrics to", output_path)


if __name__ == "__main__":
    main()
