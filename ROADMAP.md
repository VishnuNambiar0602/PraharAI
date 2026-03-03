# Prahar AI — Project Roadmap

> **Personalized Government Scheme Recommendation System for India**
> This document consolidates all known issues, planned features, confirmed bugs, architectural improvements, and long-term vision for the project. Items are grouped by domain and prioritized into phases.

---

## Current State Summary (as of March 2026)

| Component | Status |
|-----------|--------|
| Backend (Express/TypeScript, port 3000) | ✅ Running |
| Frontend (React 19 + Vite 6 + Tailwind v4, port 5173) | ✅ Running |
| SQLite persistent database | ✅ 4,609 real schemes stored |
| India.gov.in API sync (24h interval) | ✅ Working |
| Similarity Agent (category + text scoring) | ✅ Working (bug fixed) |
| Chatbot (ReAct agent + tools) | ⚠️ Partially working — uses DB but NLP/ML not integrated |
| ML Pipeline (Python) | ⚠️ Built but not connected to backend |
| Multilingual support | ❌ Not implemented |
| Auth guard on all protected pages | ⚠️ Partial — only AI Chat and Profile are guarded |
| "Apply Now" links | ⚠️ All schemes show placeholder, no real URLs |
| Gender field in registration | ❌ Missing |
| Onboarding flow | ⚠️ Basic — needs profile-builder wizard |

---

## Phase 1 — Critical Fixes & Core UX (Immediate)

### 1.1 Frontend: Real Data vs Mock Data

**Current state:** Frontend fetches real data from backend (`/api/schemes`, `/api/chat`). However:
- `SchemeExplorer.tsx` fetches real schemes from SQLite ✅
- `ChatAssistant.tsx` posts to `/api/chat` ✅
- `LandingPage.tsx` hero stats ("22+ languages", "10,000+ schemes") are hardcoded strings ❌
- Scheme cards show `benefits: 'Government of India'` for all schemes (ministry field used as benefits) — needs proper mapping ❌

**Tasks:**
- [ ] Map `ministry` → `benefits` properly in `schemes.controller.ts`
- [ ] Include `applicationUrl` / `schemeUrl` field from India.gov.in API in the `Scheme` type and store in SQLite
- [ ] Show real scheme count on landing page from `/api/schemes/stats` endpoint (to be created)

---

### 1.2 "Apply Now" — Real Redirect URLs

**Current state:** Every scheme card has an `Apply Now` button that goes nowhere (no `href`). The India.gov.in API returns a `schemeUrl` or `url` field for most schemes.

**Tasks:**
- [ ] In `india-gov.service.ts`: extract and map the `schemeUrl` / `url` field from API response
- [ ] In `sqlite.service.ts`: add `scheme_url TEXT` column to `schemes` table
- [ ] In `storeSchemes()`: persist `scheme_url` 
- [ ] In `schemes.controller.ts`: include `applicationUrl` in the response shape
- [ ] In frontend `types.ts`: add `applicationUrl?: string` to `Scheme`
- [ ] In `SchemeExplorer.tsx`: make "Apply Now" open `applicationUrl` in a new tab; fallback to `https://www.india.gov.in/spotlight/government-schemes` if no URL
- [ ] For all schemes: if no specific URL, link to the scheme's India.gov.in search page: `https://www.myscheme.gov.in/search?q={schemeId}`

---

### 1.3 Auth Guard — All Protected Pages

**Current state:** Only `assistant` and `profile` views redirect to login. `schemes` (Scheme Explorer) is accessible without login.

**Tasks:**
- [ ] In `App.tsx`: add `schemes` to the protected views list
- [ ] Keep `home`, `about`, `contact` publicly accessible
- [ ] Gate: `schemes`, `assistant`, `profile`, `partner` — require auth
- [ ] After login, redirect back to the view the user was trying to access (store `intendedView` state)

---

### 1.4 Auth: Add Gender Field

**Current state:** Registration has email, password, name. No gender field.

**Tasks:**
- [ ] In `LoginPage.tsx` register form: add Gender dropdown (Male / Female / Other / Prefer not to say)
- [ ] In `backend/src/api/server.ts` `users[]` array shape: add `gender` field
- [ ] In `UserProfile.tsx`: display and allow editing of gender
- [ ] In `similarity-agent.ts` `UserProfile` interface: add `gender?: string`
- [ ] Use gender in category filters for schemes tagged "Women" — if user is Female, auto-add `SocialCategory: Women` boost

---

### 1.5 Onboarding — Profile Builder Wizard

**Current state:** After signup, user lands on home page with no guidance. Profile fields are only editable in the Profile page. No onboarding flow.

**Desired flow:**
1. User signs up → short 4-step wizard appears
2. Step 1: Basic info (name, age, state, gender)
3. Step 2: Employment & income
4. Step 3: Education & social category
5. Step 4: Interests / scheme categories they care about
6. Wizard saves profile → redirects to Scheme Explorer with personalized results

**Tasks:**
- [ ] Create `frontend_new/src/components/OnboardingWizard.tsx` — 4-step form
- [ ] On step completion, call `PATCH /api/users/:id/profile` for each step
- [ ] Store `onboardingComplete: boolean` in user object
- [ ] In `App.tsx`: after login/signup, if `!onboardingComplete` → show wizard before any other view
- [ ] Wizard should be skippable

---

## Phase 2 — Chatbot & AI Improvements

### 2.1 Fix Chatbot — Complete ReAct Agent Integration

**Current state:** The ReAct agent (`react-agent.ts`) exists and is wired to the chat service. However:
- Most messages are intercepted by `handleQuickResponses()` fast-path and never reach the ReAct agent
- The ReAct agent's `search_schemes` and `check_eligibility` tools do use `similarityAgent` → SQLite ✅
- But the fast-path `handleSchemeQuery()` was using hardcoded sample data (fixed, now uses SQLite)
- There is no actual LLM/generative model — responses are template strings

**Tasks:**
- [ ] Remove overly broad keyword intercepts from `handleQuickResponses()` that bypass the ReAct agent
- [ ] Let the ReAct agent handle all scheme queries — it has proper tooling
- [ ] Add `get_scheme_details` tool to ReAct agent to look up a specific scheme by ID/name from SQLite
- [ ] Improve agent response formatting — parse `SchemeMatch[]` from tools into rich markdown

---

### 2.2 Integrate ML Pipeline Intent Classifier

**Current state:** `ml-pipeline/src/intent_classifier.py` exists — DistilBERT-based intent classifier with 7 intents (`scheme_search`, `eligibility_check`, `application_info`, `deadline_query`, `profile_update`, `general_question`, `nudge_preferences`). It is **not connected** to the backend.

**Integration plan:**
- [ ] Expose the Python ML pipeline as an HTTP microservice (FastAPI, port 8000)
  - `POST /classify` — returns `{intent, confidence, entities}`
  - `POST /recommend` — returns ranked scheme IDs for a user vector
- [ ] In `chat.service.ts`: before routing to ReAct agent, call `http://localhost:8000/classify` to get intent + entities
- [ ] Route to the right tool based on intent:
  - `scheme_search` → `search_schemes` tool
  - `eligibility_check` → `check_eligibility` tool
  - `application_info` → `get_application_info` tool (new)
  - `profile_update` → existing profile update path
- [ ] Add entity extraction results (location, income, occupation) to the tool parameters

---

### 2.3 Integrate ML Recommendation Engine

**Current state:** `ml-pipeline/src/recommendation_engine.py` — K-Means user clustering + cosine similarity scheme ranking. Not connected.

**Tasks:**
- [ ] Add `POST /recommend` endpoint to the ML microservice
- [ ] Accept `userVector` (employment, income, age, state, socialCategory as numeric features)
- [ ] Return top-N scheme IDs ranked by cosine similarity
- [ ] In `similarity-agent.ts`: call ML service as a secondary ranking pass after SQLite category filter
- [ ] Fall back gracefully to SQLite-only ranking if ML service is unavailable

---

### 2.4 Connect Eligibility Engine

**Current state:** `ml-pipeline/src/eligibility_engine.py` — cosine similarity eligibility scoring. Not connected.

**Tasks:**
- [ ] Add `POST /eligibility` to ML microservice
- [ ] Accept `{userProfile, schemeId}` — return `{score, explanation, matched_criteria}`
- [ ] In `check_eligibility` ReAct tool: use ML eligibility score when available, fall back to rule-based scoring
- [ ] Surface detailed eligibility breakdown in chatbot response

---

### 2.5 Add Generative Response Layer

**Current state:** All chatbot responses are hand-crafted template strings. No generative AI.

**Options (ordered by complexity):**
- [ ] **Option A (Quick):** Use Ollama locally with `llama3.2` or `gemma2` as the response generator — free, runs offline
- [ ] **Option B (Recommended):** Integrate OpenAI/Gemini API as an optional layer — use it only for response phrasing, not for tool execution (which stays deterministic via ReAct + SQLite)
- [ ] **Option C:** Fine-tune a small model on Indian government scheme Q&A data

**For any option:**
- [ ] Add `LLM_PROVIDER` env var (`ollama` / `openai` / `gemini` / `none`)
- [ ] Create `backend/src/services/llm.service.ts` — abstract LLM interface
- [ ] ReAct agent passes tool results + user context to LLM for final response generation
- [ ] If no LLM configured, fall back to current template responses

---

### 2.6 Add NLP Entity Extraction

**Current state:** Chat messages have no entity extraction. The intent classifier in ML pipeline does extract entities but isn't connected.

**Tasks:**
- [ ] Extract entities from user messages: state names, income amounts, age, caste categories, scheme names
- [ ] Use extracted entities to:
  - Pre-fill profile fields ("I am 25 years old" → store `age: 25`)
  - Filter schemes in tool parameters
  - Personalise responses

---

## Phase 3 — Multilingual Support

**Current state:** `AboutPage.tsx` claims "22+ official Indian languages" but nothing is implemented. The India.gov.in API returns scheme data primarily in English with some Hindi.

### 3.1 i18n Framework

- [ ] Install and configure `i18next` + `react-i18next` in `frontend_new`
- [ ] Create `frontend_new/src/locales/` directory with JSON files per language
- [ ] Start with: `en`, `hi` (Hindi), `ta` (Tamil), `te` (Telugu), `bn` (Bengali), `mr` (Marathi), `gu` (Gujarati), `kn` (Kannada), `ml` (Malayalam), `pa` (Punjabi)
- [ ] Add language selector in navbar (globe icon → dropdown)
- [ ] Store selected language in `localStorage` and user profile

### 3.2 UI Translation

- [ ] Translate all UI strings (navigation, buttons, labels, form fields) into 10 languages
- [ ] Use `t('key')` throughout all components
- [ ] Translate static content: landing page, about page, onboarding wizard

### 3.3 Scheme Content Translation

- [ ] Scheme names and descriptions come from API in English/Hindi
- [ ] Use Google Translate API / DeepL API / LibreTranslate (free) to auto-translate scheme `name` and `description` on sync
- [ ] Store translations in SQLite: add `name_hi`, `name_ta`, etc. columns (or a separate `scheme_translations` table)
- [ ] In `/api/schemes`: accept `lang` query param and return translated content

### 3.4 Multilingual Chatbot

- [ ] Detect user message language (use `franc` npm package for language detection)
- [ ] If non-English, translate to English before processing, then translate response back
- [ ] OR: configure LLM service to respond in the detected language directly
- [ ] The ML intent classifier should eventually be trained on multilingual data

---

## Phase 4 — Frontend Redesign

### 4.1 Overall Design Improvements

**Current state:** Tailwind v4 dark/glass theme. User reported it "looks weird and not so good."

**Tasks:**
- [ ] Choose a consistent design system — options: shadcn/ui component library, or custom Tailwind design tokens
- [ ] Standardise spacing, font sizes, card styles across all pages
- [ ] Improve color palette — currently inconsistent mix of slate/blue/indigo/purple
- [ ] Add proper loading skeletons for scheme cards (not just a spinner)
- [ ] Make scheme cards more informative — show ministry badge, state tag, category chips
- [ ] Add scheme count display ("Showing 20 of 4,609 schemes")
- [ ] Add pagination or infinite scroll to Scheme Explorer
- [ ] Make the navbar sticky and highlight active page

### 4.2 Login / Auth UI

**Current state:** Login modal/page is functional but basic.

**Tasks:**
- [ ] Smooth animated transition between Login and Register tabs
- [ ] Show password strength indicator during registration
- [ ] Add "Forgot password" flow (even if just email-based reset)
- [ ] After successful login, show a brief welcome toast: "Welcome back, [Name]!"
- [ ] Social login placeholders (Google, DigiLocker) — UI only for now
- [ ] Add gender dropdown to registration form (Phase 1.4 above)

### 4.3 Dashboard / Home After Login

**Current state:** Home page is a public landing page. After login the user sees the same public page.

**Tasks:**
- [ ] Create a Dashboard view for authenticated users (separate from public landing)
- [ ] Dashboard shows: personalized recommendations, profile completeness meter, recent schemes, quick-access chatbot
- [ ] Show profile completion percentage with prompt to complete

### 4.4 Scheme Detail Page

**Current state:** No dedicated scheme detail view — clicking a scheme only shows a card.

**Tasks:**
- [ ] Create `SchemeDetail` component/view
- [ ] Show: full description, eligibility criteria, benefits, documents required, ministry, state, application URL
- [ ] Add "Save Scheme" / bookmark functionality (store in `localStorage` initially)
- [ ] Add "Share" button (copy link to clipboard)
- [ ] "Apply Now" button prominent with real URL (Phase 1.2)

---

## Phase 5 — Backend & Infrastructure

### 5.1 User Profile in Persistent Storage

**Current state:** Users are stored in an **in-memory array** (`users[]`) in `server.ts`. All users are lost on server restart.

**Tasks:**
- [ ] Add a `users` table to SQLite: `user_id`, `email`, `password_hash`, `name`, `gender`, `created_at`
- [ ] Add a `user_profiles` table: `user_id`, `age`, `state`, `employment`, `income`, `education`, `social_category`, `locality`, `poverty_line`, `interests_json`, `onboarding_complete`
- [ ] Migrate auth routes to use SQLite instead of `users[]`
- [ ] Existing JWT auth logic can remain unchanged

### 5.2 Sync API Endpoint

- [ ] Add `POST /api/admin/sync` — triggers immediate scheme re-sync from India.gov.in
- [ ] Add `GET /api/admin/sync/status` — returns `{lastSync, totalSchemes, nextSync, isSyncing}`
- [ ] Protect with admin auth header

### 5.3 Real Application URLs from India.gov.in API

- [ ] Audit India.gov.in API response shape — check which fields carry application URLs
- [ ] Common fields: `schemeShortTitle`, `schemeUrl`, `beneficiaryUrl`, `openingDate`, `closingDate`
- [ ] Map all available URL/date fields into SQLite storage

### 5.4 Redis Cache (Optional Enhancement)

**Current state:** Redis was in the original architecture but not running.

- [ ] Re-evaluate need: since SQLite is now the source of truth, Redis is only useful for session caching or API rate limiting
- [ ] If needed: add Redis for storing JWT refresh tokens and rate-limiting per user

### 5.5 Connect ML Pipeline

- [ ] Create `ml-pipeline/api.py` — FastAPI server exposing `/classify`, `/recommend`, `/eligibility`
- [ ] Add `ml-pipeline` startup to `docker-compose.yml`
- [ ] Add `ML_SERVICE_URL` env var in backend `.env`
- [ ] Backend calls ML service with timeout + fallback to rule-based logic

---

## Phase 6 — Testing & Quality

### 6.1 Backend Tests

**Current state:** Jest test files exist but many are outdated (reference Neo4j, old cache service).

- [ ] Update `similarity-agent` tests to use SQLite mocks
- [ ] Update `schemes.controller` tests
- [ ] Add integration tests for the full request chain: HTTP → Controller → SimilarityAgent → SQLite
- [ ] Add test for 24h sync logic in `scheme-sync-agent`

### 6.2 Frontend Tests

- [ ] Add Vitest unit tests for `api.ts`, `AuthContext.tsx`
- [ ] Add Playwright E2E test: login → search schemes → view scheme → chat
- [ ] Test language switching once i18n is added

### 6.3 ML Pipeline Tests

**Current state:** `ml-pipeline/tests/` has tests. Status unknown.

- [ ] Run existing ML tests and fix failures
- [ ] Add test for FastAPI endpoints once created

---

## Phase 7 — Long-Term Vision

### 7.1 DigiLocker Integration
- Allow users to authenticate via DigiLocker for one-click document submission proof of eligibility

### 7.2 Push Notifications / Nudge System
- Notify users when new schemes matching their profile are added (email / PWA push)
- The `nudge_preferences` intent in the intent classifier is already planned for this

### 7.3 Application Tracking
- Let users mark schemes as "Applied", "In Progress", "Approved"
- Dashboard shows application pipeline

### 7.4 OCR Document Upload
- User uploads Aadhaar / income certificate → system extracts fields and auto-fills profile
- Reduces friction for onboarding

### 7.5 Voice Interface
- Users can speak their query in their native language
- Web Speech API for STT → translate → intent classify → respond → TTS

### 7.6 Mobile App
- React Native app using the same backend
- Offline support — cache last-loaded schemes in AsyncStorage

### 7.7 Scheme Comparison
- Side-by-side comparison of 2–3 schemes filtered from the explorer
- Comparison table: eligibility, benefits, documents, deadlines

---

## Known Bugs (To Fix)

| # | Bug | File | Status |
|---|-----|------|--------|
| 1 | Category type casing mismatch (`employment` vs `Employment`) — zero recommendations returned | `similarity-agent.ts` | ✅ Fixed |
| 2 | Chatbot `handleSchemeQuery` used 6 hardcoded sample schemes instead of SQLite | `chat.service.ts` | ✅ Fixed |
| 3 | "Apply Now" button has no href — goes nowhere | `SchemeExplorer.tsx` | ❌ Open |
| 4 | Users stored in memory — lost on restart | `server.ts` | ❌ Open |
| 5 | `schemes` page accessible without login | `App.tsx` | ❌ Open |
| 6 | No gender field in registration | `LoginPage.tsx`, `server.ts` | ❌ Open |
| 7 | ML pipeline not connected to backend | `ml-pipeline/` | ❌ Open |
| 8 | LandingPage stat numbers are hardcoded ("22+ languages") | `LandingPage.tsx` | ❌ Open |
| 9 | Profile data lost on server restart (in-memory users array) | `server.ts` | ❌ Open |
| 10 | `scheme_url` not fetched from API or stored in DB | `india-gov.service.ts`, `sqlite.service.ts` | ❌ Open |

---

## Suggested Improvements from Architecture Docs

From `docs/ARCHITECTURE.md` and existing README files:

- **Neo4j replacement**: Now using SQLite — graph relationships replaced with `scheme_categories` join table. If scale requires it, migrate to PostgreSQL with proper indexes.
- **Redis re-evaluation**: With SQLite, Redis is only needed for session management and rate limiting — not for scheme data.
- **TLS config**: `tls.config.ts` has a TypeScript error with `maxVersion` — needs fixing before production deployment.
- **Profile reclassification**: `profile.controller.ts` has a `TODO` at line 92: "Trigger user reclassification" — this should call the ML pipeline once it is connected.
- **Encryption**: `backend/src/encryption/` exists — ensure user PII (name, email) is encrypted at rest in SQLite.
- **JWT with RS256**: Key files exist in `backend/keys/` — ensure auth uses asymmetric RS256 not HS256.
- **Audit logging**: Profile access logging is mentioned in architecture but not implemented.
- **MCP Server**: `backend/src/api/server.ts` references MCP (Model Context Protocol) WebSocket server — verify it is functional and used by frontend.
- **BERT Intent Classifier**: Exists in `ml-pipeline/src/intent_classifier.py` with full DistilBERT implementation — highest-value ML component to connect first.
- **User classifier** (`ml-pipeline/src/user_classifier.py`): K-Means clustering — use this to group users and pre-generate batch recommendations.
- **Feature extractor** (`ml-pipeline/src/feature_extractor.py`): Converts user profile to numeric vector — required input for both classifier and recommendation engine.

---

## Priority Order for Next Development Sprint

1. **Fix "Apply Now" URLs** — most visible UX gap (Phase 1.2)
2. **Auth guard on Schemes page** — security gap (Phase 1.3)
3. **Persist users in SQLite** — data loss risk (Phase 5.1)
4. **Gender + onboarding wizard** — core UX (Phase 1.4 + 1.5)
5. **Connect ML intent classifier** — biggest AI improvement (Phase 2.2)
6. **Frontend redesign** — polish (Phase 4)
7. **Hindi/multilingual support** — mission-critical for India reach (Phase 3)
