# DEPLOYMENT & PRODUCTION SETUP CHECKLIST

Complete checklist for deploying the AI4Bharat Graph Database to production.

---

## 🔐 Security Configurations

### Neo4j Database
- [ ] Change default password from `your_secure_password_here`
  ```env
  NEO4J_PASSWORD=YourStrongPassword123!@#
  ```
- [ ] Enable authentication in Neo4j
- [ ] Disable bolt protocol on non-local networks (if needed)
- [ ] Enable Neo4j Enterprise security features (if applicable)
- [ ] Set up Neo4j backup schedule
- [ ] Configure firewall to restrict port 7687 to API only

### Application
- [ ] Generate strong JWT secret if using authentication
- [ ] Set NODE_ENV=production in .env
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure CORS for specific domains only
- [ ] Set rate limiting headers
- [ ] Add API authentication middleware
- [ ] Implement request validation on all endpoints

### Environment Variables
- [ ] Created .env with production values
- [ ] Removed .env from git tracking
- [ ] Used secure secret management (AWS Secrets Manager, etc.)
- [ ] Set LOG_LEVEL=info (not debug)
- [ ] Set API_TIMEOUT to appropriate value

---

## 🐳 Docker & Deployment

### Docker Setup
- [ ] Built production Docker image
  ```bash
  docker-compose build
  ```
- [ ] Tested container locally
- [ ] Verified health checks work
- [ ] Set resource limits in docker-compose.yml
  ```yaml
  neo4j:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
  ```
- [ ] Set restart policy
  ```yaml
  restart: unless-stopped
  ```

### Data Persistence
- [ ] Configured volume mounts for Neo4j data
- [ ] Set up backup location outside container
- [ ] Tested data recovery process
- [ ] Documented restore procedure

### Network Configuration
- [ ] Configured Docker network isolation
- [ ] Set up reverse proxy (Nginx/Apache)
- [ ] Configured SSL certificates
- [ ] Set up firewall rules
- [ ] Opened necessary ports only (3000, 7474, 7687)

---

## 📊 Database Management

### Initialization
- [ ] Initialized database schema
  ```bash
  npm run db:init
  ```
- [ ] Verified all constraints created
- [ ] Created required indexes
- [ ] Tested constraints work correctly

### Backups
- [ ] Automated daily backups configured
- [ ] Backup retention policy set (30 days minimum)
- [ ] Tested backup restoration procedure
- [ ] Documented backup location
- [ ] Set up backup monitoring alerts

### Monitoring
- [ ] Set up Neo4j monitoring dashboard
- [ ] Monitored disk space usage
- [ ] Monitored connection pool usage
- [ ] Configured alerting for:
  - [ ] High memory usage
  - [ ] Database locked state
  - [ ] Connection failures
  - [ ] Backup failures

---

## 🎯 Application Deployment

### Pre-Deployment Testing
- [ ] Ran all unit tests
  ```bash
  npm test
  ```
- [ ] Manual API testing completed
- [ ] Load testing performed
- [ ] Security audit completed
- [ ] Code review approved

### Deployment Process
- [ ] Database migrations completed
- [ ] Initialized default user groups
  ```bash
  curl -X POST http://api:3000/api/v1/user-groups/init/defaults
  ```
- [ ] Verified API endpoints working
- [ ] Checked health endpoint
- [ ] Monitored logs for errors
- [ ] Performed smoke tests

### Performance Tuning
- [ ] Connection pool size optimized
- [ ] Query timeouts configured
- [ ] Memory allocated to Node.js
- [ ] Database query indexes verified
- [ ] Cache strategy implemented (if needed)

---

## 📡 API Configuration

### Endpoints
- [ ] Health check endpoint configured
  ```bash
  /health
  /api/v1/status
  ```
- [ ] All CRUD endpoints tested
- [ ] Pagination working correctly
- [ ] Error responses formatted properly

### Rate Limiting
- [ ] Rate limiter middleware added
- [ ] Limits set per endpoint:
  - [ ] Public endpoints: 100/min
  - [ ] Auth endpoints: 10/min
  - [ ] Admin endpoints: 50/min

### Logging
- [ ] Centralized logging configured
- [ ] Log aggregation service set up
- [ ] Log retention policy defined
- [ ] Debug logs disabled in production
- [ ] Error tracking service configured (Sentry, etc.)

---

## 🔍 Monitoring & Observability

### Application Monitoring
- [ ] Application Performance Monitoring (APM) enabled
  - [ ] New Relic, DataDog, or similar
- [ ] Error rate alarms configured
- [ ] Response time metrics tracked
- [ ] Custom metrics created for:
  - [ ] Citizen creation rate
  - [ ] Scheme application rate
  - [ ] Database query performance

### Infrastructure Monitoring
- [ ] CPU usage monitoring
- [ ] Memory usage monitoring
- [ ] Disk space monitoring
- [ ] Network I/O monitoring
- [ ] Container health checks

### Alerting
- [ ] Slack/PagerDuty integration configured
- [ ] Alert thresholds set:
  - [ ] Error rate > 5%
  - [ ] Response time > 2s
  - [ ] Database connection failures
  - [ ] Disk usage > 80%
  - [ ] Memory usage > 85%

---

## 🚨 Disaster Recovery & Continuity

### Backup & Recovery
- [ ] Daily backups running
- [ ] Weekly test restores performed
- [ ] Recovery time objective (RTO): 4 hours
- [ ] Recovery point objective (RPO): 24 hours
- [ ] Disaster recovery plan documented

### High Availability
- [ ] Database replication configured (if applicable)
- [ ] Application load balancing configured
- [ ] Database failover tested
- [ ] Health checks on all services

### Documentation
- [ ] Runbook created for common operations
- [ ] Incident response plan documented
- [ ] Team trained on recovery procedures
- [ ] Escalation path defined

---

## 🐛 Bug Fixes & Patching

### New Relic Configuration (Example)
If using New Relic:
```bash
npm install newrelic
```

```javascript
// src/index.js (first line)
require('newrelic');
```

### Regular Updates
- [ ] Node.js dependencies updated monthly
- [ ] Security patches applied immediately
- [ ] Neo4j updated quarterly
- [ ] Operating system patches applied

---

## 📋 Documentation

### API Documentation
- [ ] API.md updated with all endpoints
- [ ] Error codes documented
- [ ] Examples updated

### Operations Documentation
- [ ] Deployment procedure documented
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide created
- [ ] On-call runbook created

### Architecture Documentation
- [ ] System architecture diagram created
- [ ] Data flow diagram documented
- [ ] Database schema documented
- [ ] Matrix of who can access what

---

## 👥 Team Preparation

### Training
- [ ] Team trained on new system
- [ ] Version control workflow documented
- [ ] Code review process established
- [ ] Deployment approval process defined

### Access Control
- [ ] Production access restricted
- [ ] SSH keys managed securely
- [ ] Database credentials secured
- [ ] API keys rotated quarterly

### Communication
- [ ] Deployment schedule communicated
- [ ] Stakeholders notified of changes
- [ ] Support documentation prepared
- [ ] Help desk trained on new system

---

## ✅ Pre-Launch Verification

### Final Checks
- [ ] All endpoints tested in production
- [ ] Database constraints verified
- [ ] Indexes verified with SHOW INDEXES
- [ ] Performance baseline established
- [ ] Security audit passed

### Load Testing
- [ ] Load test executed
  - [ ] 100 concurrent users
  - [ ] 1000 requests/second
- [ ] No errors under load
- [ ] Response times acceptable
- [ ] Database stable under load

### Data Quality
- [ ] Sample data loaded
- [ ] Data integrity verified
- [ ] Referential integrity checked
- [ ] No orphaned records

---

## 🚀 Launch Day Checklist

### Before Deployment
- [ ] Team presence confirmed
- [ ] Rollback plan reviewed
- [ ] Stakeholders on standby
- [ ] Monitoring dashboards open
- [ ] Team communication channel active

### During Deployment
- [ ] Database backup taken
- [ ] Application deployed
- [ ] Health checks passed
- [ ] Smoke tests executed
- [ ] Logs monitored for errors

### Post-Deployment
- [ ] All endpoints tested
- [ ] Data integrity verified
- [ ] Performance metrics checked
- [ ] Error rates monitored
- [ ] User feedback collected
- [ ] Documentation updated

---

## 📊 Post-Launch Monitoring (First 24 Hours)

Continue monitoring for 24+ hours:

- [ ] Error rate < 1%
- [ ] Response time < 500ms (p95)
- [ ] Database connections healthy
- [ ] Disk space usage normal
- [ ] Memory usage stable
- [ ] No customer complaints
- [ ] Log files reviewed for issues

---

## 📞 Post-Launch Support

### Support Team
- [ ] Support team on standby for 48 hours
- [ ] Escalation path established
- [ ] Known issues documented
- [ ] Temporary workarounds prepared

### Bug Fixes
- [ ] Critical bug fix process defined
- [ ] Hotfix deployment procedure ready
- [ ] Code review expedited for hotfixes
- [ ] Communication plan for major issues

---

## 🎓 Post-Launch Retrospective (1 Week)

After successful launch:
- [ ] Team retrospective scheduled
- [ ] Deployment process reviewed
- [ ] Issues documented
- [ ] Improvements identified
- [ ] Process updated
- [ ] Team feedback collected

---

## 📝 Sign-Off

### Approvals Required
- [ ] Technical Lead: __________  Date: _______
- [ ] DevOps Lead: __________  Date: _______
- [ ] Product Manager: __________  Date: _______
- [ ] Security Lead: __________  Date: _______

### Deployment Information
- **Deployment Date**: _______
- **Deployed Version**: _______
- **Deployed By**: _______
- **Approved By**: _______
- **Rollback Date (if needed)**: _______

---

## 📚 Additional Resources

- [README.md](./README.md) - Project documentation
- [API.md](./API.md) - API reference
- [SCHEMA.md](./SCHEMA.md) - Database schema
- [QUICKSTART.md](./QUICKSTART.md) - Setup guide

---

**Last Updated**: February 25, 2026
**Version**: 1.0.0
**Status**: Ready for Production ✅

Use this checklist for every production deployment!
