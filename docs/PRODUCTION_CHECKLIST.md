# Production Launch Checklist

## Database Safety (CRITICAL)

### AWS RDS Setup
- [ ] Use AWS RDS PostgreSQL (not self-managed)
- [ ] Enable **Multi-AZ deployment** for high availability
- [ ] Enable **Deletion Protection** (prevents accidental deletion)
- [ ] Set **Backup Retention** to 30 days minimum
- [ ] Enable **Point-in-Time Recovery**
- [ ] Create a **Read Replica** in a different region (disaster recovery)

### Database Access
- [ ] Database not publicly accessible (VPC only)
- [ ] Use IAM authentication or strong credentials
- [ ] Store credentials in AWS Secrets Manager (not env files)
- [ ] Separate database users for app vs admin operations
- [ ] No production database access from development machines

### Migration Safety
- [ ] Only use `prisma migrate deploy` in production (never `db push` or `reset`)
- [ ] Test all migrations on staging before production
- [ ] Create manual backup before each migration
- [ ] Have rollback plan for each migration

---

## Authentication & Security

### AWS Cognito
- [ ] Separate User Pool for production (not shared with dev)
- [ ] Enable MFA for all users (at minimum for admins)
- [ ] Configure password policy (12+ chars, complexity)
- [ ] Enable advanced security features (compromised credentials detection)
- [ ] Set up account recovery options

### API Security
- [ ] HTTPS only (no HTTP)
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Request size limits configured
- [ ] Security headers (HSTS, CSP, X-Frame-Options)
- [ ] API authentication required on all endpoints
- [ ] Input validation on all endpoints

### Secrets Management
- [ ] No secrets in code or git
- [ ] All secrets in AWS Secrets Manager or Parameter Store
- [ ] Rotate secrets regularly
- [ ] Different secrets for each environment

---

## Infrastructure

### Compute
- [ ] Use AWS ECS, EKS, or Elastic Beanstalk (not EC2 directly)
- [ ] Auto-scaling configured
- [ ] Health checks configured
- [ ] Multiple availability zones

### Networking
- [ ] VPC with private subnets for database
- [ ] NAT Gateway for outbound traffic
- [ ] Security groups properly configured
- [ ] AWS WAF for web application firewall

### CDN & Frontend
- [ ] CloudFront for static assets
- [ ] S3 bucket not publicly accessible (CloudFront OAI)
- [ ] HTTPS certificates via ACM

---

## Monitoring & Alerting

### Logging
- [ ] CloudWatch Logs for all services
- [ ] Log retention policy (90+ days)
- [ ] Structured logging (JSON format)
- [ ] No PII/PHI in logs (or properly masked)

### Metrics & Alerts
- [ ] CloudWatch alarms for:
  - [ ] Database CPU > 80%
  - [ ] Database storage < 20%
  - [ ] Database connections > 80%
  - [ ] API error rate > 1%
  - [ ] API latency p99 > 2s
  - [ ] Failed login attempts spike
- [ ] PagerDuty/Opsgenie integration for critical alerts
- [ ] Dashboard for key metrics

### Uptime Monitoring
- [ ] External uptime monitoring (e.g., Pingdom, UptimeRobot)
- [ ] Status page for customers

---

## Compliance (Healthcare/HIPAA)

### Data Protection
- [ ] Encryption at rest (RDS, S3)
- [ ] Encryption in transit (TLS 1.2+)
- [ ] BAA signed with AWS
- [ ] Audit logging for all data access
- [ ] Data retention policy defined

### Access Control
- [ ] Role-based access control (implemented)
- [ ] Principle of least privilege
- [ ] Regular access reviews
- [ ] Offboarding process for users

### Documentation
- [ ] Security policies documented
- [ ] Incident response plan
- [ ] Business continuity plan
- [ ] Data breach notification process

---

## Backup & Disaster Recovery

### Backup Strategy
- [ ] RDS automated backups (daily)
- [ ] Manual snapshots before major changes
- [ ] Cross-region backup replication
- [ ] Backup encryption enabled

### Recovery Testing
- [ ] **TEST RESTORE FROM BACKUP** (do this before launch!)
- [ ] Document recovery time (RTO)
- [ ] Document recovery point (RPO)
- [ ] Quarterly restore drills

### Disaster Recovery
- [ ] Multi-region failover plan
- [ ] DNS failover configured (Route 53)
- [ ] Runbook for disaster scenarios

---

## Pre-Launch Testing

### Load Testing
- [ ] Test with expected peak load
- [ ] Test with 2x expected load
- [ ] Identify bottlenecks

### Security Testing
- [ ] Penetration test
- [ ] Dependency vulnerability scan
- [ ] OWASP Top 10 review

### User Acceptance
- [ ] Pilot with one hospital/site
- [ ] Gather feedback
- [ ] Fix critical issues

---

## Go-Live

### Launch Day
- [ ] Team on standby
- [ ] Rollback plan ready
- [ ] Communication plan for issues
- [ ] Gradual rollout (not all customers at once)

### Post-Launch
- [ ] Monitor closely for 48 hours
- [ ] Daily check-ins for first week
- [ ] Collect user feedback
- [ ] Address issues promptly

---

## Estimated Costs (AWS)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| RDS PostgreSQL (db.t3.medium, Multi-AZ) | $70-150 |
| ECS/Fargate (2 tasks) | $30-60 |
| CloudFront + S3 | $10-30 |
| Cognito | Free tier (50k MAU) |
| CloudWatch | $10-30 |
| Secrets Manager | $5-10 |
| **Total** | **$125-280/month** |

Scales with usage. First hospital could run on ~$150/month.

---

## Support Contacts

- AWS Support: (upgrade to Business tier before launch)
- Your infrastructure person: TBD
- On-call rotation: TBD

---

## Notes

The "database reset" issue you experienced in development **cannot happen in production** because:

1. `prisma db push --force-reset` is blocked by Prisma in production mode
2. RDS Deletion Protection prevents accidental database deletion
3. Automated backups allow point-in-time recovery
4. Even if someone deleted the database, backups restore everything

The key is: **Test your backup restore process before going live.** Actually restore from a backup to a test database and verify the data is intact.
