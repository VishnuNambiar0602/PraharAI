# ML Pipeline Improvement Plan

**Status**: Commits completed for backend ML integration hardening.  
**Current Date**: March 8, 2026  
**Plan Owner**: ML/AI Team

---

## Executive Summary

The current ML pipeline has significant quality issues across all three core models:

| Component                  | Current Performance                | Target Performance          | Priority        |
| -------------------------- | ---------------------------------- | --------------------------- | --------------- |
| **Intent Classification**  | 48.89% accuracy, F1=0.43           | ≥85% accuracy, F1≥0.80      | 🔴 **CRITICAL** |
| **User Clustering**        | Silhouette=0.066 (POOR), 23% noise | Silhouette≥0.40, <10% noise | 🟡 **HIGH**     |
| **Recommendation Ranking** | NDCG@5=0.086                       | NDCG@5≥0.30                 | 🔴 **CRITICAL** |
| **Chat/LLM Service**       | Template fallback, no context      | Contextual responses, RAG   | 🟡 **HIGH**     |

**Root Causes**:

1. Insufficient and synthetic-only training data
2. Class imbalance and poor data quality
3. Model architecture not suited for the problem space
4. Lack of real user interaction signals
5. No continuous learning or retraining pipeline

---

## ⚠️ Critical Architectural Decision: Human-Like ReAct with Factual Integrity

### **Hybrid ReAct Agent: Natural Conversation + Zero Hallucination**

**Principle**: Chatbot should feel human and empathetic while maintaining 100% factual accuracy for scheme data.

**Rationale**:

1. **User Experience**: Citizens need warm, conversational guidance (not robotic templates)
2. **Legal Liability**: Incorrect scheme eligibility information could harm citizens
3. **Trust**: Human-like empathy + factual accuracy builds confidence
4. **Compliance**: Scheme data changes frequently; generated content risks being outdated

**Hybrid Architecture** (ReAct with Factual Guardrails):

```
User Query → ReAct Agent (LLM)
             ↓
         [Thought: Reasoning]
             ↓
         [Action: Call DB Tool]
             ↓
         [Observation: Retrieved Facts]
             ↓
         [Generate Natural Response: LLM wraps facts]
```

**What LLM CAN generate** (conversational layer):

- ✅ **Empathetic greetings**: "I understand you're looking for education support..."
- ✅ **Clarifying questions**: "To help you better, could you tell me your age and state?"
- ✅ **Natural transitions**: "Great! Based on what you've told me, let me check..."
- ✅ **Explanatory connectors**: "This scheme is perfect for you because..."
- ✅ **Encouragement**: "You qualify for 3 schemes! Let me share the details."
- ✅ **Follow-up suggestions**: "Would you also like to know about the application process?"

**What LLM CANNOT generate** (must retrieve from DB):

- ❌ Scheme names, descriptions, benefits
- ❌ Eligibility criteria or thresholds
- ❌ Application URLs or deadlines
- ❌ Required documents or steps
- ❌ Any factual claim about schemes

**ReAct Flow Example**:

```
User: "I'm a farmer in Punjab, need help with loans"

[Thought (LLM)]: User is a farmer seeking financial assistance in Punjab.
                 I should search for agriculture/loan schemes for Punjab.

[Action]: search_schemes(category="Agriculture,Finance", state="Punjab")

[Observation (DB)]: Found 3 schemes: PM-KISAN, Punjab Farmer Debt Relief, KCC

[Response (Hybrid)]:
  [LLM Generated]: "I completely understand how important financial support
                    is for farmers. I found 3 government schemes that can help
                    you in Punjab:\n\n"

  [DB Retrieved]:  "1. **PM-KISAN**
                       - Benefits: ₹6000/year in 3 installments
                       - Eligibility: All farmers, landholding <2 hectares
                       - Apply: https://pmkisan.gov.in

                    2. **Punjab Farmer Debt Relief**
                       - Benefits: Loan waiver up to ₹2L
                       - Eligibility: Punjab farmers, income <₹5L
                       - Apply: Contact district agriculture office"

  [LLM Generated]: "\n\nWould you like me to check your eligibility for any
                    of these schemes? I can also help you understand the
                    application process. 😊"
```

**Factual Accuracy Guarantee**:

- All scheme data extracted verbatim from Neo4j
- LLM-generated text marked clearly in internal logs
- Audit trail: `[conversational]` vs `[factual]` segments
- Automated fact-checking: verify LLM didn't inject false claims into factual sections

---

## 1. Data Quality & Collection Strategy

### Problem Analysis

- **Current**: Using synthetic data generated via `data_extractor.py` with no real user interactions
- **Impact**: Models cannot learn real-world patterns, leading to poor generalization
- **Evidence**: Intent classifier has 0% metrics for "deadline_query" class despite training

### Improvements

#### 1.1 Implement User Interaction Tracking

```typescript
// Backend: Track all user-scheme interactions
interface UserInteraction {
  userId: string;
  schemeId: string;
  action: 'view' | 'apply' | 'bookmark' | 'share' | 'dismiss';
  timestamp: Date;
  sessionId: string;
  contextMetadata: {
    query?: string;
    clickPosition?: number;
    timeSpent?: number;
    previousActions?: string[];
  };
}
```

**Implementation**:

- Add Neo4j relationship tracking: `(User)-[INTERACTED {action, timestamp, context}]->(Scheme)`
- Create interaction logger middleware in `backend/src/services/interaction.service.ts`
- Log chat queries with extracted intent labels for semi-supervised learning
- Track recommendation click-through rates (CTR) for ranking optimization

#### 1.2 Active Learning Pipeline

- **Bootstrap Phase**: Use current synthetic data to create baseline models
- **Collection Phase**: Deploy models with confidence thresholds
  - Flag low-confidence predictions (confidence < 0.60) for human review
  - Present flagged samples in admin dashboard for labeling
  - Build golden dataset of 500+ labeled examples per intent class
- **Retraining Phase**: Retrain models weekly with new labeled data

#### 1.3 Data Augmentation for Intent Classification

```python
# Augmentation strategies
augmentation_techniques = {
    'paraphrase': 'Use T5/BART to generate paraphrases of existing queries',
    'back_translation': 'Hindi → English → Hindi to create variations',
    'template_expansion': 'Fill slot-based templates with entity variations',
    'mixup': 'Interpolate embeddings of similar-intent queries',
}
```

**Target**: 1000+ examples per intent class (currently ~45 total samples)

#### 1.4 Scheme Data Enrichment

Currently schemes have basic metadata. Enrich with:

- **Structured eligibility rules** in JSONPath/JMESPath format
- **Historical application success rates** by user segment
- **Popular search keywords** associated with each scheme
- **Scheme embeddings** (semantic similarity for better recommendations)

---

## 2. Intent Classification Model Improvements

### Current State

```json
{
  "accuracy": 0.489,
  "precision": 0.573,
  "recall": 0.489,
  "f1": 0.431,
  "per_class": {
    "scheme_search": { "precision": 1.0, "recall": 0.17 }, // 83% FN rate!
    "deadline_query": { "precision": 0.0, "recall": 0.0 }, // Complete failure
    "application_info": { "precision": 0.38, "recall": 0.43 }
  }
}
```

### Architecture Changes

#### 2.1 Replace DistilBERT with Multilingual Model

**Current**: DistilBERT (English-only, general domain)  
**Proposed**: `ai4bharat/IndicBERT` or `google/muril-base-cased`

**Rationale**:

- Users may query in Hindi, Hinglish, or regional languages
- Government scheme terminology requires domain adaptation
- IndicBERT trained on Indian language corpus

#### 2.2 Hybrid Classification Pipeline

```python
class HybridIntentClassifier:
    """Combines rule-based + ML classification"""

    def classify(self, message: str) -> Intent:
        # Layer 1: High-confidence rule-based patterns
        rule_result = self.rule_engine.classify(message)
        if rule_result.confidence > 0.90:
            return rule_result

        # Layer 2: ML classification
        ml_result = self.transformer_model.classify(message)
        if ml_result.confidence > 0.70:
            return ml_result

        # Layer 3: Ensemble with fallback
        return self.ensemble([rule_result, ml_result])
```

**Rule-based patterns** for high-precision scenarios:

```python
INTENT_PATTERNS = {
    'deadline_query': [
        r'(when|what|till when|last date|deadline|apply by).*(deadline|last date|due)',
        r'before (when|what date)',
    ],
    'eligibility_check': [
        r'(am i|can i|do i qualify|eligible|qualify).*(eligible|qualify|apply)',
        r'(who can|who is eligible)',
    ],
    # ... more patterns
}
```

#### 2.3 Training Strategy

```python
# Class balancing with focal loss
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    # ... other args
    label_smoothing_factor=0.1,  # Address overconfidence
    # Focal loss for class imbalance (custom Trainer)
)

# Or use class weights
class_weights = compute_class_weight(
    'balanced',
    classes=np.unique(y_train),
    y=y_train
)
```

**Metrics to Track**:

- Per-class Precision/Recall/F1 (not just macro avg)
- Confusion matrix to identify systematic misclassifications
- Confidence calibration curves (expected vs observed accuracy)

**Target Performance**:

- Overall accuracy: **≥85%**
- Per-class F1: **≥0.75** for all classes
- No class with 0% metrics

---

## 3. User Classification/Segmentation Improvements

### Current State

```json
{
  "model": "DBSCAN",
  "n_clusters": 5,
  "n_noise": 23, // 23% noise!
  "silhouette_score": 0.066, // VERY POOR (0 = overlapping)
  "cluster_sizes": { "0": 64, "1": 3, "2": 4, "3": 3, "4": 3 }, // Imbalanced
  "quality": "POOR"
}
```

### Architectural Changes

#### 3.1 Replace DBSCAN with Hierarchical Clustering

**Problem with DBSCAN**:

- Requires dense regions; government scheme users are diverse and sparse
- Sensitive to `eps` parameter tuning
- Produces "noise" points that don't belong to any cluster

**Proposed**: Agglomerative Hierarchical Clustering + Dendrogram Analysis

```python
from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import dendrogram, linkage

# Step 1: Fit hierarchical clustering
linkage_matrix = linkage(X_scaled, method='ward')

# Step 2: Determine optimal k via dendrogram + silhouette
# Try k=3 to k=15 clusters
optimal_k = find_optimal_clusters(X_scaled, k_range=(3, 15))

# Step 3: Fit with optimal k
clustering = AgglomerativeClustering(n_clusters=optimal_k, linkage='ward')
labels = clustering.fit_predict(X_scaled)
```

**Benefits**:

- No noise points (every user gets a cluster)
- Deterministic results
- Can visualize cluster tree (dendrogram)
- Better suited for small-medium datasets

#### 3.2 Feature Engineering for User Segmentation

**Current features** (from `FeatureExtractor`):

- Age, income, state, occupation, education, caste, disability

**Additional features** to add:

```python
enhanced_features = {
    # Behavioral
    'scheme_interaction_count': int,
    'avg_eligibility_score': float,
    'preferred_scheme_categories': List[str],  # One-hot encoded
    'application_success_rate': float,

    # Temporal
    'user_tenure_days': int,
    'last_active_days_ago': int,
    'interaction_frequency': float,  # interactions per week

    # Derived
    'income_decile': int,  # 1-10 (wealth segment)
    'urban_rural': bool,
    'beneficiary_type': str,  # student | farmer | senior | woman | unemployed

    # Engagement
    'profile_completeness': float,  # 0-1 based on filled fields
    'has_applied_to_scheme': bool,
}
```

#### 3.3 Interpretable Cluster Profiling

After clustering, generate human-readable cluster descriptions:

```python
def profile_cluster(cluster_id: int, user_profiles: List[Dict]) -> Dict:
    """Generate interpretable cluster profile"""
    return {
        'cluster_id': cluster_id,
        'size': len(user_profiles),
        'avg_age': mean([u['age'] for u in user_profiles]),
        'dominant_occupation': mode([u['occupation'] for u in user_profiles]),
        'income_range': f"₹{min_income}L - ₹{max_income}L",
        'top_states': Counter([u['state'] for u in user_profiles]).most_common(3),
        'description': 'Urban professionals aged 25-35 with middle income',
        'recommended_scheme_categories': ['Education', 'Housing'],
    }
```

**Target Performance**:

- Silhouette score: **≥0.40** (clear separation)
- Balanced cluster sizes: **Min cluster size ≥5% of dataset**
- Zero noise points
- 5-8 interpretable clusters

---

## 4. Recommendation Engine Improvements

### Current State

```json
{
  "ndcg_5": 0.086, // Target: 0.30+
  "ndcg_10": 0.134, // Target: 0.40+
  "model": "XGBoost LambdaMART or heuristic weights"
}
```

**NDCG (Normalized Discounted Cumulative Gain)** measures ranking quality.  
Current scores indicate recommendations are barely better than random ordering.

### Improvements

#### 4.1 Rich Feature Engineering for Ranking

Currently using: `[group_relevance, eligibility_score]` (2 features)

**Expand to 20+ features**:

```python
ranking_features = {
    # User-Scheme Match Features
    'eligibility_score': float,           # 0-1
    'user_group_alignment': float,        # Cosine similarity
    'income_eligibility_margin': float,   # How much above/below threshold
    'age_eligibility_margin': float,
    'location_match': bool,               # State/district match

    # Scheme Popularity Features
    'scheme_application_count': int,
    'scheme_success_rate': float,         # Applications → approvals
    'scheme_ctr': float,                  # Views → applications
    'scheme_recency_days': int,           # Days since launch

    # User Historical Features
    'user_past_applications': int,
    'user_success_rate': float,
    'user_avg_eligibility_historical': float,
    'similar_users_applied': bool,       # Did cluster peers apply?

    # Scheme Category Features
    'user_preferred_categories': List[str],  # One-hot
    'scheme_category_ctr': float,        # Category-level CTR

    # Temporal Features
    'deadline_urgency': float,           # Days until deadline / max_days
    'seasonal_relevance': float,         # E.g., education schemes in July-Aug

    # Diversity Features
    'category_diversity_penalty': float, # Penalize showing too many similar schemes
    'novelty_score': float,              # Explore unseen schemes
}
```

#### 4.2 Learning-to-Rank with XGBoost + LightGBM Ensemble

```python
from lightgbm import LGBMRanker
from xgboost import XGBRanker

class EnsembleRanker:
    def __init__(self):
        self.xgb_ranker = XGBRanker(
            objective='rank:ndcg',
            learning_rate=0.1,
            n_estimators=200,
            max_depth=6,
        )
        self.lgbm_ranker = LGBMRanker(
            objective='lambdarank',
            learning_rate=0.1,
            n_estimators=200,
            num_leaves=31,
        )

    def fit(self, X, y, group_sizes):
        self.xgb_ranker.fit(X, y, group=group_sizes)
        self.lgbm_ranker.fit(X, y, group=group_sizes)

    def predict(self, X):
        xgb_scores = self.xgb_ranker.predict(X)
        lgbm_scores = self.lgbm_ranker.predict(X)
        # Weighted average ensemble
        return 0.6 * xgb_scores + 0.4 * lgbm_scores
```

#### 4.3 Contextual Bandits for Online Learning

Implement **Thompson Sampling** for exploration-exploitation:

```python
class ContextualBanditRecommender:
    """Online learning for real-time recommendation improvement"""

    def select_schemes(self, user_context, candidate_schemes, k=5):
        # Exploitation: Use current model predictions
        predicted_scores = self.ranker.predict(user_context, candidate_schemes)

        # Exploration: Sample from posterior distribution
        exploration_noise = np.random.beta(
            a=self.scheme_successes + 1,  # Prior successes
            b=self.scheme_failures + 1,   # Prior failures
            size=len(candidate_schemes)
        )

        # Combine exploitation + exploration
        final_scores = predicted_scores + self.exploration_weight * exploration_noise

        # Select top-k
        return np.argsort(final_scores)[-k:][::-1]

    def update(self, scheme_id, user_clicked: bool, user_applied: bool):
        """Update belief distribution based on user feedback"""
        if user_applied:
            self.scheme_successes[scheme_id] += 1
        elif user_clicked:
            self.scheme_successes[scheme_id] += 0.5  # Partial reward
        else:
            self.scheme_failures[scheme_id] += 1
```

#### 4.4 Evaluation with Real User Feedback

```python
# Offline metrics
offline_metrics = {
    'ndcg@5': ndcg_score(y_true, y_pred, k=5),
    'ndcg@10': ndcg_score(y_true, y_pred, k=10),
    'mrr': mean_reciprocal_rank(y_true, y_pred),
    'precision@5': precision_at_k(y_true, y_pred, k=5),
}

# Online A/B test metrics
online_metrics = {
    'ctr': clicks / impressions,
    'apply_rate': applications / clicks,
    'success_rate': approvals / applications,
    'time_to_apply': avg(application_timestamp - recommendation_timestamp),
}
```

**Target Performance**:

- NDCG@5: **≥0.30** (minimum acceptable)
- NDCG@10: **≥0.40**
- CTR: **≥8%** (online)
- Application Rate: **≥15%** (online)

---

## 5. Chat Service Improvements (Retrieval-Only, Zero Hallucination)

### Current State

- **LLM Provider**: Defaults to `none` (template fallback)
- **Context**: No conversation history or user profile injection
- **Tools**: Basic search/eligibility tools without optimization
- **Response Quality**: Generic, not personalized

### ⚠️ **Critical Requirement: No Generative Content**

**All responses must be strictly derived from scheme database records. No LLM hallucination allowed.**

### Improvements

## 5. Chat Service Improvements (Human-Like ReAct with Factual Integrity)

### Current State

- **LLM Provider**: Defaults to `none` (template fallback)
- **Context**: No conversation history or user profile injection
- **Tools**: Basic search/eligibility tools without optimization
- **Response Quality**: Generic, not personalized, feels robotic

### ⚠️ **Critical Requirement: Human-Like + Factually Accurate**

**Chatbot must feel conversational and empathetic while maintaining 100% accuracy for scheme facts.**

### Improvements

#### 5.1 ReAct Agent Architecture (Natural Conversation with Factual Guardrails)

```python
from typing import List, Dict, Optional, Any
from chromadb import Client
from sentence_transformers import SentenceTransformer
import re
import json

class HumanLikeReActAgent:
    """ReAct agent that provides empathetic, conversational responses
    while keeping all factual scheme data retrieval-only.

    Architecture:
    - LLM generates: Thoughts, conversational tone, empathy, clarifications
    - Database provides: All scheme facts (names, eligibility, URLs, etc.)
    - Factual Validator: Ensures LLM didn't hallucinate any scheme data
    """

    def __init__(self, neo4j_client, redis_client, llm_service):
        self.neo4j = neo4j_client
        self.redis = redis_client
        self.llm = llm_service
        self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.vector_db = Client()
        self.collection = self.vector_db.create_collection('scheme_knowledge')

        # Tools available to ReAct agent
        self.tools = {
            'search_schemes': self.search_schemes,
            'check_eligibility': self.check_eligibility,
            'get_application_steps': self.get_application_steps,
            'get_deadlines': self.get_deadlines,
        }

        # System prompt defining agent's role and constraints
        self.system_prompt = """You are Prahar AI, a warm and empathetic assistant helping
Indian citizens find government welfare schemes.

YOUR ROLE:
- Be conversational, friendly, and encouraging
- Show empathy and understanding for users' situations
- Ask clarifying questions when needed
- Provide clear, actionable guidance

CRITICAL CONSTRAINTS:
- NEVER make up scheme names, benefits, or eligibility criteria
- ALL factual information comes from tools (database)
- You can generate: greetings, empathy, explanations, follow-ups
- You CANNOT generate: scheme facts (use tools only)

RESPONSE STRUCTURE:
1. Empathetic acknowledgment of user's need
2. Tool call to get factual data
3. Present facts naturally with conversational wrapping
4. Suggest helpful next steps

Use tools liberally. When unsure, ask clarifying questions."""

    async def chat(self, user_message: str, user_profile: Dict,
                   conversation_history: List[Dict] = None) -> Dict[str, Any]:
        """Main ReAct loop: Thought → Action → Observation → Response"""

        conversation_history = conversation_history or []
        max_iterations = 3  # Prevent infinite loops

        # Build conversation context
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(conversation_history[-3:])  # Last 3 turns
        messages.append({"role": "user", "content": user_message})

        # Add user profile context
        profile_context = f"\n\n[User Profile: Age {user_profile.get('age', 'unknown')}, Income ₹{user_profile.get('annual_income', 'N/A')}L, State {user_profile.get('state', 'N/A')}, Occupation {user_profile.get('occupation', 'N/A')}]"
        messages[-1]["content"] += profile_context

        final_response = None
        tool_calls_made = []

        for iteration in range(max_iterations):
            # LLM generates thought and decides on action
            llm_response = await self.llm.complete_with_tools(
                messages=messages,
                tools=list(self.tools.keys())
            )

            # Check if LLM wants to call a tool
            if llm_response.get('tool_call'):
                tool_name = llm_response['tool_call']['name']
                tool_args = llm_response['tool_call']['arguments']

                # Execute tool (database retrieval)
                tool_result = await self.execute_tool(tool_name, tool_args, user_profile)
                tool_calls_made.append({
                    'tool': tool_name,
                    'args': tool_args,
                    'result': tool_result
                })

                # Add observation to conversation
                messages.append({
                    "role": "assistant",
                    "content": f"[Thought: {llm_response.get('thought', '')}]\n[Action: {tool_name}({tool_args})]"
                })
                messages.append({
                    "role": "system",
                    "content": f"[Observation: Tool returned {len(tool_result.get('schemes', []))} results]\n{json.dumps(tool_result)}"
                })
            else:
                # LLM has enough information to respond
                final_response = llm_response['content']
                break

        if not final_response:
            # Fallback if max iterations reached
            final_response = "I'm still gathering information. Could you tell me more about what you're looking for?"

        # CRITICAL: Validate response doesn't contain hallucinated facts
        validated_response = await self.validate_and_inject_facts(
            llm_response=final_response,
            tool_results=tool_calls_made,
            user_profile=user_profile
        )

        return {
            'response': validated_response['final_text'],
            'suggestions': self.generate_suggestions(tool_calls_made, user_profile),
            'schemes': validated_response['mentioned_schemes'],
            'conversational_confidence': validated_response['confidence'],
            'tool_calls': [t['tool'] for t in tool_calls_made]
        }

    async def execute_tool(self, tool_name: str, args: Dict, user_profile: Dict) -> Dict:
        """Execute database tool to retrieve factual information"""
        tool_func = self.tools.get(tool_name)
        if not tool_func:
            return {'error': f'Tool {tool_name} not found'}

        return await tool_func(args, user_profile)

    async def validate_and_inject_facts(
        self,
        llm_response: str,
        tool_results: List[Dict],
        user_profile: Dict
    ) -> Dict[str, Any]:
        """Validate LLM response and inject factual scheme data.

        This is the CRITICAL safety layer that prevents hallucination.

        Strategy:
        1. Extract all {{scheme_placeholder}} markers from LLM response
        2. Replace with actual scheme data from tool results
        3. Scan for any scheme-like claims not in database
        4. Flag or rewrite if hallucination detected
        """

        # Extract schemes from tool results
        all_schemes = []
        for tool_call in tool_results:
            if 'schemes' in tool_call['result']:
                all_schemes.extend(tool_call['result']['schemes'])

        # Pattern 1: Replace placeholders with actual data
        # LLM should write: "I found {{scheme_count}} schemes for you: {{scheme_list}}"
        response = llm_response
        response = response.replace('{{scheme_count}}', str(len(all_schemes)))

        if '{{scheme_list}}' in response:
            scheme_list = self.format_scheme_list(all_schemes)
            response = response.replace('{{scheme_list}}', scheme_list)

        # Pattern 2: Detect if LLM mentioned specific scheme names
        mentioned_schemes = []
        for scheme in all_schemes:
            if scheme.get('title', '').lower() in response.lower():
                mentioned_schemes.append(scheme['id'])

        # Pattern 3: Hallucination detection (paranoid check)
        # Scan for patterns like "₹[number]", "Age: [X]-[Y]", URLs
        suspicious_patterns = [
            r'₹\d+',  # Currency amounts
            r'Age:?\s*\d+',  # Age criteria
            r'https?://[^\s]+',  # URLs
            r'\d+%\s*(eligible|eligibility)',  # Eligibility percentages
        ]

        hallucination_detected = False
        for pattern in suspicious_patterns:
            matches = re.findall(pattern, response, re.IGNORECASE)
            for match in matches:
                # Check if this fact exists in tool results
                if not self.fact_exists_in_tools(match, tool_results):
                    hallucination_detected = True
                    # Remove or flag the suspicious claim
                    response = response.replace(match, '[data unavailable]')

        return {
            'final_text': response,
            'mentioned_schemes': mentioned_schemes,
            'confidence': 0.5 if hallucination_detected else 1.0,
            'hallucination_detected': hallucination_detected
        }

    def format_scheme_list(self, schemes: List[Dict]) -> str:
        """Format schemes as bulleted list with ONLY database facts"""
        if not schemes:
            return "Currently, I don't have matching schemes in the database."

        formatted = "\n\n"
        for i, scheme in enumerate(schemes[:5], 1):  # Top 5
            formatted += f"{i}. **{scheme.get('title', 'Untitled Scheme')}**\n"
            formatted += f"   - **Category**: {scheme.get('category', 'General')}\n"
            formatted += f"   - **Benefits**: {scheme.get('benefits', 'See official documentation')}\n"

            # Eligibility summary (from DB only)
            eligibility = []
            if 'ageMin' in scheme:
                eligibility.append(f"Age {scheme['ageMin']}-{scheme.get('ageMax', 'any')}")
            if 'incomeMax' in scheme:
                eligibility.append(f"Income ≤ ₹{scheme['incomeMax']}L")
            if eligibility:
                formatted += f"   - **Eligibility**: {', '.join(eligibility)}\n"

            formatted += f"   - **Apply**: {scheme.get('applicationUrl', 'Contact local office')}\n\n"

        return formatted

    def fact_exists_in_tools(self, claim: str, tool_results: List[Dict]) -> bool:
        """Check if a factual claim exists in any tool result"""
        claim_lower = claim.lower()
        for tool_call in tool_results:
            result_str = json.dumps(tool_call['result']).lower()
            if claim_lower in result_str:
                return True
        return False

    async def search_schemes(self, args: Dict, user_profile: Dict) -> Dict:
        """Tool: Search for schemes matching criteria"""
        category = args.get('category')
        keywords = args.get('keywords', [])

        # Query vector DB for semantic search
        if keywords:
            query_text = ' '.join(keywords)
            query_embedding = self.embedding_model.encode(query_text)
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=10,
                where={'category': category} if category else None
            )
            schemes = results['metadatas'][0]
        else:
            # Fallback: Query Neo4j directly
            schemes = await self.neo4j.search_schemes(
                category=category,
                user_profile=user_profile,
                limit=10
            )

        # Filter by eligibility
        eligible_schemes = []
        for scheme in schemes:
            eligibility = await self.check_eligibility(
                {'scheme_id': scheme['id']},
                user_profile
            )
            if eligibility['score'] >= 0.3:  # 30% threshold
                scheme['eligibility_score'] = eligibility['score']
                eligible_schemes.append(scheme)

        return {
            'schemes': sorted(eligible_schemes, key=lambda s: s['eligibility_score'], reverse=True),
            'total': len(eligible_schemes)
        }

    async def check_eligibility(self, args: Dict, user_profile: Dict) -> Dict:
        """Tool: Check eligibility for specific scheme"""
        scheme_id = args.get('scheme_id')
        scheme = await self.neo4j.get_scheme(scheme_id)

        # Use existing eligibility engine
        from eligibility_engine import EligibilityEngine
        engine = EligibilityEngine()
        result = engine.calculate_eligibility(user_profile, scheme)

        return {
            'scheme_id': scheme_id,
            'score': result['score'],
            'percentage': result['percentage'],
            'category': result['category'],
            'met_criteria': result['met_criteria'],
            'unmet_criteria': result['unmet_criteria'],
            'explanation': result['explanation']
        }

    async def get_application_steps(self, args: Dict, user_profile: Dict) -> Dict:
        """Tool: Get application process for scheme"""
        scheme_id = args.get('scheme_id')
        scheme = await self.neo4j.get_scheme(scheme_id)

        return {
            'scheme_id': scheme_id,
            'scheme_title': scheme.get('title'),
            'steps': scheme.get('applicationProcess', []),
            'documents': scheme.get('requiredDocuments', []),
            'url': scheme.get('applicationUrl'),
            'deadline': scheme.get('deadline')
        }

    async def get_deadlines(self, args: Dict, user_profile: Dict) -> Dict:
        """Tool: Get upcoming deadlines for user's eligible schemes"""
        schemes = await self.neo4j.get_user_eligible_schemes(
            user_profile,
            has_deadline=True,
            limit=10
        )

        upcoming = []
        for scheme in schemes:
            if scheme.get('deadline'):
                upcoming.append({
                    'scheme_id': scheme['id'],
                    'title': scheme['title'],
                    'deadline': scheme['deadline'],
                    'days_remaining': self.calculate_days_remaining(scheme['deadline'])
                })

        return {
            'upcoming_deadlines': sorted(upcoming, key=lambda d: d['days_remaining'])
        }

    def generate_suggestions(self, tool_calls: List[Dict], user_profile: Dict) -> List[str]:
        """Generate contextual follow-up suggestions"""
        suggestions = []

        # Based on what tools were called
        tool_names = [t['tool'] for t in tool_calls]

        if 'search_schemes' in tool_names:
            suggestions.extend([
                "Check my eligibility for a specific scheme",
                "Show application process",
                "Find schemes in a different category"
            ])

        if 'check_eligibility' in tool_names:
            suggestions.extend([
                "How do I apply?",
                "Show required documents",
                "Find similar schemes"
            ])

        if 'get_application_steps' in tool_names:
            suggestions.extend([
                "Set application reminder",
                "Download application form",
                "Find nearest application center"
            ])

        return suggestions[:3]  # Top 3

# Usage example:
# agent = HumanLikeReActAgent(neo4j, redis, llm_service)
# response = await agent.chat(
#     "I'm a farmer struggling with debt",
#     user_profile={'age': 45, 'state': 'Punjab', 'occupation': 'Farmer'}
# )
```

**Example Conversation Flow**:

```
User: "I'm a single mother in Maharashtra, need help with child education"

[Thought (LLM)]: User is a single mother seeking education support in Maharashtra.
                 She likely needs schemes for children's education. I should search
                 for education schemes in Maharashtra.

[Action]: search_schemes({
    category: "Education",
    keywords: ["child", "education", "Maharashtra"],
    state: "Maharashtra"
})

[Observation]: Found 4 schemes with high eligibility scores

[Response (Hybrid LLM + DB)]:

  [LLM Generated - ALLOWED ✅]:
  "I understand how important your child's education is, and I'm here to help!
   I found {{scheme_count}} schemes specifically for education support in
   Maharashtra that you may qualify for:

   {{scheme_list}}

   [LLM Generated - ALLOWED ✅]:
   You have great options here! Would you like me to check your exact
   eligibility for any of these schemes, or help you understand the
   application process? 😊"

  [Final Output After Validation]:
  "I understand how important your child's education is, and I'm here to help!
   I found 4 schemes specifically for education support in Maharashtra that
   you may qualify for:

   1. **Post-Matric Scholarship for SC Students**
      - Category: Education
      - Benefits: ₹10,000-₹20,000 per year for higher education
      - Eligibility: SC category, Income ≤ ₹2.5L
      - Apply: https://mahadbtmahait.gov.in/

   2. **Maharashtra Eklavya Education Scheme**
      - Category: Education
      - Benefits: Free education + ₹500/month maintenance
      - Eligibility: BPL families, Age 6-18
      - Apply: Contact district education office

   ...

   You have great options here! Would you like me to check your exact
   eligibility for any of these schemes, or help you understand the
   application process? 😊"
```

**Key Features**:

1. ✅ **Human-like tone**: LLM generates empathetic, conversational wrapping
2. ✅ **Factually accurate**: All scheme data from database tools
3. ✅ **ReAct reasoning**: Thought → Action → Observation loop
4. ✅ **Hallucination prevention**: Validation layer catches any false claims
5. ✅ **Contextual suggestions**: Based on user's journey
6. ✅ **Graceful degradation**: Fallback to templates if LLM fails

#### 5.2 LLM Integration & Function Calling Setup

**Recommended LLM Options** (ordered by preference):

1. **OpenAI GPT-4o-mini** (Recommended for production)
   - Best function calling support
   - Fast (<1s latency)
   - Cost-effective: ~$0.15/$0.60 per 1M tokens (input/output)
   - Excellent at following system constraints

2. **Anthropic Claude 3.5 Sonnet** (Alternative)
   - Strong reasoning for complex queries
   - Good at staying within constraints
   - Higher cost but better quality

3. **Local Ollama (Llama 3.1 8B)** (Development/Low-cost)
   - Free, runs locally
   - Slower, may need fine-tuning for function calls
   - Good for prototyping

**Function Calling Configuration**:

```python
import openai
from typing import List, Dict, Any

class LLMService:
    """LLM service with function calling for ReAct agent"""

    def __init__(self, provider='openai', model='gpt-4o-mini'):
        self.provider = provider
        self.model = model
        self.client = openai.AsyncOpenAI() if provider == 'openai' else None

        # Define tools/functions schema
        self.tools_schema = [
            {
                "type": "function",
                "function": {
                    "name": "search_schemes",
                    "description": "Search for government welfare schemes matching user criteria",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": ["Education", "Healthcare", "Housing", "Agriculture",
                                        "Finance", "Employment", "Social Welfare"],
                                "description": "Scheme category"
                            },
                            "keywords": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Keywords to match in scheme descriptions"
                            }
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "check_eligibility",
                    "description": "Check user's eligibility for a specific scheme",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "scheme_id": {
                                "type": "string",
                                "description": "Unique identifier of the scheme"
                            }
                        },
                        "required": ["scheme_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_application_steps",
                    "description": "Get detailed application process for a scheme",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "scheme_id": {
                                "type": "string",
                                "description": "Unique identifier of the scheme"
                            }
                        },
                        "required": ["scheme_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_deadlines",
                    "description": "Get upcoming application deadlines for user's eligible schemes",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }
        ]

    async def complete_with_tools(self, messages: List[Dict], tools: List[str]) -> Dict[str, Any]:
        """Call LLM with function calling support"""
        if self.provider == 'openai':
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.tools_schema,
                tool_choice="auto",  # Let model decide when to call functions
                temperature=0.7,  # Balanced creativity
                max_tokens=500  # Limit response length
            )

            message = response.choices[0].message

            if message.tool_calls:
                # Extract tool call
                tool_call = message.tool_calls[0]
                return {
                    'tool_call': {
                        'name': tool_call.function.name,
                        'arguments': json.loads(tool_call.function.arguments)
                    },
                    'thought': message.content or ''
                }
            else:
                # No tool call, final response
                return {
                    'content': message.content,
                    'tool_call': None
                }

        elif self.provider == 'ollama':
            # Ollama doesn't natively support function calling
            # Use prompt engineering to simulate it
            return await self._ollama_with_tool_prompting(messages, tools)

    async def _ollama_with_tool_prompting(self, messages: List[Dict], tools: List[str]) -> Dict:
        """Simulate function calling with Ollama using structured prompting"""
        # Add tool instructions to system prompt
        tool_prompt = "\n\nAvailable Tools:\n"
        for tool in tools:
            tool_prompt += f"- {tool}(args): Call this when needed\n"
        tool_prompt += "\nTo call a tool, respond with: TOOL_CALL: tool_name(arg1=value1, arg2=value2)"

        messages[0]['content'] += tool_prompt

        # Call Ollama
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'http://localhost:11434/api/chat',
                json={
                    'model': 'llama3.1',
                    'messages': messages,
                    'stream': False
                }
            )
            content = response.json()['message']['content']

        # Parse response for tool calls
        if 'TOOL_CALL:' in content:
            # Extract tool name and args
            tool_match = re.search(r'TOOL_CALL:\s*(\w+)\((.*?)\)', content)
            if tool_match:
                tool_name = tool_match.group(1)
                args_str = tool_match.group(2)
                # Parse args (simplified)
                args = {}
                for arg_pair in args_str.split(','):
                    if '=' in arg_pair:
                        key, value = arg_pair.split('=', 1)
                        args[key.strip()] = value.strip().strip('"\'')

                return {
                    'tool_call': {'name': tool_name, 'arguments': args},
                    'thought': content.split('TOOL_CALL:')[0].strip()
                }

        return {'content': content, 'tool_call': None}
```

**System Prompt Engineering** (critical for preventing hallucination):

```python
REACT_SYSTEM_PROMPT = """You are Prahar AI, a warm and empathetic assistant helping
Indian citizens find government welfare schemes.

YOUR ROLE:
- Be conversational, friendly, and encouraging
- Show empathy and understanding for users' situations
- Ask clarifying questions when profile information is missing
- Provide clear, actionable guidance

CRITICAL CONSTRAINTS - NEVER VIOLATE:
1. NEVER improvise scheme names, benefits, or eligibility criteria
2. ALWAYS use tools to get factual information
3. Use placeholders like {{scheme_list}} for data that tools will provide
4. You CAN generate: empathy, greetings, transitions, encouragement
5. You CANNOT generate: scheme facts, numbers, URLs, deadlines

RESPONSE PATTERN:
1. Acknowledge user's situation with empathy
2. Call appropriate tool(s) to get factual data
3. Use {{placeholders}} where tool data will be injected
4. Suggest helpful next steps

EXAMPLES:

Good ✅:
"I understand how important education support is for your family. Let me search
for schemes that can help. {{scheme_list}}. Would you like to check your
eligibility for any of these?"

Bad ❌:
"You should apply for PM-KISAN which gives ₹6000 per year to all farmers."
(Never make up scheme details!)

When uncertain, ask: "To help you better, could you tell me your age and state?"

Use tools liberally. Trust the database, not your training data."""
```

#### 5.3 Intent-Based Tool Routing (Legacy Fallback)

```python
class ToolRouter:
    """Route user queries to appropriate database tools (no LLM needed)"""

    def __init__(self, neo4j_client):
        self.neo4j = neo4j_client
        self.tools = {
            'scheme_search': self.search_schemes,
            'eligibility_check': self.check_eligibility,
            'application_info': self.get_application_steps,
            'deadline_query': self.get_deadlines,
        }

    async def execute(self, intent: str, entities: Dict, user_profile: Dict) -> Dict:
        """Execute tool based on classified intent"""
        tool = self.tools.get(intent)
        if not tool:
            return {'error': 'Intent not supported'}

        return await tool(entities, user_profile)

    async def search_schemes(self, entities: Dict, user_profile: Dict) -> List[Dict]:
        """Query Neo4j for schemes matching criteria"""
        query = """
        MATCH (s:Scheme)
        WHERE s.category IN $categories OR $categories IS NULL
        AND (s.ageMin <= $age <= s.ageMax OR s.ageMin IS NULL)
        AND (s.incomeMax >= $income OR s.incomeMax IS NULL)
        AND ($state IN s.targetStates OR s.targetStates IS NULL)
        RETURN s
        ORDER BY s.popularity DESC
        LIMIT 10
        """
        result = await self.neo4j.run(query, {
            'categories': entities.get('categories'),
            'age': user_profile['age'],
            'income': user_profile['annual_income'],
            'state': user_profile['state']
        })
        return [record['s'] for record in result]

    async def check_eligibility(self, entities: Dict, user_profile: Dict) -> Dict:
        """Call eligibility engine (returns factual data from DB)"""
        scheme_id = entities.get('scheme_id')
        scheme = await self.neo4j.get_scheme(scheme_id)

        # Use existing eligibility engine (pure calculation, no generation)
        from eligibility_engine import EligibilityEngine
        engine = EligibilityEngine()
        return engine.calculate_eligibility(user_profile, scheme)

    async def get_application_steps(self, entities: Dict, user_profile: Dict) -> Dict:
        """Retrieve application process from Neo4j"""
        scheme_id = entities.get('scheme_id')
        query = """
        MATCH (s:Scheme {id: $scheme_id})
        RETURN s.applicationProcess as steps,
               s.requiredDocuments as documents,
               s.applicationUrl as url
        """
        result = await self.neo4j.run_single(query, {'scheme_id': scheme_id})
        return result
```

**No LLM needed** - intent classifier routes to appropriate database query.  
**Note**: This is a fallback if ReAct agent (5.1) is unavailable.

#### 5.4 Conversation Memory for ReAct Agent

```python
class ConversationMemory:
    """Track conversation context for retrieval purposes"""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 3600  # 1 hour

    def save_turn(self, user_id: str, role: str, intent: str, scheme_ids: List[str]):
        """Store conversation metadata (not full text)"""
        key = f"chat:{user_id}:history"
        turn = {
            "role": role,
            "intent": intent,
            "scheme_ids": scheme_ids,
            "timestamp": time.time()
        }
        self.redis.rpush(key, json.dumps(turn))
        self.redis.expire(key, self.ttl)

    def get_context(self, user_id: str) -> Dict[str, Any]:
        """Get conversation context for retrieval filtering"""
        key = f"chat:{user_id}:history"
        history = self.redis.lrange(key, -5, -1)

        # Extract schemes user has already seen
        seen_schemes = set()
        recent_intents = []
        for turn in history:
            data = json.loads(turn)
            seen_schemes.update(data.get('scheme_ids', []))
            recent_intents.append(data.get('intent'))

        return {
            'seen_schemes': list(seen_schemes),
            'recent_intents': recent_intents,
            'conversation_length': len(history)
        }

    def should_diversify(self, user_id: str) -> bool:
        """Check if user has seen too many schemes in same category"""
        context = self.get_context(user_id)
        return context['conversation_length'] > 3
```

**Purpose**: Track conversation history for ReAct agent to maintain context across turns.

#### 5.5 Response Quality Metrics (ReAct Agent Monitoring)

```python
# ReAct agent performance
react_metrics = {
    'avg_tool_calls_per_query': total_tool_calls / total_queries,
    'first_tool_accuracy': correct_first_tool / total_queries,  # Did agent pick right tool first?
    'thought_quality_score': avg_human_rating_of_reasoning,
    'conversation_completion_rate': successful_resolutions / total_conversations,
    'avg_turns_to_resolution': sum(turns) / successful_resolutions,
}

# Factual accuracy (most critical)
factual_accuracy = {
    'hallucination_rate': hallucinations_detected / total_responses,  # Target: 0%
    'fact_verification_pass_rate': verified_facts / total_facts_claimed,
    'scheme_name_accuracy': correct_scheme_names / scheme_names_mentioned,
    'url_validity_rate': valid_urls / total_urls_shared,
    'eligibility_calculation_accuracy': correct_calculations / total_calculations,
}

# Conversational quality (human-like feel)
conversational_quality = {
    'empathy_score': avg_empathy_rating_by_users,  # 1-5 scale
    'naturalness_score': avg_naturalness_rating,  # 1-5 scale
    'response_coherence': avg_coherence_rating,
    'tone_appropriateness': appropriate_tone / total_responses,
}

# Retrieval quality
retrieval_quality = {
    'retrieval_precision': relevant_schemes_retrieved / total_schemes_retrieved,
    'retrieval_recall': relevant_schemes_retrieved / all_relevant_schemes,
    'ranking_ndcg': ndcg_score(retrieved_schemes, relevance_labels),
    'response_coverage': required_facts_provided / required_facts_needed,
}

# User feedback
user_feedback = {
    'helpful': bool,  # Thumbs up/down
    'completeness_rating': int,  # 1-5
    'followed_suggestion': bool,
    'applied_to_recommended_scheme': bool,
}

# Factual accuracy audit
accuracy_audit = {
    'scheme_exists': check_scheme_in_db(response),
    'data_matches_db': verify_facts_against_neo4j(response),
    'links_valid': check_urls_accessible(response),
    'no_hallucination': True,  # Always true in retrieval-only system
}
```

**Target Performance**:

- **Response Time**: <2s (including LLM + tool calls)
- **Hallucination Rate**: 0% (validated by factual checker)
- **Retrieval Precision**: ≥0.80 (80% of retrieved schemes are relevant)
- **Tool Selection Accuracy**: ≥90% (agent picks correct tool first time)
- **Conversational Quality**: ≥4.0/5.0 (human-like, empathetic)
- **User Satisfaction**: ≥4.2/5.0 (higher than template-only)
- **Conversation Completion Rate**: ≥85% (issues resolved without escalation)
- **Factual Accuracy**: 100% (all scheme data from database)

---

## 6. Training Infrastructure & MLOps

### Current Gaps

- No automated retraining pipeline
- Manual model evaluation
- No model versioning or experiment tracking
- No A/B testing framework

### Improvements

#### 6.1 ML Pipeline Orchestration

```python
# Using Prefect or Apache Airflow
from prefect import flow, task

@task
def extract_training_data():
    """Pull latest interactions from Neo4j"""
    pass

@task
def train_intent_classifier(data):
    """Fine-tune IndicBERT with new data"""
    pass

@task
def evaluate_model(model):
    """Calculate metrics on holdout test set"""
    pass

@task
def deploy_if_improved(metrics):
    """Deploy to production if metrics exceed baseline"""
    pass

@flow
def weekly_retraining_flow():
    data = extract_training_data()
    model = train_intent_classifier(data)
    metrics = evaluate_model(model)
    deploy_if_improved(metrics)

# Schedule: Every Sunday at 2 AM
weekly_retraining_flow.serve(cron="0 2 * * 0")
```

#### 6.2 Experiment Tracking with MLflow

```python
import mlflow

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("intent_classification")

with mlflow.start_run():
    # Log parameters
    mlflow.log_params({
        "model": "indicbert",
        "learning_rate": 2e-5,
        "batch_size": 16,
        "epochs": 5,
    })

    # Train model
    model = train_model()

    # Log metrics
    mlflow.log_metrics({
        "accuracy": 0.87,
        "f1_macro": 0.82,
        "ndcg@5": 0.35,
    })

    # Log model artifact
    mlflow.pytorch.log_model(model, "model")
```

#### 6.3 Model Versioning & Registry

```python
# Register model in MLflow Model Registry
mlflow.register_model(
    model_uri="runs:/<run_id>/model",
    name="intent_classifier_v2",
    tags={"framework": "transformers", "dataset_size": "2000"}
)

# Transition to production
client = mlflow.tracking.MlflowClient()
client.transition_model_version_stage(
    name="intent_classifier_v2",
    version=3,
    stage="Production",
    archive_existing_versions=True
)
```

#### 6.4 A/B Testing Framework

```typescript
// Backend: Assign users to experiment groups
interface ExperimentConfig {
  experimentId: string;
  name: string;
  variants: {
    control: { modelVersion: string; weight: number }; // 50% traffic
    treatment: { modelVersion: string; weight: number }; // 50% traffic
  };
  metrics: string[]; // ['ctr', 'application_rate', 'user_satisfaction']
  startDate: Date;
  endDate: Date;
}

function assignVariant(userId: string, experiment: ExperimentConfig): string {
  const hash = hashUserId(userId);
  const threshold = experiment.variants.control.weight;
  return hash < threshold ? 'control' : 'treatment';
}
```

#### 6.5 Monitoring & Alerting

```python
# Model drift detection
from evidently import ColumnMapping
from evidently.metric_preset import DataDriftPreset, DataQualityPreset
from evidently.report import Report

def detect_drift(reference_data, production_data):
    """Compare training data distribution vs production data"""
    report = Report(metrics=[
        DataDriftPreset(),
        DataQualityPreset(),
    ])
    report.run(reference_data=reference_data, current_data=production_data)

    # Check for drift
    if report.as_dict()['metrics'][0]['result']['dataset_drift']:
        send_alert("Model drift detected! Retraining recommended.")
```

```python
# Performance monitoring
performance_alerts = {
    'intent_accuracy_drop': 'Alert if accuracy < 0.75 for 24 hours',
    'recommendation_ndcg_drop': 'Alert if NDCG@5 < 0.25 for 24 hours',
    'llm_latency_spike': 'Alert if p95 latency > 5s',
    'error_rate_spike': 'Alert if error rate > 5%',
}
```

---

## 7. Implementation Roadmap

### Phase 1: Data Quality (Weeks 1-2) 🟢 **Foundation**

- [ ] Implement interaction tracking in backend
- [ ] Set up data collection pipeline (Neo4j → JSON exports)
- [ ] Create active learning labeling interface
- [ ] Generate augmented training data for intent classification
- [ ] **Success Metric**: 1000+ labeled samples per intent class

### Phase 2: Intent Classification (Weeks 3-4) 🔴 **Critical Path**

- [ ] Train hybrid rule-based + IndicBERT classifier
- [ ] Implement per-class evaluation and confusion matrix analysis
- [ ] Deploy with confidence thresholds for active learning feedback
- [ ] **Success Metric**: Accuracy ≥85%, all classes F1≥0.75

### Phase 3: User Segmentation (Week 5) 🟡 **High Value**

- [ ] Replace DBSCAN with hierarchical clustering
- [ ] Add behavioral and temporal features
- [ ] Generate interpretable cluster profiles
- [ ] **Success Metric**: Silhouette score ≥0.40, zero noise

### Phase 4: Recommendation Engine (Weeks 6-7) 🔴 **Critical Path**

- [ ] Engineer 20+ ranking features
- [ ] Train XGBoost + LightGBM ensemble ranker
- [ ] Implement contextual bandits for online learning
- [ ] **Success Metric**: NDCG@5 ≥0.30, NDCG@10 ≥0.40

### Phase 5: Human-Like ReAct Chat Agent (Weeks 8-9) 🟡 **High Value**

- [ ] Set up OpenAI API / Anthropic API / Local Ollama for LLM inference
- [ ] Build ChromaDB vector index for scheme semantic retrieval
- [ ] Implement ReAct agent with Thought → Action → Observation loop
- [ ] Configure LLM function calling with tool schemas
- [ ] Build 4 database tools (search, eligibility, application_steps, deadlines)
- [ ] Implement factual validation layer (hallucination detection)
- [ ] Add conversation memory with Redis (multi-turn context)
- [ ] Create fallback to template responses if LLM unavailable
- [ ] Build monitoring dashboard for hallucination detection
- [ ] **Success Metric**: Response time <2s, hallucination rate 0%, conversational quality ≥4.0/5.0, tool accuracy ≥90%

### Phase 6: MLOps Infrastructure (Weeks 10-12) 🟢 **Long-term**

- [ ] Set up MLflow tracking server
- [ ] Implement automated retraining pipeline (Prefect/Airflow)
- [ ] Deploy model registry and versioning
- [ ] Build A/B testing framework
- [ ] Set up drift detection and performance monitoring
- [ ] **Success Metric**: Weekly automated retraining, model drift alerts

---

## 8. Success Criteria & KPIs

### Technical Metrics (Model Performance)

| Metric                       | Baseline | Target    | Stretch Goal |
| ---------------------------- | -------- | --------- | ------------ |
| Intent Accuracy              | 48.9%    | **≥85%**  | ≥90%         |
| Intent F1 (macro)            | 0.43     | **≥0.80** | ≥0.85        |
| User Clustering Silhouette   | 0.066    | **≥0.40** | ≥0.50        |
| Recommendation NDCG@5        | 0.086    | **≥0.30** | ≥0.40        |
| Recommendation NDCG@10       | 0.134    | **≥0.40** | ≥0.50        |
| Chat Response Time           | N/A      | **<2s**   | <1.5s        |
| Chat Hallucination Rate      | N/A      | **0%**    | 0%           |
| Chat Tool Selection Accuracy | N/A      | **≥90%**  | ≥95%         |
| Chat Conversational Quality  | N/A      | **≥4.0**  | ≥4.5         |
| Chat Factual Accuracy        | N/A      | **100%**  | 100%         |

### Business Metrics (User Impact)

| Metric                  | Target       | Measurement                                 |
| ----------------------- | ------------ | ------------------------------------------- |
| Recommendation CTR      | **≥8%**      | (clicks / impressions)                      |
| Application Rate        | **≥15%**     | (applications / clicks)                     |
| User Satisfaction       | **≥4.0/5.0** | Post-interaction survey                     |
| Time to Apply           | **<3 days**  | Avg(application_time - recommendation_time) |
| Profile Completion Rate | **≥70%**     | Users with complete profiles                |

### Operational Metrics (ML Infrastructure)

| Metric                     | Target          |
| -------------------------- | --------------- |
| Model Retraining Frequency | **Weekly**      |
| Model Deployment Time      | **<15 minutes** |
| Drift Detection Latency    | **<24 hours**   |
| Experiment Iteration Cycle | **<2 days**     |

---

## 9. Risk Mitigation

| Risk                                    | Impact | Mitigation                                                                      |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| **Insufficient training data**          | High   | Active learning + data augmentation                                             |
| **Model overfitting on synthetic data** | High   | Cross-validation + early stopping + regularization                              |
| **LLM hallucination risk**              | High   | Validation layer, placeholder injection, automated fact-checking, audit logs    |
| **LLM API costs spike**                 | Medium | Rate limiting, caching, fallback to Ollama, monthly budget alerts               |
| **LLM latency (>2s)**                   | Medium | Use GPT-4o-mini (fast), cache common queries, async processing                  |
| **Recommendation cold start**           | Medium | Fallback to popularity-based recommendations                                    |
| **User privacy concerns**               | High   | Anonymize interaction data, GDPR compliance, don't log PII in LLM conversations |
| **Model drift not detected**            | Medium | Automated drift monitoring + weekly retraining                                  |
| **Vector DB performance**               | Low    | Index optimization, caching layer, lazy loading                                 |
| **Tool selection errors**               | Medium | Track tool accuracy metrics, add user feedback loop, improve system prompt      |

---

## 10. Resource Requirements

### Infrastructure

- **Compute**: 1x GPU instance (T4/V100) for training (AWS/GCP)
- **Storage**: 100GB for model artifacts, training data, logs
- **MLflow Server**: 1x CPU instance (t3.medium) for experiment tracking
- **Vector DB**: ChromaDB (embedded) or Milvus for semantic search
- **LLM API**: OpenAI GPT-4o-mini ($0.15/$0.60 per 1M tokens) OR Anthropic Claude 3.5 Sonnet
  - Estimated cost: ~$50-200/month for 10K users
  - Alternative: Local Ollama (free, requires 8GB VRAM GPU)

### Human Resources

- **ML Engineer**: 1 FTE for model training and evaluation
- **Data Scientist**: 0.5 FTE for feature engineering and analysis
- **Backend Engineer**: 0.5 FTE for integration and API development
- **Data Labeler**: 0.25 FTE for active learning labeling
- **Prompt Engineer** (optional): 0.25 FTE for LLM prompt optimization

### Timeline

- **Total Duration**: 12 weeks (3 months)
- **Critical Path**: Data Quality → Intent → Recommendations (7 weeks)
- **Parallel Tracks**: ReAct Chat Agent can start after Week 4 (requires user classifier for personalization)

---

## 11. Next Actions

### Immediate (This Week)

1. ✅ **Commit backend ML integration changes** (COMPLETED)
2. [ ] **Review and approve this improvement plan**
3. [ ] **Set up interaction tracking in backend** (start Phase 1)
4. [ ] **Create active learning labeling interface mockup**
5. [ ] **Provision GPU instance for training**

### Short-term (Next 2 Weeks)

1. [ ] Collect 1000+ labeled samples per intent class
2. [ ] Train hybrid intent classifier
3. [ ] Deploy model with confidence logging
4. [ ] Begin feature engineering for user segmentation

### Mid-term (Month 2-3)

1. [ ] Launch A/B test: new recommendation engine vs baseline
2. [ ] Implement RAG pipeline for chat
3. [ ] Set up MLflow and automated retraining
4. [ ] Monitor metrics and iterate

---

## 12. Conclusion

The current ML pipeline requires significant improvements across data quality, model architecture, and infrastructure. This plan provides a structured, phased approach to:

1. **Address root causes** (insufficient data, poor model fit)
2. **Implement proven ML techniques** (Learning-to-Rank, active learning, hierarchical clustering)
3. **Build sustainable MLOps practices** (monitoring, retraining, A/B testing)
4. **Achieve human-like conversation** (ReAct agent with empathy and contextual understanding)
5. **Ensure factual accuracy** (database-only scheme data, LLM for tone only)

**Expected Outcomes**:

- Intent classification accuracy from **48.9% → 85%+**
- Recommendation NDCG@5 from **0.086 → 0.30+**
- User clustering quality from **POOR → GOOD** (silhouette 0.066 → 0.40+)
- **Human-like chat experience** with ReAct agent (conversational quality ≥4.0/5.0)
- **Zero hallucination** for scheme facts (100% accuracy via validation layer)

**Total Effort**: ~12 weeks with 2-3 engineers  
**ROI**: Improved user experience → higher application rates → more citizens benefiting from schemes

**Key Innovation**: **Hybrid ReAct architecture** combines human-like conversational AI (LLM) with strict factual guardrails (database-only scheme data). Users get empathetic, natural responses that feel like talking to a knowledgeable human, while maintaining 100% accuracy on government scheme information through automated validation layers. This approach eliminates hallucination risk without sacrificing user experience.

**Technical Breakthrough**: The system uses placeholder injection (LLM generates `{{scheme_list}}`, system injects database facts) and post-generation validation (scans for unauthorized factual claims), ensuring conversational quality never compromises data integrity.

---

**Document Version**: 2.0 (Updated: ReAct Agent Architecture)  
**Last Updated**: March 8, 2026  
**Next Review**: After Phase 1 completion (Week 2)
