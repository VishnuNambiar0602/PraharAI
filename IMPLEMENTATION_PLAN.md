# Full-Day Development Implementation Plan

**Date**: March 6, 2026  
**Branch**: feat/ml-pipeline-setup  
**Status**: In Progress → ✅ ALL PHASES COMPLETED

---

## 🎯 Objective

Systematically enhance the PraharAI backend to support:

1. **Intelligent ReAct Agent** - Multi-tool orchestration for complex queries
2. **Database Optimization** - Fast queries, better indexing
3. **ML Model Training** - Custom models for better predictions
4. **Caching Layer** - Redis-based response caching
5. **Advanced Features** - Multi-step reasoning, user segmentation

**Expected Outcome**: Agent can handle complex multi-step queries, system is 2-3x faster, and ML models are trainable.

---

## 📋 Current Architecture

### Existing Components

- ✅ ML Service (FastAPI on port 8000) - Classify, Recommend, Eligibility endpoints
- ✅ Similarity Agent - Basic scheme matching with category filters
- ✅ Backend Server (Express on port 3000) - User auth, scheme management
- ✅ Neo4j Graph DB - Schemes, users, categories
- ✅ Redis Cache - Session storage (under-utilized)
- ✅ Profile Extractor - Entity extraction from messages

### Missing/Incomplete

- ❌ ReAct Agent - Doesn't exist yet
- ❌ Tools Registry - No centralized tool management
- ❌ Neo4j Indexes - Some queries are slow
- ❌ ML Training Pipeline - Models not trainable
- ❌ User Segmentation - No clustering
- ❌ Advanced Caching - Only session caching used

---

## 📅 Development Phases

### Phase 1: ReAct Agent Architecture (Hours 0-2) 🔥 HIGH PRIORITY

**Status**: ✅ COMPLETED - All 5 tasks implemented and committed

**Files Created/Modified**:

✅ `backend/src/agents/react-agent.ts` (NEW, 450 lines) - Core ReAct agent with thought/action loop
✅ `backend/src/agents/tools/types.ts` (NEW, 120 lines) - Type definitions (Tool, Thought, Action, etc.)
✅ `backend/src/agents/tools/registry.ts` (NEW, 70 lines) - ToolRegistry singleton with registration
✅ `backend/src/agents/tools/base.ts` (NEW, 90 lines) - BaseTool abstract class with validation
✅ `backend/src/agents/tools/index.ts` (NEW, 25 lines) - Tool module exports
✅ `backend/src/agents/tools/scheme-tools.ts` (NEW, 210 lines) - 3 scheme lookup tools
✅ `backend/src/agents/tools/profile-tools.ts` (NEW, 340 lines) - 3 profile/eligibility tools
✅ `backend/src/agents/__tests__/registry.test.ts` (NEW, 130 lines) - Unit tests
✅ `backend/src/agents/index.ts` (MODIFIED) - Export tools, add initializeTools()
✅ `backend/src/api/server.ts` (MODIFIED) - Add `/api/react-chat` endpoint
✅ `IMPLEMENTATION_PLAN.md` (MODIFIED) - Plan document created

**What Was Built**:

1. ✅ Tool registry system (ToolRegistry class + BaseTool abstract)
2. ✅ 6 fully functional core tools:
   - `SearchSchemesTool` - Find schemes by keyword (top 10 matches)
   - `GetSchemeDetailsTool` - Full scheme information retrieval
   - `GetSchemesByCategoryTool` - Filter by employment/education/locality
   - `CheckEligibilityTool` - Eligibility scoring (ML + rule-based fallback)
   - `UpdateUserProfileTool` - Persist profile changes to Neo4j
   - `GetUserProfileTool` - Retrieve user profile with completion %

3. ✅ ReAct agent loop:
   - Thought generation (ML intent classification or rule-based)
   - Action selection based on observations
   - Tool execution via centralized registry
   - Observation interpretation
   - Multi-step orchestration (max 5 iterations)

4. ✅ New endpoint `/api/react-chat`:
   - Request: `{ message, conversationHistory? }`
   - Response: `{ response, thinking[], toolsUsed[], confidence }`
   - Auto-profile extraction and updates
   - ML fallback to rule-based

**Success Criteria - ALL MET**:

✅ Agent successfully calls 6 tools
✅ Multi-step queries working (search → check eligibility → return results)
✅ Tool errors handled gracefully (no crashes)
✅ Response integration with Neo4j and ML service
✅ ML fallback to rule-based when models unavailable

**Git Commits**:

- `docs: create comprehensive implementation plan for backend development`
- `feat: add tools base class, registry, and type definitions`
- `feat: implement scheme lookup and eligibility tools`
- `feat: implement ReAct agent core and /api/react-chat endpoint`

**Project Impact**:

- Completion: 75% → 85% (before Phase 1) → 87-88% (after Phase 1)
- New capability: Intelligent multi-tool orchestration for complex queries

---

### Phase 2: Neo4j Query Optimization (Hours 2-3) ⚡ HIGH IMPACT

**Status**: ✅ COMPLETED

**Files to Modify**:

- `backend/src/db/neo4j.service.ts` - Add indexes, optimize queries
- `backend/src/agents/tools/scheme-tools.ts` - Use optimized queries

**What Gets Built**:

1. Indexes:
   - Index on scheme name (full-text search)
   - Index on scheme tags
   - Index on scheme state
   - Index on user state + employment combo

2. Query optimizations:
   - Add LIMIT early to queries
   - Use indexed properties only in WHERE clauses
   - Add execution plans for slow queries

3. Caching layer:
   - Cache "top 20 schemes by state" for 1 hour
   - Cache "user profile by id" for 30 min

**Success Criteria**:

- Scheme search queries: 500ms → 50ms
- User profile fetch: 300ms → 30ms
- No slow logs in Neo4j

**Git Commits**:

- `perf: add Neo4j indexes for common queries`
- `perf: optimize scheme search queries`
- `perf: add query result caching`

---

### Phase 3: ML Training Pipeline (Hours 3-4) 🤖 FOUNDATION

**Status**: ✅ COMPLETED

**Files to Create**:

- `ml-pipeline/training/data_extractor.py` (NEW) - Pull data from Neo4j
- `ml-pipeline/training/intent_trainer.py` (NEW) - Train intent classifier
- `ml-pipeline/training/recommendation_trainer.py` (NEW) - Train ranker
- `ml-pipeline/training/evaluate.py` (NEW) - Evaluate models
- `ml-pipeline/training/README.md` (NEW) - Training documentation

**What Gets Built**:

1. Data pipeline:
   - Extract scheme data from Neo4j
   - Extract user interaction history (or simulate)
   - Feature engineering (vectorize schemes, users)

2. Training scripts:
   - Intent classifier on custom Indian scheme dataset
   - Recommendation ranker with user preference data
   - User segmentation (K-Means clustering)

3. Model evaluation:
   - Intent classification accuracy
   - Recommendation NDCG@10
   - User segment quality

4. Integration:
   - Models saved to `ml-pipeline/models/`
   - LoadModels on startup in api.py
   - Models served via existing endpoints

**Success Criteria**:

- Can train models without external data
- Intent classifier achieves >80% accuracy
- Recommendation ranker improves relevance

**Git Commits**:

- `feat: add ML training data pipeline`
- `feat: add intent classifier trainer`
- `feat: add recommendation ranker trainer`
- `feat: add model evaluation framework`

---

### Phase 4: Redis Caching Layer (Hours 4-5) ⚡ SPEED BOOST

**Status**: ✅ COMPLETED

**Files Modified/Created**:

✅ `backend/src/db/redis.service.ts` - CacheTTL constants, CacheStats tracking, hit/miss counters
✅ `backend/src/db/neo4j.service.ts` - All 10 hardcoded TTLs replaced with CacheTTL constants
✅ `backend/src/api/server.ts` - /health endpoint includes cache stats
✅ `backend/src/agents/tools/recommendation-tools.ts` (NEW) - GetRecommendationsTool with ML+graph ranking
✅ `backend/src/agents/index.ts` - Tool registration with double-registration guard

**What Gets Built**:

1. Cache strategies:
   - Scheme details by ID (30 min TTL)
   - Recommendations by user (15 min TTL, invalidate on profile update)
   - Scheme search results (10 min TTL)
   - User profiles (10 min TTL)

2. Cache invalidation:
   - On scheme sync, invalidate scheme caches
   - On profile update, invalidate user caches
   - Health check every 30s to clear stale entries

3. Monitoring:
   - Track cache hit rates
   - Log evictions
   - Add cache stats to `/health` endpoint

**Success Criteria**:

- Cache hit rate >60% for scheme queries
- Cached responses <10ms
- No stale data served

**Git Commits**:

- `perf: expand Redis caching for schemes`
- `perf: add recommendation result caching`
- `perf: add cache invalidation logic`

---

### Phase 5: Advanced Agent Features (Hours 5-6) 🧠 REASONING

**Status**: ✅ COMPLETED

**Files Modified/Created**:

✅ `backend/src/agents/react-agent.ts` - Complete rewrite: planning, context management, multi-intent
✅ `backend/src/agents/tools/compound-tools.ts` (NEW) - FindBestSchemesTool, AnalyzeEligibilityTool
✅ `backend/src/agents/tools/index.ts` - Exports for all new tools
✅ `backend/src/agents/index.ts` - Registration of compound tools

**What Gets Built**:

1. Planning:
   - Agent generates multi-step plan before executing
   - Example: "Search schemes" → "Filter by eligibility" → "Rank by relevance"
   - Each step uses separate tool call

2. Context management:
   - Maintain intermediate results across tool calls
   - Example: Remember found schemes while checking eligibility
   - Summarize context for LLM (truncate if needed)

3. Compound tools:
   - `find_best_schemes_for_user(userId, count)` - Does 3 steps internally
   - `analyze_user_eligibility(userId)` - Checks multiple schemes
   - Better error recovery (if eligibility check fails, skip and continue)

**Success Criteria**:

- Can answer complex queries with 3+ tool calls
- Context management handles 10+ intermediate results
- Tool failures don't stop agent
- Response quality improved >20%

**Git Commits**:

- `feat: add agent planning step`
- `feat: add context management for multi-step queries`
- `feat: add compound tools`

---

### Phase 6: User Segmentation Model (Hours 6-7) 📊 PERSONALIZATION

**Status**: ✅ COMPLETED

**Files Created**:

✅ `backend/src/classification/user-segmentation.ts` (NEW) - 5 predefined segments, rule-based scoring, ML fallback, reRankBySegment
✅ `backend/src/classification/index.ts` - Updated exports
✅ Integrated into recommendation-tools.ts and compound-tools.ts (40% segment weight)

**What Gets Built**:

1. User segments:
   - Segment 1: Young professionals (age 25-35, high income)
   - Segment 2: Farmers & rural (employment: farmer, low income)
   - Segment 3: Students & education seekers
   - Segment 4: Social benefit seekers (disability, minority)
   - Segment 5: Inactive/new users

2. Segment-specific recommendations:
   - Each segment has preferred scheme types
   - Personalize ranking by segment
   - Pre-compute batch recommendations for active segments

3. Integration:
   - Assign user to segment on profile completion
   - Use segment in recommendation ranking (40% weight)
   - Update segment monthly

**Success Criteria**:

- 5 well-balanced segments
- Segment-specific recommendations 15% better
- Can batch generate recommendations for entire segment

**Git Commits**:

- `feat: add user segmentation model`
- `feat: integrate segmentation into recommendations`
- `feat: add batch recommendation generation`

---

### Phase 7: Testing & Integration (Hours 7-8) ✅ VALIDATION

**Status**: ✅ COMPLETED

**Files Created**:

✅ `backend/src/agents/__tests__/react-agent.test.ts` (NEW) - 10 agent unit tests
✅ `backend/src/agents/__tests__/tools.test.ts` (NEW) - 32 tool integration tests
✅ `backend/src/classification/__tests__/user-segmentation.test.ts` (NEW) - 13 segmentation tests
✅ `backend/src/agents/tools/__tests__/registry.test.ts` - Fixed import paths (10 tests)

**Result**: 55 tests passing across 4 suites

**What Gets Built**:

1. Unit tests:
   - Each tool works in isolation
   - Agent handles tool errors gracefully
   - Context management is correct

2. Integration tests:
   - Full chat flow: Frontend → Backend → Tools → Response
   - Agent + ML service interaction
   - Database state consistency

3. Performance tests:
   - Response time benchmarks
   - Cache effectiveness
   - Model inference latency

**Success Criteria**:

- All tests passing
- > 80% code coverage for new code
- No regressions from baseline

**Git Commits**:

- `test: add ReAct agent tests`
- `test: add tools integration tests`
- `test: add end-to-end chat flow tests`

---

## 🗺️ Detailed Task Breakdown

### Phase 1 Detailed Tasks

#### Task 1.1: Tools Base Class & Registry

**What**: Create abstract tool class and registry
**Files**: `backend/src/agents/tools/types.ts`, `backend/src/agents/tools/registry.ts`
**Code**:

```typescript
// Tool interface
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute(params: Record<string, any>): Promise<any>;
}

// Registry class
class ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
}
```

**Time**: 20 min
**Tests**: Unit test for registry add/get/list

#### Task 1.2: Scheme Tools

**What**: Implement scheme search and details tools
**Files**: `backend/src/agents/tools/scheme-tools.ts`
**Tools**:

- `search_schemes(query: string, count?: number, state?: string)`
- `get_scheme_details(schemeId: string)`

**Dependencies**:

- Neo4j service for queries
- Use cache from Phase 4

**Time**: 30 min
**Tests**: Test with real schemes from Neo4j

#### Task 1.3: Eligibility & Profile Tools

**What**: Implement eligibility checking and profile management
**Files**: `backend/src/agents/tools/profile-tools.ts`
**Tools**:

- `check_eligibility(userId: string, schemeId: string)`
- `update_user_profile(userId: string, updates: Record<string, any>)`
- `get_user_profile(userId: string)`

**Dependencies**:

- Neo4j service
- ML service (if eligibility needs ML call)

**Time**: 30 min
**Tests**: Test profile persistence

#### Task 1.4: ReAct Agent Core

**What**: Implement the reasoning loop
**Files**: `backend/src/agents/react-agent.ts`
**Flow**:

```
Input Message
  ↓
Classify Intent (call ML or rule-based)
  ↓
Generate Thought (reason about next step)
  ↓
Select Tool (pick tool for current step)
  ↓
Execute Tool (run with input params)
  ↓
Observe Result (analyze tool output)
  ↓
Loop? Yes → Iterate | No → Generate Response
```

**Dependencies**:

- Tool registry
- ML classify endpoint
- Tools

**Time**: 45 min
**Tests**: Test full loop with mock tools

#### Task 1.5: Chat Endpoint Integration

**What**: Add `/api/react-chat` endpoint
**Files**: `backend/src/api/server.ts`
**Endpoint**:

```typescript
POST /api/react-chat
{
  message: string;
  conversationHistory?: { role: string; content: string }[];
}
→
{
  response: string;
  thinking: string; // Show agent reasoning
  toolsUsed: string[];
  confidence: number;
}
```

**Time**: 20 min
**Tests**: Integration test with chat flow

---

### Implementation Dependencies

```
Phase 1 (Core)
  ├→ Phase 2 (Speed)
  ├→ Phase 3 (ML) - Uses tools from Phase 1
  ├→ Phase 4 (Cache)
  ├→ Phase 5 (Advanced)
  └→ Phase 7 (Testing)

Phase 6 (Segmentation) - Uses trained models from Phase 3
```

---

## 📊 Progress Tracking

| Phase | Task                        | Status  | Commits | Notes |
| ----- | --------------------------- | ------- | ------- | ----- |
| 1     | Tools Base Class            | ⏳ TODO | -       | -     |
| 1     | Scheme Tools                | ⏳ TODO | -       | -     |
| 1     | Profile & Eligibility Tools | ⏳ TODO | -       | -     |
| 1     | ReAct Agent Core            | ⏳ TODO | -       | -     |
| 1     | Chat Endpoint               | ⏳ TODO | -       | -     |
| 2     | Neo4j Indexes               | ⏳ TODO | -       | -     |
| 2     | Query Optimization          | ⏳ TODO | -       | -     |
| 2     | Caching Layer               | ⏳ TODO | -       | -     |
| 3     | Data Extraction             | ⏳ TODO | -       | -     |
| 3     | Intent Trainer              | ⏳ TODO | -       | -     |
| 3     | Recommendation Trainer      | ⏳ TODO | -       | -     |
| 3     | Model Evaluation            | ⏳ TODO | -       | -     |
| 4     | Redis Caching               | ⏳ TODO | -       | -     |
| 5     | Planning & Context          | ⏳ TODO | -       | -     |
| 5     | Compound Tools              | ⏳ TODO | -       | -     |
| 6     | User Segmentation           | ⏳ TODO | -       | -     |
| 7     | Unit Tests                  | ⏳ TODO | -       | -     |
| 7     | Integration Tests           | ⏳ TODO | -       | -     |

---

## 🚀 Getting Started

### Setup

```bash
# Already on feat/ml-pipeline-setup branch
git status

# Create new feature branch if needed
git checkout -b feat/react-agent

# Pull latest
git pull origin main
```

### Development Workflow

1. Work on phase/task
2. When task complete, commit with descriptive message
3. Update this document with progress
4. Move to next task

### Testing During Development

```bash
# Backend tests
cd backend && npm test

# Type checking
cd backend && npm run type-check

# Linting
cd backend && npm run lint
```

---

## 📝 Notes

- All new code should follow existing TypeScript patterns
- Error handling required (don't let one tool crash agent)
- Logging for debugging (`console.log` with emoji prefixes)
- Update types.ts as needed
- Neo4j queries must be tested with real data

---

**Last Updated**: 2026-03-06 (Just created)  
**Next Update**: After Phase 1 completion
