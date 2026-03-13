"""
Export recommendation feedback from Neo4j into a model-ready dataset.

The output contains one row per (user_id, scheme_id) with:
- Aggregated interaction counts (viewed/clicked/saved/applied/dismissed)
- A weighted training label in [0, 1]
- Optional recency-aware weighting via exponential decay
- Basic user/scheme context features for downstream ranking models

Usage:
  python scripts/export_recommendation_feedback_dataset.py \
    --output ml-pipeline/data/training/recommendation_feedback_dataset.csv
"""

# pyright: reportMissingImports=false

from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

try:
    from neo4j import GraphDatabase
except ImportError:  # pragma: no cover - runtime dependency guard
    GraphDatabase = None


ACTION_WEIGHTS: Dict[str, float] = {
    "viewed": 0.05,
    "clicked": 0.20,
    "saved": 0.40,
    "applied": 1.00,
    "dismissed": -0.30,
}


@dataclass
class ExportConfig:
    output: Path
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    days_back: int
    decay_half_life_days: int


def _parse_datetime(raw: Optional[str]) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)

    text = str(raw).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _age_decay(created_at: datetime, half_life_days: int) -> float:
    if half_life_days <= 0:
        return 1.0

    age_days = max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds() / 86400.0)
    return math.exp(-math.log(2.0) * age_days / float(half_life_days))


def _fetch_feedback_rows(cfg: ExportConfig) -> List[Dict[str, Any]]:
    if GraphDatabase is None:
        raise RuntimeError(
            "neo4j package is required. Install dependencies with: pip install -r requirements.txt"
        )

    query = """
    MATCH (u:User)-[:GAVE_FEEDBACK]->(f:RecommendationFeedback)-[:ABOUT_SCHEME]->(s:Scheme)
    WHERE datetime(f.created_at) >= datetime() - duration({days: $daysBack})
    RETURN
      u.user_id AS user_id,
      u.age AS user_age,
      u.income AS user_income,
      u.state AS user_state,
      u.gender AS user_gender,
      u.employment AS user_employment,
      u.education AS user_education,
      u.social_category AS user_social_category,
      u.rural_urban AS user_rural_urban,
      s.scheme_id AS scheme_id,
      s.name AS scheme_name,
      s.description AS scheme_description,
      s.state AS scheme_state,
      s.ministry AS scheme_ministry,
      s.category AS scheme_category,
      s.tags AS scheme_tags,
      f.action AS action,
      f.source AS source,
      f.rank AS served_rank,
      f.score AS served_score,
      f.created_at AS created_at
    """

    driver = GraphDatabase.driver(cfg.neo4j_uri, auth=(cfg.neo4j_user, cfg.neo4j_password))
    try:
        with driver.session() as session:
            result = session.run(query, daysBack=cfg.days_back)
            return [record.data() for record in result]
    finally:
        driver.close()


def _to_dataframe(rows: List[Dict[str, Any]], cfg: ExportConfig) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)

    df["action"] = df["action"].fillna("").astype(str).str.strip().str.lower()
    df = df[df["action"].isin(ACTION_WEIGHTS.keys())].copy()
    if df.empty:
        return df

    df["created_at"] = df["created_at"].map(_parse_datetime)
    df["action_weight"] = df["action"].map(ACTION_WEIGHTS)
    df["recency_weight"] = df["created_at"].map(lambda dt: _age_decay(dt, cfg.decay_half_life_days))
    df["weighted_signal"] = df["action_weight"] * df["recency_weight"]

    for action in ACTION_WEIGHTS.keys():
        df[f"{action}_count"] = (df["action"] == action).astype(int)

    group_cols = ["user_id", "scheme_id"]
    keep_first_cols = [
        "user_age",
        "user_income",
        "user_state",
        "user_gender",
        "user_employment",
        "user_education",
        "user_social_category",
        "user_rural_urban",
        "scheme_name",
        "scheme_description",
        "scheme_state",
        "scheme_ministry",
        "scheme_category",
        "scheme_tags",
        "source",
    ]

    agg_map: Dict[str, Any] = {
        "weighted_signal": "sum",
        "served_score": "mean",
        "served_rank": "mean",
        "created_at": "max",
    }
    agg_map.update({f"{action}_count": "sum" for action in ACTION_WEIGHTS.keys()})

    grouped = df.groupby(group_cols, as_index=False).agg(agg_map)

    first_context = (
        df.sort_values("created_at").groupby(group_cols, as_index=False)[keep_first_cols].first()
    )

    out = grouped.merge(first_context, on=group_cols, how="left")

    out["label_raw"] = out["weighted_signal"]
    out["label"] = out["label_raw"].clip(lower=0.0, upper=1.0)
    out["applied_binary"] = (out["applied_count"] > 0).astype(int)
    out["engaged_binary"] = (
        (out["clicked_count"] > 0) | (out["saved_count"] > 0) | (out["applied_count"] > 0)
    ).astype(int)

    out = out.sort_values(["user_id", "label", "created_at"], ascending=[True, False, False])
    return out


def _validate_config(args: argparse.Namespace) -> ExportConfig:
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    uri = args.neo4j_uri or os.getenv("NEO4J_URI") or "bolt://localhost:7687"
    user = args.neo4j_user or os.getenv("NEO4J_USERNAME") or os.getenv("NEO4J_USER") or "neo4j"
    password = args.neo4j_password or os.getenv("NEO4J_PASSWORD")

    if not password:
        raise ValueError("Missing Neo4j password. Provide --neo4j-password or set NEO4J_PASSWORD")

    return ExportConfig(
        output=output,
        neo4j_uri=uri,
        neo4j_user=user,
        neo4j_password=password,
        days_back=max(1, int(args.days_back)),
        decay_half_life_days=max(1, int(args.decay_half_life_days)),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Export recommendation feedback training dataset")
    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV path for the aggregated dataset",
    )
    parser.add_argument("--neo4j-uri", default=None, help="Neo4j URI (default from env NEO4J_URI)")
    parser.add_argument("--neo4j-user", default=None, help="Neo4j username")
    parser.add_argument("--neo4j-password", default=None, help="Neo4j password")
    parser.add_argument(
        "--days-back",
        type=int,
        default=180,
        help="Export interactions from the last N days",
    )
    parser.add_argument(
        "--decay-half-life-days",
        type=int,
        default=90,
        help="Half-life in days for recency decay on feedback events",
    )
    args = parser.parse_args()

    cfg = _validate_config(args)

    rows = _fetch_feedback_rows(cfg)
    dataset = _to_dataframe(rows, cfg)

    if dataset.empty:
        dataset.to_csv(cfg.output, index=False)
        print("No feedback rows found. Wrote empty dataset:", cfg.output)
        return

    dataset.to_csv(cfg.output, index=False)
    print(f"Exported {len(dataset)} user-scheme rows to {cfg.output}")
    print("Label distribution:")
    print(dataset["label"].describe().to_string())


if __name__ == "__main__":
    main()
