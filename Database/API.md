# API Documentation

## Base URL

```
http://localhost:3000/api/v1
```

## Status Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## Citizens API

### Create Citizen

Create a new citizen record.

**Request:**
```
POST /citizens
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "phone": "9876543210",
  "aadhar": "123456789012",
  "locationId": "uuid-here",
  "userGroupIds": ["farmer-group-uuid", "rural-household-uuid"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Citizen created successfully",
  "data": {
    "citizen_id": "uuid",
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "phone": "9876543210",
    "aadhar": "123456789012",
    "created_at": 1645000000000,
    "updated_at": 1645000000000
  }
}
```

### Get Citizen by ID

Retrieve full citizen profile with all relationships.

**Request:**
```
GET /citizens/{citizenId}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "citizen_id": "uuid",
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "phone": "9876543210",
    "aadhar": "123456789012",
    "created_at": 1645000000000,
    "userGroups": [
      {
        "group_id": "uuid",
        "name": "Farmer",
        "occupation_type": "Agriculture"
      }
    ],
    "location": {
      "location_id": "uuid",
      "name": "Maharashtra",
      "type": "STATE"
    },
    "schemes": [
      {
        "scheme_id": "uuid",
        "name": "PM-KISAN"
      }
    ]
  }
}
```

### Get All Citizens

Retrieve paginated list of citizens with optional filters.

**Request:**
```
GET /citizens?skip=0&limit=50&locationId=uuid&userGroupId=uuid
```

**Query Parameters:**
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Number of records to return (default: 50)
- `locationId` (optional): Filter by location
- `userGroupId` (optional): Filter by user group

**Response (200):**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "citizen_id": "uuid",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "phone": "9876543210",
      "created_at": 1645000000000
    }
    // ... more citizens
  ]
}
```

### Apply for Scheme

Submit scheme application for a citizen.

**Request:**
```
POST /citizens/{citizenId}/apply/{schemeId}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "application_id": "uuid",
    "status": "PENDING",
    "applied_at": 1645000000000,
    "updated_at": 1645000000000
  }
}
```

### Send Nudge

Send a nudge/notification to a citizen.

**Request:**
```
POST /citizens/{citizenId}/nudge
Content-Type: application/json

{
  "title": "New Eligibility Alert",
  "message": "You are now eligible for PM-KISAN scheme!",
  "schemeId": "scheme-uuid" // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Nudge sent successfully",
  "data": {
    "nudge_id": "uuid",
    "title": "New Eligibility Alert",
    "message": "You are now eligible for PM-KISAN scheme!",
    "sent_at": 1645000000000,
    "read": false
  }
}
```

### Add Citizen to User Groups

Add a citizen to multiple demographic groups.

**Request:**
```
POST /citizens/{citizenId}/groups
Content-Type: application/json

{
  "userGroupIds": [
    "farmer-group-uuid",
    "rural-household-uuid",
    "low-income-uuid"
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Citizen added to 3 user groups"
}
```

---

## User Groups API

### Create User Group

Create a new demographic group/bucket.

**Request:**
```
POST /user-groups
Content-Type: application/json

{
  "name": "Farmer",
  "occupation_type": "Agriculture",
  "age_range": "18-70",
  "income_range": "0-500000",
  "rural_urban": "Rural",
  "gender_priority": null,
  "description": "Agricultural farmers and laborers"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User group created successfully",
  "data": {
    "group_id": "uuid",
    "name": "Farmer",
    "occupation_type": "Agriculture",
    "age_range": "18-70",
    "income_range": "0-500000",
    "rural_urban": "Rural",
    "member_count": 0,
    "created_at": 1645000000000
  }
}
```

### Get All User Groups

Retrieve all demographic groups with member counts.

**Request:**
```
GET /user-groups?skip=0&limit=50&nameContains=farmer
```

**Response (200):**
```json
{
  "success": true,
  "count": 9,
  "data": [
    {
      "group_id": "uuid",
      "name": "Farmer",
      "occupation_type": "Agriculture",
      "member_count": 1250,
      "created_at": 1645000000000
    }
    // ... more groups
  ]
}
```

### Get User Group by ID

**Request:**
```
GET /user-groups/{groupId}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "group_id": "uuid",
    "name": "Farmer",
    "occupation_type": "Agriculture",
    "age_range": "18-70",
    "income_range": "0-500000",
    "rural_urban": "Rural",
    "member_count": 1250,
    "description": "Agricultural farmers and laborers",
    "created_at": 1645000000000,
    "updated_at": 1645000000000
  }
}
```

### Initialize Default User Groups

Create all 9 predefined demographic groups.

**Request:**
```
POST /user-groups/init/defaults
```

**Predefined Groups:**
1. Farmer
2. Student
3. Senior Citizen
4. Low Income Worker
5. Women
6. MSME / Self-employed
7. Disabled
8. Rural Household
9. Urban BPL

**Response (200):**
```json
{
  "success": true,
  "message": "Default user groups initialization complete",
  "data": [
    {
      "status": "created",
      "name": "Farmer",
      "group_id": "uuid"
    },
    {
      "status": "exists",
      "name": "Student"
    }
    // ... remaining groups
  ]
}
```

### Get Citizens in User Group

Get paginated list of citizens in a group.

**Request:**
```
GET /user-groups/{groupId}/citizens?skip=0&limit=50
```

**Response (200):**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "citizen_id": "uuid",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "phone": "9876543210",
      "created_at": 1645000000000
    }
    // ... more citizens
  ]
}
```

### Get Schemes for User Group

Get schemes targeted at a specific user group.

**Request:**
```
GET /user-groups/{groupId}/schemes
```

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "scheme_id": "uuid",
      "name": "PM-KISAN",
      "description": "Direct income support to farmers",
      "category": "Agricultural Support",
      "budget": 75000000000
    }
    // ... more schemes
  ]
}
```

### Update User Group

Update user group details.

**Request:**
```
PUT /user-groups/{groupId}
Content-Type: application/json

{
  "name": "Farmer (Updated)",
  "description": "Updated description",
  "income_range": "0-600000"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User group updated successfully",
  "data": {
    "group_id": "uuid",
    "name": "Farmer (Updated)",
    "description": "Updated description",
    "income_range": "0-600000",
    "updated_at": 1645000000000
  }
}
```

---

## Schemes API

### Create Scheme

Create a new government scheme.

**Request:**
```
POST /schemes
Content-Type: application/json

{
  "name": "PM-KISAN Samman Nidhi",
  "description": "Direct income support of ₹6000 per year to farmer families",
  "category": "Agricultural Support",
  "launch_date": "2019-02-24",
  "budget": 75000000000,
  "target_audience": "Farmer families",
  "api_endpoint": "https://pmkisan.gov.in/api/v1"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Scheme created successfully",
  "data": {
    "scheme_id": "uuid",
    "name": "PM-KISAN Samman Nidhi",
    "description": "Direct income support of ₹6000 per year",
    "category": "Agricultural Support",
    "launch_date": "2019-02-24",
    "budget": 75000000000,
    "is_active": true,
    "created_at": 1645000000000
  }
}
```

### Get Scheme by ID

Retrieve scheme with all relationships (target groups, locations, documents, rules, APIs).

**Request:**
```
GET /schemes/{schemeId}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "scheme_id": "uuid",
    "name": "PM-KISAN Samman Nidhi",
    "description": "Direct income support of ₹6000 per year",
    "category": "Agricultural Support",
    "budget": 75000000000,
    "is_active": true,
    "targetUserGroups": [
      {
        "group_id": "uuid",
        "name": "Farmer"
      }
    ],
    "locations": [
      {
        "location_id": "uuid",
        "name": "India",
        "type": "COUNTRY"
      }
    ],
    "requiredDocuments": [
      {
        "document_id": "uuid",
        "name": "Aadhar",
        "code": "AADHAR"
      }
    ],
    "eligibilityRules": [
      {
        "rule_id": "uuid",
        "rule_name": "Farmer Occupation",
        "field_name": "occupation_type",
        "rule_condition": "equals",
        "rule_value": "Agriculture"
      }
    ],
    "govAPIs": []
  }
}
```

### Get All Schemes

Retrieve paginated list of schemes.

**Request:**
```
GET /schemes?skip=0&limit=50&category=Agricultural Support&isActive=true
```

**Response (200):**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "scheme_id": "uuid",
      "name": "PM-KISAN Samman Nidhi",
      "category": "Agricultural Support",
      "budget": 75000000000,
      "is_active": true,
      "created_at": 1645000000000
    }
    // ... more schemes
  ]
}
```

### Link Scheme to User Group

Add a user group as target audience for a scheme.

**Request:**
```
POST /schemes/{schemeId}/link-user-group/{userGroupId}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Scheme linked to user group successfully"
}
```

### Link Scheme to Location

Define regions where scheme is valid.

**Request:**
```
POST /schemes/{schemeId}/link-location/{locationId}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Scheme linked to location successfully"
}
```

### Add Eligibility Rule to Scheme

Add a rule that defines eligibility criteria.

**Request:**
```
POST /schemes/{schemeId}/rules
Content-Type: application/json

{
  "rule_name": "Farmer Occupation Check",
  "rule_condition": "equals",
  "rule_value": "Agriculture",
  "field_name": "occupation_type"
}
```

**Conditions:**
- `equals` - Exact match
- `greater_than` - Numeric comparison >
- `less_than` - Numeric comparison <
- `in_range` - Value within range
- `contains` - String contains

**Response (201):**
```json
{
  "success": true,
  "message": "Eligibility rule added successfully",
  "data": {
    "rule_id": "uuid",
    "rule_name": "Farmer Occupation Check",
    "rule_condition": "equals",
    "rule_value": "Agriculture",
    "field_name": "occupation_type",
    "created_at": 1645000000000
  }
}
```

### Check Citizen Eligibility

Determine if a citizen is eligible for a scheme.

**Request:**
```
GET /schemes/{schemeId}/check-eligibility/{citizenId}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "groupMatch": true,
    "locationMatch": true,
    "citizenId": "uuid",
    "schemeId": "uuid",
    "matchedRules": [
      "Farmer Occupation Check",
      "Location Validation"
    ]
  }
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "\"name\" is required",
    "\"email\" must be a valid email"
  ]
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Citizen not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Unable to connect to database"
}
```

---

## Common Parameters

### Pagination
- `skip` (optional, default: 0) - Records to skip
- `limit` (optional, default: 50, max: 1000) - Records to return

### Timestamps
- All timestamps are returned in milliseconds since epoch
- Server uses UTC timezone

---

## Rate Limiting

- API: 1000 requests per minute per IP
- Database: 50 concurrent connections

---

## Authentication

Currently no authentication required (development mode). 
For production, add JWT/OAuth headers:

```
Authorization: Bearer <token>
```

---

## Webhook Support

Schemes can fetch data from external Government APIs:

```
POST /schemes
{
  "api_endpoint": "https://api.gov.in/scheme/check"
}
```

The system caches API responses for 24 hours.

---

## Batch Operations

Create multiple citizens in one request:

```
POST /citizens/batch
```

Not yet implemented - coming in v1.1

---

For more details, see [README.md](./README.md)
