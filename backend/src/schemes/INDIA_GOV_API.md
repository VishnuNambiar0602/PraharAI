# India.gov.in Schemes API Integration

## API Overview

The India.gov.in provides a public API to fetch government schemes data. This document outlines the API structure, request/response formats, and integration strategy.

## API Endpoint

**URL:** `https://www.india.gov.in/my-government/schemes/search/dataservices/getschemes`

**Method:** `POST`

**Content-Type:** `application/json`

## Request Schema

```typescript
interface SchemesRequest {
  categories: string[];      // Array of scheme categories to filter by
  mustFilter: string[];      // Additional filters (purpose unclear from testing)
  pageNumber: number;        // Page number for pagination (starts at 1)
  pageSize: number;          // Number of results per page (tested: 10-20)
}
```

### Example Request Body

```json
{
  "categories": [],
  "mustFilter": [],
  "pageNumber": 1,
  "pageSize": 20
}
```

## Response Schema

```typescript
interface SchemesResponse {
  schemesResponse: {
    total: number;           // Total number of schemes available
    results: Scheme[];       // Array of scheme objects
    __typename: string;      // GraphQL type name
  };
}

interface Scheme {
  title: string;                    // Scheme name/title
  ministry: string | null;          // Ministry name (can be null for state schemes)
  schemeCategory: string[];         // Array of categories
  description: string;              // Detailed description
  beneficiaryState: string | null;  // Target state (null for national schemes)
  npiMinistry: string | null;       // NPI Ministry (purpose unclear)
  slug: string;                     // URL-friendly identifier
  tags: string[];                   // Array of tags for categorization
  __typename: string;               // GraphQL type name
}
```

## Available Categories

Based on API responses, the following categories are available:

1. **Agriculture,Rural & Environment**
2. **Education & Learning**
3. **Skills & Employment**
4. **Social welfare & Empowerment**
5. **Health & Wellness**
6. **Business & Entrepreneurship**
7. **Travel & Tourism**

## Sample Response

```json
{
  "schemesResponse": {
    "total": 4664,
    "results": [
      {
        "title": "PM-KISAN",
        "ministry": "Ministry Of Agriculture and Farmers Welfare",
        "schemeCategory": ["Agriculture,Rural & Environment"],
        "description": "Direct income support to farmers...",
        "beneficiaryState": null,
        "npiMinistry": null,
        "slug": "pm-kisan",
        "tags": ["Agriculture", "Farmer", "Income Support"],
        "__typename": "Search"
      }
    ],
    "__typename": "GraphQlSearchResponse_Search"
  }
}
```

## Key Observations

1. **Total Schemes:** As of testing, there are 4,664 schemes in the database
2. **Pagination:** The API supports pagination with `pageNumber` and `pageSize`
3. **Categories:** Can be empty array to fetch all schemes, or specific categories
4. **State-Level Schemes:** Many schemes are state-specific (indicated by tags and descriptions)
5. **Ministry Field:** Can be null for state government schemes
6. **Tags:** Provide additional categorization beyond schemeCategory

## Integration Strategy

### 1. Scheme Fetching Service

Create a service to fetch schemes from the API:

```typescript
// backend/src/schemes/india-gov.service.ts

interface FetchSchemesOptions {
  categories?: string[];
  pageNumber?: number;
  pageSize?: number;
}

async function fetchSchemes(options: FetchSchemesOptions) {
  const response = await fetch(
    'https://www.india.gov.in/my-government/schemes/search/dataservices/getschemes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: options.categories || [],
        mustFilter: [],
        pageNumber: options.pageNumber || 1,
        pageSize: options.pageSize || 20,
      }),
    }
  );
  
  return await response.json();
}
```

### 2. Data Transformation

Transform the API response to match our internal schema:

```typescript
interface InternalScheme {
  schemeId: string;           // Use slug as ID
  name: string;               // title
  description: string;        // description
  category: string[];         // schemeCategory
  ministry: string | null;    // ministry
  tags: string[];             // tags
  state: string | null;       // Extract from tags or beneficiaryState
  eligibilityCriteria: any;   // To be populated from detailed scheme page
}

function transformScheme(apiScheme: Scheme): InternalScheme {
  return {
    schemeId: apiScheme.slug,
    name: apiScheme.title,
    description: apiScheme.description,
    category: apiScheme.schemeCategory,
    ministry: apiScheme.ministry,
    tags: apiScheme.tags,
    state: apiScheme.beneficiaryState,
    eligibilityCriteria: {}, // Placeholder
  };
}
```

### 3. Caching Strategy

Given the large number of schemes (4,664), implement caching:

1. **Full Sync:** Periodically fetch all schemes and store in database
2. **Cache Duration:** Update cache every 24 hours
3. **Pagination:** Fetch in batches of 100 schemes per request
4. **Storage:** Store in Neo4j with relationships to categories and tags

### 4. Search and Filter

Implement search functionality:

```typescript
// Search by category
GET /api/schemes?category=Agriculture,Rural & Environment

// Search by tags
GET /api/schemes?tags=Farmer,Agriculture

// Search by text
GET /api/schemes?q=farmer

// Pagination
GET /api/schemes?page=1&limit=20
```

### 5. Eligibility Matching

For personalized recommendations:

1. **User Profile Matching:** Match user attributes (age, income, state) with scheme tags
2. **Category Matching:** Match user interests with scheme categories
3. **State Filtering:** Filter schemes by user's state
4. **Scoring:** Calculate eligibility score based on tag matches

## Implementation Tasks

1. Create `schemes.service.ts` with API integration
2. Create `schemes.controller.ts` with REST endpoints
3. Implement caching layer using Redis
4. Create database schema for schemes in Neo4j
5. Implement sync job to fetch all schemes periodically
6. Add search and filter functionality
7. Integrate with recommendation engine

## Error Handling

1. **API Unavailable:** Fallback to cached data
2. **Rate Limiting:** Implement exponential backoff
3. **Invalid Response:** Log error and return cached data
4. **Network Timeout:** Set timeout to 10 seconds

## Testing

1. **Unit Tests:** Test data transformation functions
2. **Integration Tests:** Test API calls with mock responses
3. **Property Tests:** Verify pagination logic
4. **Load Tests:** Test with large datasets (4,664 schemes)

## Notes

- The API appears to be a GraphQL endpoint wrapped in REST
- No authentication required (public API)
- Response times are reasonable (~1-2 seconds)
- Some schemes have null ministry (state-level schemes)
- Tags provide rich metadata for matching
