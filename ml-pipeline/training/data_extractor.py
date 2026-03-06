"""
Data Extractor for ML Training Pipeline

Extracts training data from Neo4j database or generates synthetic datasets
when the database is unavailable. Produces JSON files consumed by the
intent_trainer, recommendation_trainer, and user_classifier training scripts.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

import numpy as np

# Neo4j driver (optional — falls back to synthetic data)
try:
    from neo4j import GraphDatabase

    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False


# ---------------------------------------------------------------------------
# Neo4j extraction
# ---------------------------------------------------------------------------


class Neo4jExtractor:
    """Extract scheme and user data from Neo4j for training."""

    def __init__(self, uri: str, user: str, password: str):
        if not NEO4J_AVAILABLE:
            raise RuntimeError("neo4j Python driver is not installed")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    # -- schemes ----------------------------------------------------------

    def extract_schemes(self) -> List[Dict[str, Any]]:
        """Return all active schemes with their categories."""
        query = """
        MATCH (s:Scheme)
        WHERE s.is_active = true OR s.is_active IS NULL
        OPTIONAL MATCH (s)-[:HAS_CATEGORY]->(c:Category)
        WITH s, collect({type: c.type, value: c.value}) AS categories
        RETURN s.scheme_id   AS scheme_id,
               s.name        AS name,
               s.description AS description,
               s.ministry    AS ministry,
               s.state       AS state,
               s.tags        AS tags,
               categories
        """
        with self.driver.session() as session:
            result = session.run(query)
            schemes = []
            for record in result:
                schemes.append(
                    {
                        "scheme_id": record["scheme_id"],
                        "name": record["name"],
                        "description": record["description"] or "",
                        "ministry": record["ministry"] or "",
                        "state": record["state"] or "",
                        "tags": record["tags"] or "[]",
                        "categories": record["categories"],
                    }
                )
            return schemes

    # -- users ------------------------------------------------------------

    def extract_users(self) -> List[Dict[str, Any]]:
        """Return all user profiles with their groups."""
        query = """
        MATCH (u:User)
        OPTIONAL MATCH (u)-[:BELONGS_TO]->(ug:UserGroup)
        WITH u, collect(ug.name) AS groups
        RETURN u.user_id           AS user_id,
               u.age               AS age,
               u.gender            AS gender,
               u.marital_status    AS marital_status,
               u.family_size       AS family_size,
               u.annual_income     AS annual_income,
               u.employment_status AS employment_status,
               u.state             AS state,
               u.rural_urban       AS rural_urban,
               u.education_level   AS education_level,
               u.caste             AS caste,
               u.disability        AS disability,
               groups
        """
        with self.driver.session() as session:
            result = session.run(query)
            users = []
            for record in result:
                users.append(
                    {
                        "user_id": record["user_id"],
                        "age": record["age"],
                        "gender": record["gender"],
                        "marital_status": record["marital_status"],
                        "family_size": record["family_size"],
                        "annual_income": record["annual_income"],
                        "employment_status": record["employment_status"],
                        "state": record["state"],
                        "rural_urban": record["rural_urban"],
                        "education_level": record["education_level"],
                        "caste": record["caste"],
                        "disability": record["disability"],
                        "groups": record["groups"],
                    }
                )
            return users

    # -- user‑scheme interactions (for recommendation training) -----------

    def extract_interactions(self) -> List[Dict[str, Any]]:
        """
        Extract user→scheme interaction signals (views, applications, bookmarks).
        Falls back to empty list if no interaction data exists.
        """
        query = """
        MATCH (u:User)-[r]->(s:Scheme)
        WHERE type(r) IN ['VIEWED', 'APPLIED', 'BOOKMARKED']
        RETURN u.user_id   AS user_id,
               s.scheme_id AS scheme_id,
               type(r)     AS action,
               r.timestamp AS timestamp
        """
        try:
            with self.driver.session() as session:
                result = session.run(query)
                return [dict(record) for record in result]
        except Exception:
            # Interaction edges may not exist yet
            return []


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------

_RNG = np.random.RandomState(42)

STATES = [
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
    "Andhra Pradesh",
    "Telangana",
    "Kerala",
    "Jharkhand",
    "Assam",
    "Punjab",
    "Chhattisgarh",
    "Haryana",
    "Odisha",
    "Uttarakhand",
]
GENDERS = ["male", "female", "other"]
MARITAL = ["single", "married", "divorced", "widowed"]
EMPLOYMENT = ["employed", "self_employed", "unemployed", "student", "retired"]
EDUCATION = ["no_formal", "primary", "secondary", "higher_secondary", "graduate", "postgraduate"]
CASTES = ["general", "obc", "sc", "st", "other"]
RURAL_URBAN = ["rural", "urban", "semi_urban"]

MINISTRIES = [
    "Ministry of Rural Development",
    "Ministry of Agriculture",
    "Ministry of Education",
    "Ministry of Health & Family Welfare",
    "Ministry of Women & Child Development",
    "Ministry of Labour & Employment",
    "Ministry of Social Justice",
    "Ministry of Housing & Urban Affairs",
    "Ministry of Skill Development",
    "Ministry of Finance",
]

CATEGORY_TYPES = {
    "age_group": ["youth", "senior_citizen", "adult", "child"],
    "income_level": ["bpl", "apl", "low_income", "middle_income"],
    "occupation": ["farmer", "student", "worker", "self_employed", "unemployed"],
    "social_category": ["sc", "st", "obc", "general", "minority"],
    "gender": ["women", "men", "transgender"],
    "location": ["rural", "urban", "tribal"],
}

# Intent training templates  (query, intent_label)
_INTENT_TEMPLATES: List[Tuple[str, str]] = [
    # scheme_search
    ("Show me schemes for {occupation} in {state}", "scheme_search"),
    ("What government schemes are available for {social_category}?", "scheme_search"),
    ("Find {income_level} schemes", "scheme_search"),
    ("List schemes for {age_group}", "scheme_search"),
    ("Are there any schemes for {gender} in {state}?", "scheme_search"),
    ("I am looking for schemes related to agriculture", "scheme_search"),
    ("schemes for disabled people", "scheme_search"),
    ("housing schemes in {state}", "scheme_search"),
    ("education scholarship for {social_category} students", "scheme_search"),
    ("health insurance schemes for {income_level} families", "scheme_search"),
    # eligibility_check
    ("Am I eligible for PM Kisan?", "eligibility_check"),
    ("Can I apply for Ayushman Bharat?", "eligibility_check"),
    ("Check my eligibility for housing scheme", "eligibility_check"),
    ("Do I qualify for the scholarship?", "eligibility_check"),
    ("What are the eligibility criteria for MGNREGA?", "eligibility_check"),
    ("I am a {occupation} earning {income_level}, am I eligible?", "eligibility_check"),
    ("eligibility status for pension scheme", "eligibility_check"),
    # application_info
    ("How do I apply for PM Ujjwala Yojana?", "application_info"),
    ("What documents are needed for Mudra loan?", "application_info"),
    ("Application process for Ayushman Bharat", "application_info"),
    ("Where can I submit the form for housing scheme?", "application_info"),
    ("Steps to apply for crop insurance", "application_info"),
    ("Tell me the procedure to get beneficiary ID", "application_info"),
    # deadline_query
    ("When is the last date for Kisan Samman application?", "deadline_query"),
    ("Deadline for scholarship application?", "deadline_query"),
    ("Is the registration for PMAY still open?", "deadline_query"),
    ("When does the housing scheme close?", "deadline_query"),
    ("last date for submitting pension form", "deadline_query"),
    # profile_update
    ("Update my income to 3 lakhs", "profile_update"),
    ("Change my state to {state}", "profile_update"),
    ("I moved to {state}", "profile_update"),
    ("My employment status changed to {employment}", "profile_update"),
    ("I got married, update my profile", "profile_update"),
    ("Update my age", "profile_update"),
    # general_question
    ("What is the PM Kisan scheme about?", "general_question"),
    ("Tell me about Sukanya Samriddhi Yojana", "general_question"),
    ("Explain MGNREGA", "general_question"),
    ("What benefits does this scheme provide?", "general_question"),
    ("How much pension will I get?", "general_question"),
    ("Who started this scheme?", "general_question"),
    # nudge_preferences
    ("Don't notify me about pension schemes", "nudge_preferences"),
    ("Send me alerts for new education schemes", "nudge_preferences"),
    ("I want to get notifications for {occupation} schemes", "nudge_preferences"),
    ("Disable notifications", "nudge_preferences"),
    ("Subscribe me to agriculture scheme updates", "nudge_preferences"),
]


def _fill_template(template: str) -> str:
    """Replace placeholders in a template with random category values."""
    result = template
    for cat_type, values in CATEGORY_TYPES.items():
        placeholder = "{" + cat_type + "}"
        if placeholder in result:
            result = result.replace(placeholder, _RNG.choice(values))
    if "{state}" in result:
        result = result.replace("{state}", _RNG.choice(STATES))
    if "{employment}" in result:
        result = result.replace("{employment}", _RNG.choice(EMPLOYMENT))
    return result


def generate_intent_data(n_per_template: int = 20) -> List[Tuple[str, str]]:
    """
    Generate intent training data by expanding templates with random slot
    fillers. Each template is expanded ``n_per_template`` times.

    Returns:
        List of (query, intent_label) tuples.
    """
    data: List[Tuple[str, str]] = []
    for template, label in _INTENT_TEMPLATES:
        for _ in range(n_per_template):
            data.append((_fill_template(template), label))
    # Shuffle deterministically
    indices = list(range(len(data)))
    _RNG.shuffle(indices)
    return [data[i] for i in indices]


def generate_user_profiles(n: int = 1000) -> List[Dict[str, Any]]:
    """Generate ``n`` synthetic user profiles."""
    profiles = []
    for i in range(n):
        age = int(_RNG.normal(35, 15))
        age = max(18, min(100, age))
        income = int(_RNG.lognormal(13, 1))
        income = max(0, min(10_000_000, income))
        family_size = int(_RNG.exponential(2)) + 1
        family_size = max(1, min(10, family_size))

        profiles.append(
            {
                "user_id": f"user-{i:06d}",
                "age": age,
                "gender": _RNG.choice(GENDERS),
                "marital_status": _RNG.choice(MARITAL),
                "family_size": family_size,
                "annual_income": income,
                "employment_status": _RNG.choice(EMPLOYMENT),
                "state": _RNG.choice(STATES),
                "rural_urban": _RNG.choice(RURAL_URBAN),
                "education_level": _RNG.choice(EDUCATION),
                "caste": _RNG.choice(CASTES),
                "disability": bool(_RNG.random() < 0.05),
            }
        )
    return profiles


def generate_schemes(n: int = 200) -> List[Dict[str, Any]]:
    """Generate ``n`` synthetic scheme records."""
    schemes: List[Dict[str, Any]] = []
    for i in range(n):
        n_cats = _RNG.randint(1, 5)
        cats: List[Dict[str, str]] = []
        for _ in range(n_cats):
            cat_type = _RNG.choice(list(CATEGORY_TYPES.keys()))
            cat_val = _RNG.choice(CATEGORY_TYPES[cat_type])
            cats.append({"type": cat_type, "value": cat_val})

        scheme_name = f"Scheme-{i:04d}"
        schemes.append(
            {
                "scheme_id": f"scheme-{i:04d}",
                "name": scheme_name,
                "description": f"Government scheme #{i} for eligible citizens.",
                "ministry": _RNG.choice(MINISTRIES),
                "state": _RNG.choice(STATES) if _RNG.random() < 0.6 else "",
                "tags": json.dumps(
                    _RNG.choice(
                        [
                            "agriculture",
                            "education",
                            "health",
                            "housing",
                            "finance",
                            "employment",
                            "social welfare",
                            "skill development",
                        ],
                        size=_RNG.randint(1, 4),
                        replace=False,
                    ).tolist()
                ),
                "categories": cats,
            }
        )
    return schemes


def generate_interactions(
    users: List[Dict[str, Any]],
    schemes: List[Dict[str, Any]],
    avg_per_user: int = 5,
) -> List[Dict[str, Any]]:
    """Simulate user→scheme interactions for recommendation training."""
    interactions: List[Dict[str, Any]] = []
    actions = ["VIEWED", "APPLIED", "BOOKMARKED"]
    action_weights = [0.6, 0.2, 0.2]

    for user in users:
        n_actions = max(1, int(_RNG.poisson(avg_per_user)))
        chosen = _RNG.choice(len(schemes), size=min(n_actions, len(schemes)), replace=False)
        for idx in chosen:
            interactions.append(
                {
                    "user_id": user["user_id"],
                    "scheme_id": schemes[idx]["scheme_id"],
                    "action": _RNG.choice(actions, p=action_weights),
                }
            )
    return interactions


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def save_json(data: Any, path: str) -> None:
    """Save data as a JSON file, creating parent dirs."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved {path}  ({_size_label(path)})")


def _size_label(path: str) -> str:
    size = os.path.getsize(path)
    if size < 1024:
        return f"{size} B"
    return f"{size / 1024:.1f} KB"


# ---------------------------------------------------------------------------
# CLI entry‑point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract or generate training data for PraharAI ML models"
    )
    parser.add_argument(
        "--source",
        choices=["neo4j", "synthetic"],
        default="synthetic",
        help="Data source (default: synthetic)",
    )
    parser.add_argument(
        "--neo4j-uri",
        default=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        help="Neo4j connection URI",
    )
    parser.add_argument(
        "--neo4j-user",
        default=os.getenv("NEO4J_USER", "neo4j"),
        help="Neo4j username",
    )
    parser.add_argument(
        "--neo4j-password",
        default=os.getenv("NEO4J_PASSWORD", ""),
        help="Neo4j password",
    )
    parser.add_argument(
        "--output-dir",
        default="data/training",
        help="Directory for output files (default: data/training)",
    )
    parser.add_argument(
        "--n-users",
        type=int,
        default=1000,
        help="Number of synthetic user profiles (default: 1000)",
    )
    parser.add_argument(
        "--n-schemes",
        type=int,
        default=200,
        help="Number of synthetic schemes (default: 200)",
    )
    parser.add_argument(
        "--n-intent-per-template",
        type=int,
        default=20,
        help="Intent samples per template (default: 20)",
    )
    args = parser.parse_args()

    out = args.output_dir
    print("\n" + "=" * 60)
    print("DATA EXTRACTION / GENERATION")
    print("=" * 60)

    if args.source == "neo4j":
        if not args.neo4j_password:
            print("ERROR: --neo4j-password or NEO4J_PASSWORD env var required")
            return 1
        print(f"\nConnecting to Neo4j at {args.neo4j_uri} ...")
        extractor = Neo4jExtractor(args.neo4j_uri, args.neo4j_user, args.neo4j_password)
        try:
            schemes = extractor.extract_schemes()
            users = extractor.extract_users()
            interactions = extractor.extract_interactions()
        finally:
            extractor.close()
        print(
            f"  Extracted {len(schemes)} schemes, {len(users)} users, {len(interactions)} interactions"
        )
    else:
        print(f"\nGenerating synthetic data (seed=42) ...")
        users = generate_user_profiles(args.n_users)
        schemes = generate_schemes(args.n_schemes)
        interactions = generate_interactions(users, schemes)
        print(
            f"  Generated {len(users)} users, {len(schemes)} schemes, {len(interactions)} interactions"
        )

    # Intent data is always synthetic (templates + slot filling)
    intent_data = generate_intent_data(args.n_intent_per_template)
    # Split 80/20 train/val
    split = int(len(intent_data) * 0.8)
    intent_train = [{"query": q, "intent": i} for q, i in intent_data[:split]]
    intent_val = [{"query": q, "intent": i} for q, i in intent_data[split:]]

    print(f"\nIntent data: {len(intent_train)} train, {len(intent_val)} val")

    # Save all datasets
    print(f"\nWriting to {out}/ ...")
    save_json(users, f"{out}/users.json")
    save_json(schemes, f"{out}/schemes.json")
    save_json(interactions, f"{out}/interactions.json")
    save_json(intent_train, f"{out}/intent_train.json")
    save_json(intent_val, f"{out}/intent_val.json")

    # Manifest
    manifest = {
        "created_at": datetime.now().isoformat(),
        "source": args.source,
        "counts": {
            "users": len(users),
            "schemes": len(schemes),
            "interactions": len(interactions),
            "intent_train": len(intent_train),
            "intent_val": len(intent_val),
        },
    }
    save_json(manifest, f"{out}/manifest.json")

    print("\n" + "=" * 60)
    print("DONE — training data ready")
    print("=" * 60 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
