# Final Integration Plan

## Enhanced User Profile Fields

### Required User Information
1. **Gender** - Male/Female/Other
2. **Age** - Number
3. **State** - Indian state
4. **Social Category** - General/OBC/SC/ST/Minority
5. **Locality** - Rural/Urban/Semi-Urban
6. **Disability Status** - Yes/No
7. **Minority Community** - Yes/No
8. **Income** - Annual income
9. **Employment Status** - Employed/Unemployed/Student/Self-Employed/Retired
10. **Education Level** - Primary/Secondary/Graduate/Post-Graduate/Professional

These fields will be:
- Asked during registration
- Used for scheme matching
- Stored in Neo4j database
- Used by similarity agent for recommendations

## Integration Steps

### Step 1: Update Backend User Model ✅
Already exists in backend/src/auth/types.ts and backend/src/profile/types.ts

### Step 2: Update Registration to Collect All Fields
- Add all fields to registration form
- Make them required
- Validate on backend

### Step 3: Copy Frontend_new and Integrate
- Use beautiful UI from frontend_new
- Add authentication pages
- Connect to backend APIs
- Add profile completion flow

### Step 4: Test Complete Flow
- Register with all fields
- Login
- See personalized schemes
- Chat with AI
- Update profile

Let's begin!
