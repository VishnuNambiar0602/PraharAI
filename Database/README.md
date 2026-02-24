# AI4Bharat Graph Database API

Production-ready Neo4j Graph Database with REST API for the AI4Bharat Scheme Eligibility System.

## Overview

This is a graph-based database designed to manage citizens, government schemes, user groups (demographic segments), eligibility rules, and applications. It follows a microservices approach where teams can integrate this API to track scheme eligibility and citizen engagement.

### Core Features

- **Citizen Management**: Register and manage citizens with demographic information
- **User Bucketing**: Categorize citizens into predefined demographic groups (Farmers, Students, Senior Citizens, etc.)
- **Scheme Management**: Create and manage government schemes with eligibility rules
- **Eligibility Checking**: Determine citizen eligibility for schemes in real-time
- **Application Tracking**: Track scheme applications and their status
- **Nudges & Notifications**: Send targeted nudges to citizens for eligible schemes
- **Location-based Filtering**: Support for state and district-level scheme validity

## Project Structure

```
Database/
├── src/
│   ├── config/
│   │   ├── neo4j.js          # Neo4j driver configuration
│   │   └── logger.js         # Logging utility
│   ├── services/
│   │   ├── neo4jService.js   # Base Neo4j operations
│   │   ├── citizenService.js # Citizen CRUD operations
│   │   ├── userGroupService.js # User group management
│   │   ├── schemeService.js  # Scheme management
│   │   ├── locationService.js
│   │   ├── documentService.js
│   │   └── govAPIService.js
│   ├── controllers/
│   │   ├── citizenController.js
│   │   ├── userGroupController.js
│   │   └── schemeController.js
│   ├── routes/
│   │   ├── citizenRoutes.js
│   │   ├── userGroupRoutes.js
│   │   └── schemeRoutes.js
│   ├── middleware/
│   │   └── errorMiddleware.js
│   ├── utils/
│   │   └── dbInit.js         # Database initialization
│   └── index.js              # Main entry point
├── package.json
├── docker-compose.yml        # Neo4j + API setup
├── .env.example
├── Dockerfile
└── API.md                    # API documentation
```

## Quick Start

### Prerequisites

- Node.js v16+
- npm v8+
- Docker & Docker Compose (for Neo4j)

### Installation

1. **Clone and install**
   ```bash
   cd Database
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Neo4j credentials
   ```

3. **Start Neo4j**
   ```bash
   docker-compose up -d neo4j
   ```

   Access Neo4j Browser: http://localhost:7474
   - Default credentials: neo4j / your_secure_password_here

4. **Initialize database**
   ```bash
   npm run db:init
   ```

5. **Start the API server**
   ```bash
   npm start
   ```

   API running on: http://localhost:3000

### Development Mode

With auto-reload on file changes:

```bash
npm run dev
```

## Graph Schema

### Nodes

- **Citizen**: Individual users with demographic data
- **UserGroup**: Demographic segments (Farmers, Students, Senior Citizens, etc.)
- **Scheme**: Government schemes/programs
- **Location**: Geographic hierarchy (States/Districts)
- **Document**: Required document types
- **EligibilityRule**: Conditions for scheme eligibility
- **Application**: Scheme applications from citizens
- **Nudge**: Notifications/reminders for citizens
- **GovAPI**: Government API sources

### Key Relationships

```
(Citizen)-[:BELONGS_TO]->(UserGroup)
(Citizen)-[:LOCATED_IN]->(Location)
(Scheme)-[:TARGETS]->(UserGroup)
(Scheme)-[:VALID_IN]->(Location)
(Scheme)-[:REQUIRES]->(Document)
(Scheme)-[:HAS_RULE]->(EligibilityRule)
(Citizen)-[:APPLIED_FOR]->(Scheme)
(Citizen)-[:RECEIVED_NUDGE]->(Nudge)
(Scheme)-[:FETCHED_FROM]->(GovAPI)
```

## User Groups (Bucketing)

The system includes 9 predefined demographic buckets:

1. **Farmer** - Agricultural workers and farmers
2. **Student** - Students pursuing education (Age 18-25)
3. **Senior Citizen** - Elderly (Age 60+)
4. **Low Income Worker** - Annual income < ₹2.5L
5. **Women** - Women-focused schemes
6. **MSME / Self-employed** - Small business owners
7. **Disabled** - Persons with disabilities
8. **Rural Household** - Rural population
9. **Urban BPL** - Urban below poverty line

Initialize them via API:
```bash
POST /api/v1/user-groups/init/defaults
```

## API Documentation

See [API.md](./API.md) for complete API documentation.

### Quick Examples

**Create a Citizen:**
```bash
POST /api/v1/citizens
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "aadhar": "123456789012",
  "locationId": "state-id-here",
  "userGroupIds": ["farmer-group-id"]
}
```

**Initialize Default User Groups:**
```bash
POST /api/v1/user-groups/init/defaults
```

**Get All Schemes:**
```bash
GET /api/v1/schemes?skip=0&limit=50
```

**Check Citizen Eligibility:**
```bash
GET /api/v1/schemes/:schemeId/check-eligibility/:citizenId
```

## Deployment

### Using Docker

Build and run the complete stack:

```bash
docker-compose up -d
```

This starts:
- Neo4j database (port 7687)
- Neo4j Browser (port 7474)
- Node.js API server (port 3000)

### Environment Variables

Create `.env` file:

```env
# Neo4j
NEO4J_HOST=localhost
NEO4J_PORT=7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_secure_password
NEO4J_ENCRYPTED=true

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## Maintenance

### Database Backup

Neo4j data is persisted in Docker volumes. To backup:

```bash
docker exec ai4bharat-neo4j neo4j-admin dump --to-path=/var/lib/neo4j/backups
```

### Database Reset

```bash
docker-compose down -v
docker-compose up -d neo4j
npm run db:init
```

## Performance Considerations

- **Indexes**: The database automatically creates indexes on frequently queried fields
- **Constraints**: Unique constraints ensure data integrity
- **Connection Pool**: Configured with max 50 connections
- **Query Optimization**: Service layer uses efficient Cypher queries

## Common Issues

### Connection Refused
- Ensure Neo4j is running: `docker-compose ps`
- Check credentials in `.env`
- Verify Neo4j port (7687) is not blocked

### Validation Errors
- Check request payload format
- Ensure all required fields are provided
- See error messages for field-specific issues

### Database Locked
- Neo4j is single-write, restart if needed
- Check logs: `docker-compose logs neo4j`

## Contributing

To extend the API:

1. Add new service in `src/services/`
2. Create controller in `src/controllers/`
3. Add routes in `src/routes/`
4. Update API documentation

## Support & Contact

For issues or questions:
- Create an issue in the repository
- Contact Team Prahar

## License

MIT

---

**Made with ❤️ by Team Prahar for AI4Bharat**
