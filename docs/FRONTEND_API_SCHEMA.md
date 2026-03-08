# Frontend API Schema - Scheme Enrichment Updates

## Changes Overview

The backend has been updated to provide richer scheme data from MyScheme.gov.in's structured API. **9 new fields** have been added to the `pageDetails` object that is returned in scheme responses.

### New Fields Added to `pageDetails`

| Field                 | Type                                                       | Description                                                            |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `references`          | `Array<{title: string, url: string}>`                      | Official reference links (guidelines, forms, contact pages)            |
| `applicationProcess`  | `Array<{mode: string, steps: string[], markdown: string}>` | Structured application steps (Offline/Online mode with detailed steps) |
| `eligibilityMarkdown` | `string \| null`                                           | Eligibility criteria in markdown format for rich rendering             |
| `benefitsMarkdown`    | `string \| null`                                           | Benefits in markdown format for rich rendering                         |
| `descriptionMarkdown` | `string \| null`                                           | Full description in markdown format                                    |
| `exclusionsMarkdown`  | `string \| null`                                           | Scheme exclusions in markdown format                                   |
| `raw`                 | `Record<string, any>`                                      | Complete raw API response for future extensibility                     |
| `eligibility`         | `string[]`                                                 | _(existing)_ Plain text eligibility criteria (list items)              |
| `benefits`            | `string[]`                                                 | _(existing)_ Plain text benefits (list items)                          |

### Migration Notes

- **Backward Compatible**: All new fields are optional. Existing code that only uses `eligibility` and `benefits` arrays will continue to work.
- **Rendering Strategy**:
  - Use `eligibilityMarkdown` / `benefitsMarkdown` for rich display when available
  - Fall back to `eligibility[]` / `benefits[]` arrays for simple list rendering
  - Use `raw` object for advanced features or debugging
- **Application Process**: Now structured with mode (Offline/Online), individual steps, and markdown formatting
- **References**: Official links are now extracted and validated (URL validation, deduplication, max 25 items)

---

## Sample JSON - Scheme List Response

**Endpoint**: `GET /api/schemes?q=fishermen&limit=20&page=1`

```json
{
  "items": [
    {
      "id": "ira-wrflsncs",
      "title": "\"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\"",
      "description": "The scheme \"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\" is introduced to extend financial assistance to the fishermen's families to compensate for the loss due to the missing breadwinner and to support them financially.",
      "category": "Agriculture,Rural & Environment:Agriculture",
      "benefits": "₹ 1,00,000, in two installments of ₹ 50,000 each",
      "eligibility": "The applicant should be the family (legal heir) of the missing fisherman, The missing fisherman should have been a resident of the Union territory of Puducherry, The missing fisherman must have lost his/her life while fishing",
      "ministry": "Fisheries and Fishermen Welfare Department",
      "state": "Puducherry",
      "tags": ["Missing", "Fisherman", "Relief", "Financial Assistance", "Family"],
      "rawCategories": ["Agriculture,Rural & Environment", "Social welfare & Empowerment"],
      "matchedCategories": [
        {
          "type": "Employment",
          "value": "Self-Employed"
        },
        {
          "type": "Locality",
          "value": "Rural"
        }
      ],
      "applicationUrl": "https://www.myscheme.gov.in/schemes/ira-wrflsncs",
      "enrichment": {
        "hasPageDetails": true,
        "enrichedAt": "2026-03-08T10:30:00.000Z"
      },
      "pageDetails": {
        "schemeId": "659cd9f56093f0fa3319a3a1",
        "title": "\"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\"",
        "ministry": "Fisheries and Fishermen Welfare Department, Puducherry",
        "description": "The scheme \"Immediate Relief Assistance\" is a Sub-Component under the scheme \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\". The scheme is extended to all the regions of the Union territory of Puducherry.",
        "eligibility": [
          "The applicant should be the family (legal heir) of the missing fisherman.",
          "The missing fisherman should have been a resident of the Union territory of Puducherry.",
          "The missing fisherman must have lost his/her life while fishing.",
          "The missing fisherman must have been in the age group of 18-60 years.",
          "The missing fisherman must not have been a beneficiary of the old age pension scheme.",
          "The missing fisherman should have enrolled as a member of the Fishermen/Fisherwomen Co-operative Society."
        ],
        "benefits": [
          "₹ 1,00,000, in two installments of ₹ 50,000 each, as immediate relief assistance for the family (legal heir) of the missing fisherman.",
          "Initially, 50% will be extended within 3 months from the date of receipt of the application from the family (legal heir).",
          "The family (legal heir) should approach this department for the release of the balance 50% of the relief which will be deposited in the bank in a joint account in the name of kin (legal heir) and the competent authority concerned.",
          "If no further information is received about the missing person, the balance amount will be released in favour of the next of kin (legal heir), after the prescribed period of 9 months from the date of release of 1st part of lump sum."
        ],
        "enrichedAt": "2026-03-08T10:30:00.000Z"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

---

## Sample JSON - Scheme Detail Response

**Endpoint**: `GET /api/schemes/ira-wrflsncs`

```json
{
  "id": "ira-wrflsncs",
  "title": "\"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\"",
  "description": "The scheme \"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\" is introduced to extend financial assistance to the fishermen's families to compensate for the loss due to the missing breadwinner and to support them financially.",
  "category": "Agriculture,Rural & Environment:Agriculture",
  "benefits": "₹ 1,00,000, in two installments of ₹ 50,000 each",
  "eligibility": "The applicant should be the family (legal heir) of the missing fisherman, The missing fisherman should have been a resident of the Union territory of Puducherry, The missing fisherman must have lost his/her life while fishing",
  "ministry": "Fisheries and Fishermen Welfare Department",
  "state": "Puducherry",
  "tags": ["Missing", "Fisherman", "Relief", "Financial Assistance", "Family"],
  "rawCategories": ["Agriculture,Rural & Environment", "Social welfare & Empowerment"],
  "matchedCategories": [
    {
      "type": "Employment",
      "value": "Self-Employed"
    },
    {
      "type": "Locality",
      "value": "Rural"
    }
  ],
  "applicationUrl": "https://www.myscheme.gov.in/schemes/ira-wrflsncs",
  "enrichment": {
    "hasPageDetails": true,
    "enrichedAt": "2026-03-08T10:30:00.000Z"
  },
  "pageDetails": {
    "schemeId": "659cd9f56093f0fa3319a3a1",
    "title": "\"Immediate Relief Assistance\" under \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\"",
    "ministry": "Fisheries and Fishermen Welfare Department, Puducherry",
    "description": "The scheme \"Immediate Relief Assistance\" is a Sub-Component under the scheme \"Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme\". The scheme is extended to all the regions of the Union territory of Puducherry. The scheme is introduced with the objective of extending financial assistance to the fishermen's families to compensate for the loss due to the missing breadwinner and to support them financially to run their family.",
    "eligibility": [
      "The applicant should be the family (legal heir) of the missing fisherman.",
      "The missing fisherman should have been a resident of the Union territory of Puducherry.",
      "The missing fisherman must have lost his/her life while fishing.",
      "The missing fisherman must have been in the age group of 18-60 years.",
      "The missing fisherman must not have been a beneficiary of the old age pension scheme.",
      "The missing fisherman should have enrolled as a member of the Fishermen/Fisherwomen Co-operative Society."
    ],
    "benefits": [
      "₹ 1,00,000, in two installments of ₹ 50,000 each, as immediate relief assistance for the family (legal heir) of the missing fisherman.",
      "Initially, 50% will be extended within 3 months from the date of receipt of the application from the family (legal heir).",
      "The family (legal heir) should approach this department for the release of the balance 50% of the relief which will be deposited in the bank in a joint account in the name of kin (legal heir) and the competent authority concerned.",
      "If no further information is received about the missing person, the balance amount will be released in favour of the next of kin (legal heir), after the prescribed period of 9 months from the date of release of 1st part of lump sum."
    ],
    "references": [
      {
        "title": "Guidelines & Application Form",
        "url": "https://fisheries.py.gov.in/sites/default/files/immediate20relief20notification.pdf"
      },
      {
        "title": "State Plan Schemes",
        "url": "https://fisheries.py.gov.in/sites/default/files/fisheries-state-plan-schemes.pdf"
      },
      {
        "title": "List Of Sub-Offices",
        "url": "https://fisheries.py.gov.in/sub-offices"
      },
      {
        "title": "Contact Us",
        "url": "https://fisheries.py.gov.in/contact-us"
      }
    ],
    "applicationProcess": [
      {
        "mode": "Offline",
        "steps": [
          "The interested applicant should visit the office of the concerned authority i.e. the Department of Fisheries and Fishermen Welfare/Sub-Offices of outlying regions in all four regions.",
          "The interested applicant should request the hard copy of the prescribed format of the application form from the concerned authority.",
          "In the application form, fill in all the mandatory fields, paste the passport-sized photograph (signed across, if required), and attach copies of all the mandatory documents (self-attest, if required).",
          "Submit the duly filled and signed application form along with the documents to the concerned authority.",
          "Request a receipt or acknowledgment from the concerned authority to whom the application has been submitted. Ensure that the receipt contains essential details such as the date and time of submission, and a unique identification number (if applicable)."
        ],
        "markdown": "**Step 1:** The interested applicant should visit the office of the [concerned authority](https://fisheries.py.gov.in/sub-offices) i.e. the Department of Fisheries and Fishermen Welfare/Sub-Offices of outlying regions in all four regions.\n**Step 1:** The interested applicant should request the hard copy of the [prescribed format](https://fisheries.py.gov.in/sites/default/files/aquarium20subsidy20notification.pdf) of the application form from the concerned authority.\n**Step 2:** In the application form, fill in all the mandatory fields, paste the passport-sized photograph (signed across, if required), and attach copies of all the mandatory documents (self-attest, if required).\n**Step 3:** Submit the duly filled and signed application form along with the documents to the concerned authority.\n**Step 4:** Request a receipt or acknowledgment from the concerned authority to whom the application has been submitted. Ensure that the receipt contains essential details such as the date and time of submission, and a unique identification number (if applicable).\n****The affected family (legal heir) should apply immediately within 30 days from the date of the event for consideration.***\n"
      }
    ],
    "eligibilityMarkdown": "\n- The applicant should be the family (legal heir) of the missing fisherman.\n- The missing fisherman should have been a resident of the Union territory of Puducherry.\n- The missing fisherman must have lost his/her life while fishing. \n- The missing fisherman must have been in the age group of 18-60 years.\n- The missing fisherman must not have been a beneficiary of the old age pension scheme. \n- The missing fisherman should have enrolled as a member of the Fishermen/Fisherwomen Co-operative Society.\n\n",
    "benefitsMarkdown": "₹ 1,00,000, in two installments of ₹ 50,000 each, as immediate relief assistance for the family (legal heir) of the missing fisherman.\n<br>\n\n> **Disbursal**\n\n\n- Initially, 50% will be extended within 3 months from the date of receipt of the application from the family (legal heir).\n- The family (legal heir) should approach this department for the release of the balance 50% of the relief which will be deposited in the bank in a joint account in the name of kin (legal heir) and the competent authority concerned.\n- If no further information is received about the missing person, the balance amount will be released in favour of the next of kin (legal heir), after the prescribed period of 9 months from the date of release of 1st part of lump sum.\n\n****In case of the return of the missing fishermen, the amount extended as compensation either ₹ 50,000 or ₹ 1,00,000 as the case may be, will be recovered by invoking an insurance bond.*** \n",
    "descriptionMarkdown": "The scheme &quot;Immediate Relief Assistance&quot; is a Sub-Component under the scheme &quot;Welfare and Relief for Fishermen During Lean Seasons and Natural Calamities Scheme&quot;. The scheme is extended to all the regions of the Union territory of Puducherry. The scheme is introduced with the objective of extending financial assistance to the fishermen&#39;s families to compensate for the loss due to the missing breadwinner and to support them financially to run their family. \n",
    "exclusionsMarkdown": null,
    "raw": {
      "_id": "659cd9f56093f0fa3319a3a1",
      "slug": "ira-wrflsncs",
      "status": "Success",
      "statusCode": 200
    },
    "enrichedAt": "2026-03-08T10:30:00.000Z"
  },
  "eligibilityCriteria": [
    "The applicant should be the family (legal heir) of the missing fisherman.",
    "The missing fisherman should have been a resident of the Union territory of Puducherry.",
    "The missing fisherman must have lost his/her life while fishing.",
    "The missing fisherman must have been in the age group of 18-60 years.",
    "The missing fisherman must not have been a beneficiary of the old age pension scheme.",
    "The missing fisherman should have enrolled as a member of the Fishermen/Fisherwomen Co-operative Society."
  ],
  "benefitsList": [
    "₹ 1,00,000, in two installments of ₹ 50,000 each, as immediate relief assistance for the family (legal heir) of the missing fisherman.",
    "Initially, 50% will be extended within 3 months from the date of receipt of the application from the family (legal heir).",
    "The family (legal heir) should approach this department for the release of the balance 50% of the relief which will be deposited in the bank in a joint account in the name of kin (legal heir) and the competent authority concerned.",
    "If no further information is received about the missing person, the balance amount will be released in favour of the next of kin (legal heir), after the prescribed period of 9 months from the date of release of 1st part of lump sum."
  ]
}
```

---

## TypeScript Types for Frontend

```typescript
// Scheme List Item
export interface SchemeListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  benefits: string;
  eligibility: string;
  ministry: string;
  state: string | null;
  tags: string[];
  rawCategories: string[];
  matchedCategories: Array<{
    type: string;
    value: string;
  }>;
  applicationUrl: string;
  enrichment: {
    hasPageDetails: boolean;
    enrichedAt: string | null;
  };
  pageDetails: SchemePageDetails;
}

// Scheme Detail (extends list item)
export interface SchemeDetail extends SchemeListItem {
  eligibilityCriteria: string[];
  benefitsList: string[];
}

// NEW: Enhanced Page Details Structure
export interface SchemePageDetails {
  schemeId: string | null;
  title: string | null;
  ministry: string | null;
  description: string | null;

  // Existing array fields
  eligibility: string[];
  benefits: string[];

  // NEW: Reference links
  references?: Array<{
    title: string;
    url: string;
  }>;

  // NEW: Structured application process
  applicationProcess?: Array<{
    mode: string; // "Offline" | "Online"
    steps: string[];
    markdown: string;
  }>;

  // NEW: Markdown-formatted content for rich rendering
  eligibilityMarkdown?: string | null;
  benefitsMarkdown?: string | null;
  descriptionMarkdown?: string | null;
  exclusionsMarkdown?: string | null;

  // NEW: Complete raw API response
  raw?: Record<string, any>;

  enrichedAt: string | null;
}

// Paginated Response
export interface PaginatedSchemes {
  items: SchemeListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## Implementation Guide for Frontend

### 1. **Scheme List Page**

- Display basic info from top-level fields
- Show `enrichment.hasPageDetails` badge for enhanced schemes
- Use `pageDetails.eligibility` and `pageDetails.benefits` arrays for preview

### 2. **Scheme Detail Page**

#### Basic Info Section

```tsx
<h1>{scheme.title}</h1>
<p className="ministry">{scheme.ministry}</p>
<p className="description">{scheme.description}</p>
```

#### Eligibility Section (with rich markdown)

```tsx
{
  scheme.pageDetails.eligibilityMarkdown ? (
    <Markdown>{scheme.pageDetails.eligibilityMarkdown}</Markdown>
  ) : (
    <ul>
      {scheme.pageDetails.eligibility.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
```

#### Benefits Section (with rich markdown)

```tsx
{
  scheme.pageDetails.benefitsMarkdown ? (
    <Markdown>{scheme.pageDetails.benefitsMarkdown}</Markdown>
  ) : (
    <ul>
      {scheme.pageDetails.benefits.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
```

#### Application Process Section (NEW)

```tsx
{
  scheme.pageDetails.applicationProcess?.map((process, idx) => (
    <div key={idx} className="application-process">
      <h3>{process.mode} Application</h3>
      {process.markdown ? (
        <Markdown>{process.markdown}</Markdown>
      ) : (
        <ol>
          {process.steps.map((step, stepIdx) => (
            <li key={stepIdx}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  ));
}
```

#### References Section (NEW)

```tsx
{
  scheme.pageDetails.references && scheme.pageDetails.references.length > 0 && (
    <div className="references">
      <h3>Official Resources</h3>
      <ul>
        {scheme.pageDetails.references.map((ref, idx) => (
          <li key={idx}>
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              {ref.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. **Markdown Rendering**

Install a markdown library:

```bash
npm install react-markdown
```

Use for rich content:

```tsx
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{scheme.pageDetails.descriptionMarkdown}</ReactMarkdown>;
```

### 4. **Fallback Strategy**

Always check if new fields exist before rendering:

```tsx
const hasReferences = scheme.pageDetails.references && scheme.pageDetails.references.length > 0;
const hasApplicationProcess =
  scheme.pageDetails.applicationProcess && scheme.pageDetails.applicationProcess.length > 0;
```

---

## Backend Changes Summary

### Files Modified

1. **`backend/src/schemes/myscheme-structured.service.ts`** (NEW)
   - Replaced HTML scraping with direct API consumption
   - Parses rich-text node structures from MyScheme API
   - Extracts references, application process, and markdown fields
   - Adaptive rate limiting and retry logic

2. **`backend/src/db/neo4j.service.ts`**
   - Extended `SchemeRow` interface with 9 new fields
   - Updated `storeSchemes()` to persist new fields
   - Updated `upsertSchemesBatch()` to persist new fields
   - Updated `toScheme()` to return structured objects (references, applicationProcess, markdown)

3. **`backend/src/agents/scheme-sync-agent.ts`**
   - Swapped import from `mySchemePageService` to `mySchemeStructuredService`
   - Enrichment now uses structured API data

### Database Schema Changes

**Neo4j `Scheme` Node Properties Added:**

- `page_references_json` (string): JSON array of {title, url} objects
- `page_application_process_json` (string): JSON array of {mode, steps[], markdown} objects
- `page_eligibility_md` (string): Markdown-formatted eligibility
- `page_benefits_md` (string): Markdown-formatted benefits
- `page_description_md` (string): Markdown-formatted description
- `page_exclusions_md` (string): Markdown-formatted exclusions
- `page_scheme_raw_json` (string): Complete raw API response

All fields are optional and backward-compatible.

---

## Testing Checklist

- [ ] Test scheme list with `hasPageDetails: true` schemes
- [ ] Test scheme list with `hasPageDetails: false` schemes (fallback to basic data)
- [ ] Render `eligibilityMarkdown` with markdown parser
- [ ] Render `benefitsMarkdown` with markdown parser
- [ ] Display `references` array with clickable links
- [ ] Display `applicationProcess` with mode and steps
- [ ] Handle null/undefined markdown fields gracefully
- [ ] Test pagination with `page` and `pageSize` parameters
- [ ] Verify `raw` object is present for debugging

---

## API Endpoints

- **List Schemes**: `GET /api/schemes?q=search&limit=20&page=1&paginated=true`
- **Get Scheme Detail**: `GET /api/schemes/:schemeId`
- **Get Categories**: `GET /api/schemes/categories`
- **Get Stats**: `GET /api/schemes/stats`
- **Admin Metrics**: `GET /api/admin/metrics` (requires `x-admin-key` header)

### Admin Metrics Response Shape

```json
{
  "users": {
    "total": 0,
    "onboarded": 0,
    "updatedProfiles": 0
  },
  "schemes": {
    "pulled": 0,
    "inGraph": 0,
    "enriched": 0,
    "withEligibility": 0,
    "withBenefits": 0,
    "enrichmentRate": 0
  },
  "sync": {
    "totalSchemes": 0,
    "lastSync": null,
    "nextSync": null,
    "isSyncing": false
  },
  "trends": {
    "users": [
      { "date": "2026-03-02", "count": 0 }
    ],
    "sync": [
      { "date": "2026-03-02", "synced": 0, "enriched": 0 }
    ]
  },
  "cache": {
    "hits": 0,
    "misses": 0,
    "sets": 0,
    "deletes": 0,
    "errors": 0,
    "hitRate": 0,
    "available": true,
    "uptime": 0
  },
  "mlService": {
    "baseUrl": "http://localhost:8000",
    "timeoutMs": 15000,
    "available": true,
    "lastCheckAt": null
  },
  "generatedAt": "2026-03-08T00:00:00.000Z"
}
```

All endpoints return enhanced `pageDetails` when available.
