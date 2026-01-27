# Security Overview

This document outlines the security architecture, threat model, and controls implemented in the Lab Counters application.

## Application Overview

Lab Counters is a multi-tenant web application for managing laboratory manual count worksheets. It handles sensitive healthcare-related data and requires compliance with laboratory quality standards.

## Threat Model

### Assets
1. **Count Records** - Patient specimen counting data with verification chains
2. **User Credentials** - Managed by AWS Cognito
3. **Audit Logs** - Immutable records of all system actions
4. **Organization Data** - Multi-tenant data with strict isolation
5. **PDF Artifacts** - Immutable records of verified counts

### Threat Actors
1. **External Attackers** - Attempting unauthorized access
2. **Malicious Insiders** - Users attempting to exceed authorized access
3. **Accidental Misuse** - Authorized users making mistakes

### Primary Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Cross-tenant data access | High | Medium | Org scoping middleware, database constraints |
| Unauthorized record modification | High | Medium | Role-based access, state machine enforcement |
| Credential compromise | High | Medium | AWS Cognito, rate limiting, lockout policies |
| Data tampering | High | Low | Audit logging, version tracking, PDF artifacts |
| Session hijacking | Medium | Low | JWT with short expiry, secure transport |
| Brute force attacks | Medium | Medium | Rate limiting, account lockout |

## Security Controls

### Authentication
- **AWS Cognito** - Managed user pool with secure credential storage
- **JWT Tokens** - RS256 signed tokens from Cognito
- **Token Validation** - JWKS verification against Cognito public keys
- **Session Management** - Short-lived access tokens with refresh capability
- **Account Lockout** - 5 failed attempts triggers 15-minute lockout

### Authorization
- **Role-Based Access Control (RBAC)**
  - `superadmin` - Full system access across all organizations
  - `admin` - Organization-level management
  - `supervisor` - Record verification and team oversight
  - `technologist` - Count entry and self-verification (if enabled)
  - `readonly` - View-only access

- **Multi-Tenant Isolation**
  - All queries scoped by `orgId` from authenticated user
  - `enforceOrgScope` middleware prevents cross-org access
  - Database indexes optimized for org-scoped queries

- **Site-Level Permissions**
  - Users assigned to one or more sites
  - Site status (active/inactive) enforced at authentication
  - Organization status blocks all users when inactive

### Input Validation
- **Zod Schemas** - All API inputs validated with strict schemas
- **Type Safety** - TypeScript throughout stack
- **Request Size Limits** - Body limited to 10KB
- **SQL Injection Prevention** - Prisma ORM with parameterized queries

### Rate Limiting
- **General API** - 100 requests/minute/IP
- **Authentication** - 10 requests/minute/IP
- **Sensitive Operations** - 5 requests/minute/user

### Transport Security
- **HTTPS Required** - In production environments
- **HSTS** - Strict-Transport-Security header (1 year, includeSubDomains, preload)
- **Secure Headers** - X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

### Audit & Logging
- **Correlation IDs** - All requests tagged with unique ID
- **Audit Events** - All mutations logged with actor, action, metadata
- **Security Logging** - Auth events, errors, sensitive operations logged
- **Log Redaction** - Tokens and sensitive data excluded from logs

### Data Protection
- **Record Versioning** - All changes create new versions with audit trail
- **Immutable PDFs** - Verified records generate tamper-evident PDFs
- **Optimistic Concurrency** - Version checking prevents lost updates
- **Soft Deletes** - Records archived, not deleted

## Backup & Recovery

### Database Backups
- **Development** - Local PostgreSQL with Docker volumes
- **Production** - AWS RDS with automated daily snapshots
- **Retention** - 7-day automated backup retention (configurable)
- **Point-in-Time Recovery** - RDS supports PITR within retention window

### Recovery Procedures
1. **Database Restore** - RDS snapshot restore to new instance
2. **Application Deploy** - Container redeploy from registry
3. **PDF Storage** - S3 versioning and cross-region replication (production)

## Incident Response

### Detection
- Security logs monitored for anomalies
- Rate limit violations tracked
- Failed authentication attempts logged

### Response
1. **Containment** - Disable affected accounts/IPs
2. **Investigation** - Correlation ID trace through logs
3. **Recovery** - Database restore if data compromised
4. **Notification** - Affected organizations notified per compliance requirements

## Compliance Considerations

### Data Handling
- PHI-adjacent data (specimen IDs) requires secure handling
- Audit logs maintained for regulatory compliance
- PDF worksheets serve as official records

### Access Control
- Principle of least privilege enforced
- Role assignments logged
- Site-based permissions for physical location compliance

## Environment Variables

### Required Secrets (Production)
```
DATABASE_URL          # PostgreSQL connection string
COGNITO_USER_POOL_ID  # AWS Cognito pool ID
COGNITO_CLIENT_ID     # AWS Cognito app client ID
AWS_REGION            # AWS region for services
```

### Optional Configuration
```
PORT                  # API server port (default: 3001)
CORS_ORIGIN           # Allowed CORS origin
STORAGE_PROVIDER      # 'local' or 's3' for PDF storage
STORAGE_PATH          # Local storage path (if local)
S3_BUCKET             # S3 bucket for PDFs (if s3)
```

## Security Contacts

For security issues, contact the development team through the project repository.

## Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2025-01 | Initial | Document created |
