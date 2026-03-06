# Prahar AI — Implementation TODO

> Derived from ROADMAP.md. Items are ordered by priority. Check off as completed.
> Format: `[x]` = done, `[-]` = in progress, `[ ]` = not started

---

## 🔴 Sprint 1 — Critical (Do First)

### T-01 · Apply Now — Real URLs

- [x] Audit India.gov.in API raw response to find URL fields
- [x] `india-gov.service.ts` — extract `schemeUrl`/`beneficiaryUrl` from API response
- [x] `sqlite.service.ts` — add `scheme_url TEXT` column + migration
- [x] `sqlite.service.ts` `storeSchemes()` — persist scheme_url
- [x] `sqlite.service.ts` `toScheme()` — include scheme_url in output
- [x] `schemes.controller.ts` — include `applicationUrl` in all response shapes
- [x] `frontend_new/src/types.ts` — add `applicationUrl?: string` to Scheme
- [x] `SchemeExplorer.tsx` — Apply Now opens real URL in new tab; fallback to myscheme.gov.in
- [x] Backfill scheme_url for 4,609 existing rows via migration

### T-02 · Auth Guard — All Protected Pages

- [x] `App.tsx` — gate `assistant` and `profile` ✅ already done
- [x] `App.tsx` — add `schemes` and `partner` to protected views list
- [x] `App.tsx` — store `intendedView` so after login user is redirected back
- [x] `LoginPage.tsx` — after successful login call `onNavigate(intendedView)`

### T-03 · Persist Users in SQLite (critical — data lost on restart)

- [x] `sqlite.service.ts` — add `users` table (user_id, email, password_hash, name, gender, created_at)
- [x] `sqlite.service.ts` — add `user_profiles` table (user_id, age, state, employment, income, education, social_category, locality, poverty_line, interests_json, onboarding_complete)
- [x] `server.ts` — replace in-memory `users[]` array with SQLite reads/writes
- [x] `server.ts` — register route: INSERT INTO users
- [x] `server.ts` — login route: SELECT from users, compare bcrypt hash
- [x] `server.ts` — profile GET/PATCH routes: read/write user_profiles table
- [x] Keep JWT logic unchanged

### T-04 · Gender Field in Registration

- [x] `LoginPage.tsx` — add Gender select in register form (Male/Female/Other/Prefer not to say)
- [x] `server.ts` / SQLite users table — store gender field
- [x] `UserProfile.tsx` — display and edit gender
- [x] `similarity-agent.ts` `UserProfile` interface — add `gender?: string`
- [x] `similarity-agent.ts` `buildCategoryFilters()` — if gender=Female add `SocialCategory: Women` filter boost

### T-05 · Onboarding Wizard (post-signup)

- [x] Create `frontend_new/src/components/OnboardingWizard.tsx` — 4-step wizard
  - Step 1: Name, Age, State, Gender
  - Step 2: Employment status, Annual income
  - Step 3: Education level, Social category
  - Step 4: Interests (checkboxes for Agriculture, Health, Education, etc.)
- [x] Each step calls `PATCH /api/users/:id/profile`
- [x] `App.tsx` — after login/signup if `!onboardingComplete` show wizard first
- [x] Add Skip button

### T-06 · Real Scheme Stats on Landing Page

- [x] `schemes.controller.ts` — add `GET /api/schemes/stats` → `{total, lastSync, categories}`
- [x] `frontend_new/src/api.ts` — add `fetchSchemeStats()` function
- [x] `LandingPage.tsx` — fetch and display real scheme count + last sync time

---

## 🟠 Sprint 2 — AI & Chatbot

### T-07 · Fix Chatbot ReAct Agent Flow

- [x] `chat.service.ts` — narrow `handleQuickResponses()` intercepts (only handle greetings, profile view)
- [x] `chat.service.ts` — route all scheme queries directly to ReAct agent
- [x] `chat.service.ts` — add `get_scheme_details` tool to ReAct agent (lookup by name/id from SQLite)
- [x] Improve ReAct agent response formatting for scheme lists

### T-08 · ML Pipeline FastAPI Microservice

- [x] Create `ml-pipeline/api.py` — FastAPI app with all 4 endpoints
- [x] `ml-pipeline/requirements.txt` — fastapi + uvicorn already present
- [x] Test each endpoint locally
- [x] Update `src/main.py` to properly start the FastAPI service

### T-09 · Connect Intent Classifier to Backend

- [x] `backend/src/services/ml.service.ts` — HTTP client with timeout + fallback
- [x] `react-agent.ts` — call `mlService.classify(message)` in `generateThought()`
- [x] Map intent → correct ReAct tool in `selectAction()`
- [x] Pass extracted entities via entity extraction in `chat.service.ts`

### T-10 · Connect Recommendation Engine

- [x] `similarity-agent.ts` — after SQLite category match, call `mlService.recommend()` for re-ranking
- [x] Merge and re-rank results (60% original + 40% ML weight)

### T-11 · Connect Eligibility Engine

- [x] `check_eligibility` tool — call `mlService.eligibility()` per candidate scheme
- [x] Display ML-enhanced eligibility scores in chat response

### T-12 · LLM Generative Response Layer

- [x] `backend/src/services/llm.service.ts` — abstract LLM interface
- [x] Support providers: `ollama` (local, free), `openai`, `gemini`, `none`
- [x] `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` env vars documented
- [x] ReAct agent `generateResponse()` calls LLM when configured
- [x] Fallback to rich template responses if no LLM configured

### T-13 · NLP Entity Extraction in Chat

- [x] `chat.service.ts` `extractEntities()` — parse age, income, state, employment from messages
- [x] Auto-update profile context when entities detected
- [x] Entity updates persisted to SQLite via existing ProfileExtractor in server.ts

---

## 🟡 Sprint 3 — Frontend Redesign

### T-14 · Design System

- [ ] Install shadcn/ui or define Tailwind design tokens
- [ ] Consistent color palette: primary (saffron/orange), secondary (deep blue), neutral (slate)
- [ ] Consistent card, button, input, badge component styles
- [ ] Fix navbar: make sticky, highlight active page

### T-15 · Scheme Explorer Improvements

- [ ] Loading skeleton cards instead of spinner
- [ ] Show scheme count ("Showing 20 of 4,609 schemes")
- [ ] Pagination (or infinite scroll)
- [ ] Scheme cards: show ministry badge, state chip, category tags
- [ ] Scheme detail view/modal: full description, docs needed, apply button prominent

### T-16 · Login/Auth UI Polish

- [ ] Smooth animated tab switch between Login ↔ Register
- [ ] Password strength indicator
- [ ] Welcome toast after login ("Welcome back, Arjun!")
- [ ] "Forgot password" UI placeholder
- [ ] Gender dropdown added (T-04 above)

### T-17 · Authenticated Dashboard

- [ ] Create `Dashboard.tsx` — shown to logged-in users instead of public landing
- [ ] Show: personalized top 5 recommendations, profile completeness %, quick chat access
- [ ] `App.tsx` — route authenticated users to Dashboard on home view

### T-18 · Scheme Detail Page

- [ ] `SchemeDetail.tsx` component — full scheme info view
- [ ] Fields: title, description, ministry, state, eligibility, benefits, documents required, applicationUrl
- [ ] Bookmark / save functionality (localStorage)
- [ ] Share button (copy link)
- [ ] Apply Now button with real URL (T-01)

---

## 🟢 Sprint 4 — Multilingual Support

### T-19 · i18n Framework Setup

- [ ] `npm install i18next react-i18next` in `frontend_new`
- [ ] Create `frontend_new/src/locales/en.json` with all UI string keys
- [ ] Create stubs for: `hi.json`, `ta.json`, `te.json`, `bn.json`, `mr.json`, `gu.json`, `kn.json`, `ml.json`, `pa.json`
- [ ] Configure `i18next` in `frontend_new/src/main.tsx`

### T-20 · Translate UI Components

- [ ] Replace all hardcoded strings in components with `t('key')`
  - Navbar, LandingPage, SchemeExplorer, ChatAssistant, LoginPage, UserProfile, OnboardingWizard
- [ ] Language selector component (globe icon + dropdown in navbar)
- [ ] Persist choice in `localStorage`

### T-21 · Translate Scheme Content

- [ ] `sqlite.service.ts` — add `name_hi TEXT`, `description_hi TEXT` columns
- [ ] `scheme-sync-agent.ts` — after sync, call translation API for Hindi translations
- [ ] `schemes.controller.ts` — accept `lang` query param, return translated fields
- [ ] `frontend_new/src/api.ts` — pass `lang` param based on selected language

### T-22 · Multilingual Chatbot

- [ ] Add `franc` package to backend for language detection
- [ ] `chat.service.ts` — detect input language, translate to English, process, translate response back
- [ ] OR use LLM prompt to respond in detected language (if T-12 is done)

---

## ⚪ Sprint 5 — Infrastructure & Quality

### T-23 · Sync Admin Endpoints

- [ ] `GET /api/admin/sync/status` — returns lastSync, totalSchemes, nextSync, isSyncing
- [ ] `POST /api/admin/sync` — force immediate re-sync
- [ ] Protect with `X-Admin-Key` header check

### T-24 · Fix Existing TypeScript Errors

- [x] `server.ts` TS7030 errors (not all code paths return value)
- [x] `tls.config.ts` TS2345 error (maxVersion type mismatch)
- [x] `auth.routes.ts` TS2554 errors (wrong number of arguments)

### T-25 · Update Backend Tests

- [ ] Update similarity-agent tests to mock SQLite instead of Neo4j
- [ ] Update schemes.controller tests
- [ ] Add integration test: HTTP → Controller → SimilarityAgent → SQLite
- [ ] Add test for 24h sync freshness check

### T-26 · Encryption for User PII

- [ ] `sqlite.service.ts` — encrypt name + email at rest using `backend/src/encryption/` module
- [ ] Decrypt on read in auth routes

### T-27 · Docker Compose Update

- [ ] `docker-compose.yml` — add ML microservice container (Python + FastAPI)
- [ ] Add SQLite volume mount so DB persists across container restarts
- [ ] Remove Neo4j service (no longer needed)
- [ ] Update README startup instructions

---

## 📊 Progress Tracker

| Sprint                    | Total Tasks | Done   | In Progress | Remaining |
| ------------------------- | ----------- | ------ | ----------- | --------- |
| Sprint 1 — Critical       | 23          | 23     | 0           | 0         |
| Sprint 2 — AI/Chatbot     | 21          | 20     | 0           | 1         |
| Sprint 3 — Frontend       | 20          | 0      | 0           | 20        |
| Sprint 4 — Multilingual   | 16          | 0      | 0           | 16        |
| Sprint 5 — Infrastructure | 15          | 3      | 0           | 12        |
| **Total**                 | **95**      | **46** | **0**       | **49**    |
