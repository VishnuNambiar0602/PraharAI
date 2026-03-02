# Frontend Integration Plan

## Overview
Integrate the new modern UI design from `frontend_new` with the existing backend architecture and real data.

## Frontend_new Features Analysis

### ✅ Features that EXIST in Current Backend
1. **Scheme Explorer** - Backend has real scheme data from India.gov.in API
2. **Chat Assistant** - Backend has intelligent chat service with ReAct agent
3. **User Profile** - Backend has profile management with Neo4j
4. **Authentication** - Backend has JWT-based auth system
5. **Scheme Recommendations** - Backend has similarity agent for matching

### ❌ Features that DON'T EXIST in Backend (Skip These)
1. **Partner Portal** - NGO/Partner management system (not in architecture)
2. **Contact Page** - Support ticket system (not in architecture)
3. **About Page** - Static content (can keep as-is)
4. **Application Tracking** - Scheme application status tracking (not in architecture)
5. **Document Upload** - File management system (not in architecture)
6. **Bulk Onboarding** - CSV upload for partners (not in architecture)

### 🔄 Features to ADD to Frontend_new
1. **Login/Register Pages** - Backend has auth but frontend_new doesn't
2. **Dashboard** - Show personalized recommendations
3. **Profile Completeness** - Show % complete with prompts
4. **Real-time Scheme Data** - Connect to backend API
5. **Profile Updates** - Allow users to update their info
6. **Scheme Filtering** - By category, state, eligibility

## Implementation Plan

### Phase 1: Setup & Dependencies
1. Copy frontend_new to replace current frontend
2. Install additional dependencies:
   - axios for API calls
   - react-router-dom for routing (if needed)
   - Keep motion/react for animations
3. Set up environment variables for API URL

### Phase 2: Create Missing Components
1. **LoginPage.tsx** - Login form with backend integration
2. **RegisterPage.tsx** - Registration form
3. **DashboardPage.tsx** - Show personalized recommendations
4. **SchemeDetailPage.tsx** - Detailed view of a single scheme

### Phase 3: Connect to Backend APIs
1. **Auth Integration**
   - POST /api/auth/login
   - POST /api/auth/register
   - POST /api/auth/logout
   - Store JWT tokens in localStorage

2. **Scheme Integration**
   - GET /api/schemes - List all schemes
   - GET /api/schemes/:id - Get scheme details
   - GET /api/users/:userId/recommendations - Get personalized schemes
   - GET /api/schemes/categories - Get categories for filtering

3. **Profile Integration**
   - GET /api/users/:userId/profile - Get user profile
   - PUT /api/users/:userId/profile - Update profile
   - Show profile completeness percentage

4. **Chat Integration**
   - POST /api/chat - Send message to AI
   - Display real responses from backend
   - Show scheme recommendations from chat

### Phase 4: Update Existing Components

#### SchemeExplorer.tsx
- Replace MOCK_SCHEMES with real API data
- Add pagination
- Connect filters to backend
- Show real eligibility scores

#### ChatAssistant.tsx
- Connect to POST /api/chat endpoint
- Handle real-time responses
- Display scheme cards from backend
- Show profile update confirmations

#### UserProfile.tsx
- Load real user data from backend
- Show actual profile completeness
- Remove mock application tracking (not in backend)
- Remove document upload (not in backend)
- Keep profile editing functional

#### LandingPage.tsx
- Keep as-is (mostly static)
- Update CTAs to navigate to real pages
- Show real user count if available

### Phase 5: Remove Unsupported Features
1. Remove PartnerPortal component (not in backend)
2. Simplify ContactPage to just show contact info (no ticket system)
3. Remove application tracking UI from UserProfile
4. Remove document upload UI

### Phase 6: Styling & Polish
1. Ensure all components use the same color scheme
2. Add loading states
3. Add error handling
4. Add success/error toasts
5. Ensure mobile responsiveness

### Phase 7: Testing & Launch
1. Test all API integrations
2. Test authentication flow
3. Test scheme search and filtering
4. Test chat functionality
5. Test profile updates
6. Start both backend and frontend servers

## API Endpoints Summary

```typescript
// Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

// Schemes
GET /api/schemes?q=search&limit=20&page=1
GET /api/schemes/categories
GET /api/schemes/:schemeId
GET /api/users/:userId/recommendations?limit=20

// Profile
GET /api/users/:userId/profile
PUT /api/users/:userId/profile

// Chat
POST /api/chat
DELETE /api/chat/history
```

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx (NEW)
│   │   │   └── RegisterPage.tsx (NEW)
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx (NEW)
│   │   ├── schemes/
│   │   │   ├── SchemeExplorer.tsx (UPDATE)
│   │   │   └── SchemeDetailPage.tsx (NEW)
│   │   ├── chat/
│   │   │   └── ChatAssistant.tsx (UPDATE)
│   │   ├── profile/
│   │   │   └── UserProfile.tsx (UPDATE)
│   │   ├── common/
│   │   │   ├── LandingPage.tsx (KEEP)
│   │   │   ├── AboutPage.tsx (KEEP)
│   │   │   └── LoadingSpinner.tsx (NEW)
│   │   └── ProtectedRoute.tsx (NEW)
│   ├── hooks/
│   │   ├── useAuth.ts (NEW)
│   │   ├── useSchemes.ts (NEW)
│   │   ├── useProfile.ts (NEW)
│   │   └── useChat.ts (NEW)
│   ├── services/
│   │   └── api.ts (NEW)
│   ├── types.ts (UPDATE)
│   ├── App.tsx (UPDATE)
│   └── main.tsx
├── .env
└── vite.config.ts
```

## Next Steps

1. ✅ Backend is ready with Neo4j + Redis running
2. ✅ Backend has 4664 schemes cached
3. ✅ Chat service is integrated
4. 🔄 Now integrate frontend_new with backend
5. 🔄 Test end-to-end flow
6. 🔄 Deploy and launch

## Notes

- Keep the beautiful UI/UX from frontend_new
- Only connect features that exist in backend
- Remove/hide features that don't have backend support
- Focus on core user journey: Register → Profile → Discover Schemes → Chat → Apply
