# Quick Start Guide

Complete setup instructions for getting the AI4Bharat Graph Database running.

## Prerequisites Checklist

- [ ] Node.js v16+ installed (`node --version`)
- [ ] npm v8+ installed (`npm --version`)
- [ ] Docker & Docker Compose installed (`docker --version`)
- [ ] Windows/Mac/Linux system with internet connection
- [ ] Git installed for cloning/pulling

## Setup Steps

### 1. Clone/Navigate to Project

```bash
cd d:\Projects\AI4Bharat\Database
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages:
- neo4j-driver (database connectivity)
- express (web server)
- joi (input validation)
- cors, helmet (security)
- dotenv (environment variables)

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your settings (if needed)
# Default settings should work for local development
```

### 4. Start Neo4j Database

```bash
# Start Neo4j in Docker
docker-compose up -d neo4j

# Wait for database to be ready (30-60 seconds)
docker-compose logs neo4j
```

**Access Neo4j Browser:**
- URL: http://localhost:7474
- Username: `neo4j`
- Password: `your_secure_password_here` (from docker-compose.yml)

### 5. Initialize Database Schema

```bash
# Create constraints and indexes
npm run db:init
```

This sets up:
- Unique constraints on IDs and emails
- Indexes for query performance
- Database structure

### 6. Start API Server

```bash
# Option A: Production mode
npm start

# Option B: Development mode (with auto-reload)
npm run dev
```

API will be available at: **http://localhost:3000**

### 7. Verify Installation

```bash
# Test health endpoint
curl http://localhost:3000/health

# Check API status
curl http://localhost:3000/api/v1/status
```

---

## First Steps After Setup

### Initialize Default User Groups

```bash
curl -X POST http://localhost:3000/api/v1/user-groups/init/defaults
```

This creates all 9 demographic buckets:
- Farmer
- Student
- Senior Citizen
- Low Income Worker
- Women
- MSME / Self-employed
- Disabled
- Rural Household
- Urban BPL

### Create a Test Citizen

```bash
curl -X POST http://localhost:3000/api/v1/citizens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Citizen",
    "email": "test@example.com",
    "phone": "9876543210",
    "aadhar": "123456789012"
  }'
```

### View All User Groups

```bash
curl http://localhost:3000/api/v1/user-groups
```

---

## Docker Compose Management

### View Logs

```bash
# All services
docker-compose logs

# Only Neo4j
docker-compose logs neo4j

# Only API
docker-compose logs api

# Follow logs (live)
docker-compose logs -f
```

### Stop Services

```bash
# Stop without removing
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

### Check Service Status

```bash
docker-compose ps
```

### Restart Service

```bash
# Restart all
docker-compose restart

# Restart only Neo4j
docker-compose restart neo4j
```

---

## Development Workflow

### 1. Add New Feature

Create files in appropriate directories:
- Service: `src/services/newService.js`
- Controller: `src/controllers/newController.js`
- Routes: `src/routes/newRoutes.js`

### 2. Test Changes

```bash
# Run in dev mode for live reload
npm run dev

# Test with curl or Postman
```

### 3. Check Logs

Logs are printed to console with timestamps and colors:
- 🔴 RED: ERROR
- 🟡 YELLOW: WARN
- 🔵 CYAN: INFO
- ⚪ GRAY: DEBUG

Change log level in `.env`:
```
LOG_LEVEL=debug  # Show all logs
LOG_LEVEL=info   # Hide debug logs
LOG_LEVEL=warn   # Only warnings and errors
```

### 4. Database Queries

Query direct via Neo4j Browser:
1. Go to http://localhost:7474
2. Run Cypher queries:

```cypher
# See all citizens
MATCH (c:Citizen) RETURN c

# See all user groups
MATCH (ug:UserGroup) RETURN ug

# See relationships
MATCH (c:Citizen)-[r]->(ug:UserGroup) RETURN c, r, ug
```

---

## Troubleshooting

### "Connection refused" Error

**Issue:** Can't connect to Neo4j
- **Solution:** Check docker running: `docker ps`
- **Fix:** Restart: `docker-compose down && docker-compose up -d neo4j`

### "Port already in use"

**Issue:** Port 3000 or 7687 already in use
- **Solution:** Change ports in docker-compose.yml or .env
- **Or:** Kill existing process

### Database Locked

**Issue:** Neo4j won't start or queries hang
- **Solution:** 
  ```bash
  docker-compose restart neo4j
  ```

### Validation Errors

**Issue:** "Validation failed" when creating records
- **Solution:** Check required fields:
  - Citizen: name, email, phone, aadhar
  - Scheme: name, description, category, launch_date, budget, target_audience
  - UserGroup: name

### Out of Memory

**Issue:** Docker container exits with "Out of memory"
- **Solution:** Increase Docker memory in settings
- **Or:** Add memory limit in docker-compose.yml:
  ```yaml
  neo4j:
    mem_limit: 4g
  ```

---

## Performance Tips

### Pagination

Always use pagination for large datasets:
```bash
GET /api/v1/citizens?skip=0&limit=50
```

### Filtering

Use filters to reduce results:
```bash
GET /api/v1/citizens?userGroupId=uuid&locationId=uuid
```

### Batch Operations

Create multiple records efficiently (bulk endpoint coming soon)

---

## Backup & Restore

### Backup Database

```bash
# Create backup
docker exec ai4bharat-neo4j neo4j-admin dump --to-path=/var/lib/neo4j/backups

# Copy from Docker
docker cp ai4bharat-neo4j:/var/lib/neo4j/backups ./backups
```

### Restore Database

```bash
# Copy backup to Docker
docker cp ./backups ai4bharat-neo4j:/var/lib/neo4j/backups

# Restore (requires Neo4j stopped)
docker-compose stop neo4j
docker exec ai4bharat-neo4j neo4j-admin load --from-path=/var/lib/neo4j/backups
docker-compose start neo4j
```

---

## Production Deployment

### Environment Setup

Create `.env` for production:
```env
NEO4J_HOST=neo4j.production.com
NEO4J_PORT=7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=SECURE_PASSWORD_HERE
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

### Using Docker Stack

```bash
# Build images
docker-compose build

# Run full stack
docker-compose up -d

# Scale API instances
docker-compose up -d --scale api=3
```

### Health Monitoring

```bash
# Continuous health checks
while true; do 
  curl http://localhost:3000/health
  sleep 30
done
```

---

## Common Operations

### Export Data

Query Neo4j and export to CSV:
```bash
curl "http://localhost:7474/db/data/transaction" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"statements": [{"statement": "MATCH (c:Citizen) RETURN c"}]}'
```

### Reset Database

```bash
docker-compose down -v
docker-compose up -d neo4j
npm run db:init
```

### View Database Size

```bash
docker exec ai4bharat-neo4j du -sh /var/lib/neo4j/data
```

---

## Support & Debugging

### Enable Debug Mode

```bash
LOG_LEVEL=debug npm start
```

### Get System Info

```bash
npm --version
node --version
docker --version
docker-compose --version
```

### Enable Neo4j Logs

```bash
docker-compose logs neo4j --follow
```

### Check Resource Usage

```bash
docker stats
```

---

## Next Steps

1. ✅ Server running
2. 📚 Read [API.md](./API.md) for API documentation
3. 🧪 Use provided curl examples in EXAMPLES.md
4. 🏗️ Share API with your team
5. 🚀 Build client applications

---

**Still have questions?** Check the main [README.md](./README.md) or contact Team Prahar.
