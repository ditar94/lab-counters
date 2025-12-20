# Lab Counters

A secure, auditable laboratory cell counting and documentation system designed for clinical laboratory environments with SOC 2 and HIPAA compliance considerations.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Features Implemented](#features-implemented)
- [Development Setup](#development-setup)
- [Production Readiness Checklist](#production-readiness-checklist)
- [SOC 2 Compliance Status](#soc-2-compliance-status)
- [HIPAA Considerations](#hipaa-considerations)
- [API Documentation](#api-documentation)

---

## Project Overview

Lab Counters is a full-stack TypeScript application for clinical laboratories to:
- Perform and record cell counts (hemocytometer, differential, etc.)
- Enforce verification workflows (dual-control)
- Maintain complete audit trails for regulatory compliance
- Support multi-tenant architecture for multiple organizations/hospitals

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, React Router |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Authentication | AWS Cognito (JWT with JWKS verification) |
| Validation | Zod (runtime schema validation) |
| Monorepo | Turborepo |

---

## Architecture

```
lab-counters/
├── packages/
│   ├── api/              # Express backend
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # JWT verification, failed login tracking
│   │   │   │   ├── security.ts    # Rate limiting, correlation IDs
│   │   │   │   └── error-handler.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # Authentication endpoints
│   │   │   │   ├── records.ts     # Count record CRUD
│   │   │   │   ├── users.ts       # User management
│   │   │   │   └── health.ts      # Health checks
│   │   │   ├── services/
│   │   │   │   ├── audit.ts       # Audit logging
│   │   │   │   └── calculations.ts # Count calculations
│   │   │   └── lib/
│   │   │       └── prisma.ts      # Database client
│   │   └── prisma/
│   │       └── schema.prisma      # Database schema
│   │
│   ├── web/              # React frontend
│   │   └── src/
│   │       ├── components/
│   │       │   └── counters/
│   │       │       └── Hemocytometer.tsx
│   │       ├── contexts/
│   │       │   └── AuthContext.tsx
│   │       └── pages/
│   │
│   └── shared/           # Shared types and schemas
│       └── src/
│           ├── types.ts   # TypeScript interfaces
│           └── schemas.ts # Zod validation schemas
│
├── docker-compose.yml    # Local PostgreSQL
└── turbo.json           # Turborepo configuration
```

### Multi-Tenancy Model

- **Organization**: Top-level tenant (hospital/lab)
- **Site**: Physical location within an organization
- **User**: Belongs to one organization and one site
- **Records**: Scoped to organization, filtered by site

All queries are automatically scoped by `orgId` via the `enforceOrgScope` middleware.

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| `admin` | Full access, user management, delete records |
| `supervisor` | Create, verify records, view reports |
| `technologist` | Create records, submit for verification |
| `readonly` | View records only |

---

## Features Implemented

### Core Counting Features

#### Hemocytometer Counter
- **Dual-side counting** with automatic averaging
- **Tolerance checking**: ±5 if count <10, otherwise ±20%
- **Shared or separate settings**: Default applies same dilution/squares to both RBC and TNC
- **Optional split mode**: Separate dilution factor and squares counted for RBC vs TNC
- **Calculations**: Automatic concentration calculations with dilution factors

#### Record Lifecycle
```
draft → pending_verification → verified (immutable)
```

- Draft records can be edited
- Submitted records await supervisor verification
- Verified records become immutable with timestamp and verifier ID
- Self-verification prevention (configurable per organization)

### Security Features (Implemented)

#### Rate Limiting
```typescript
// General API: 100 requests/minute per IP
// Auth endpoints: 10 requests/minute per IP
// Sensitive operations: 5 requests/minute per user
```

#### Failed Login Tracking
- Tracks failed authentication attempts by IP
- Lockout after 5 failed attempts for 15 minutes
- Automatic reset on successful authentication

#### Security Headers (via Helmet)
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

#### Correlation IDs
- Every request gets a unique `X-Correlation-ID`
- Propagated through logs for request tracing
- Returned in response headers

#### Audit Logging
Every data modification is logged with:
- Correlation ID
- User ID
- IP address (with proxy detection)
- User agent
- Old/new values
- Timestamp

### Authentication
- AWS Cognito integration with JWKS verification
- Development bypass (`dev-token`) for local testing
- Token expiration with specific error codes
- Automatic user lookup and status checking

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- npm 9+

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example packages/api/.env

# For development, these work out of the box:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/labcounters
# NODE_ENV=development
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed with test data
npm run db:seed
```

### 5. Start Development Servers

```bash
# Start both API and web
npm run dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

### Development Authentication

In development mode, you can bypass Cognito:

```bash
# Using dev-token with default admin user
curl -H "Authorization: Bearer dev-token" http://localhost:3001/api/auth/me

# Specify user type
curl -H "Authorization: Bearer dev-token" \
     -H "X-Dev-User-Type: technologist" \
     http://localhost:3001/api/records
```

---

## Production Readiness Checklist

### Critical (Must Have)

- [ ] **HTTPS/TLS Configuration**
  - Configure TLS certificates (AWS ACM or Let's Encrypt)
  - Enforce HTTPS redirects
  - Set `secure: true` on cookies

- [ ] **AWS Cognito Setup**
  - Create production User Pool
  - Configure MFA (required for compliance)
  - Set up password policies (min 12 chars, complexity requirements)
  - Configure token expiration (recommend 1 hour access, 30 day refresh)

- [ ] **Environment Variables**
  - Remove `NODE_ENV=development` bypass
  - Set production database URL (RDS recommended)
  - Configure production CORS origins
  - Set up secrets management (AWS Secrets Manager)

- [ ] **Database**
  - Migrate to AWS RDS PostgreSQL
  - Enable encryption at rest
  - Configure automated backups (30+ day retention)
  - Set up read replicas for reporting

- [ ] **Rate Limiting Persistence**
  - Replace in-memory rate limiting with Redis
  - Configure Redis with encryption in transit
  - Use AWS ElastiCache or similar

- [ ] **Failed Login Tracking**
  - Replace in-memory Map with Redis
  - Persist across server restarts

### Important (Should Have)

- [ ] **Logging Infrastructure**
  - Configure CloudWatch or similar
  - Set up log retention policies (minimum 1 year for compliance)
  - Create alerting for security events

- [ ] **Monitoring**
  - APM integration (DataDog, New Relic)
  - Health check monitoring
  - Uptime monitoring

- [ ] **Email Notifications**
  - Verification required notifications
  - Password reset emails
  - Suspicious activity alerts

- [ ] **Backup & Recovery**
  - Automated database backups
  - Point-in-time recovery capability
  - Document RTO/RPO

- [ ] **Error Tracking**
  - Sentry or similar integration
  - Alert on critical errors

### Nice to Have

- [ ] **Additional Counter Types**
  - Differential counter
  - Manual cell counter
  - Custom counter templates

- [ ] **Reporting**
  - Export to PDF/CSV
  - Quality control charts
  - Statistical analysis

- [ ] **Integrations**
  - LIS (Laboratory Information System) integration
  - HL7/FHIR support

---

## SOC 2 Compliance Status

### Trust Service Criteria

#### Security (Common Criteria)

| Control | Status | Notes |
|---------|--------|-------|
| CC6.1 - Logical Access | ✅ Implemented | Role-based access, authentication |
| CC6.2 - Prior to Access | ✅ Implemented | User registration requires admin approval |
| CC6.3 - Removal of Access | ⚠️ Partial | Need admin UI for deactivation |
| CC6.6 - Threats | ✅ Implemented | Rate limiting, failed login tracking |
| CC6.7 - Transmission | ⚠️ Pending | Requires HTTPS in production |
| CC6.8 - Prevention | ✅ Implemented | Input validation, SQL injection prevention |

#### Availability

| Control | Status | Notes |
|---------|--------|-------|
| A1.1 - Capacity | ⚠️ Pending | Need load testing and auto-scaling |
| A1.2 - Recovery | ⚠️ Pending | Need backup/restore procedures |

#### Confidentiality

| Control | Status | Notes |
|---------|--------|-------|
| C1.1 - Identification | ✅ Implemented | Data scoped by organization |
| C1.2 - Protection | ⚠️ Pending | Need encryption at rest |

### What's Implemented

1. **Access Controls**
   - JWT-based authentication with Cognito
   - Role-based authorization
   - Organization-scoped data isolation
   - Self-verification prevention

2. **Audit Trail**
   - Complete audit logging of all data changes
   - User identification, timestamps, IP addresses
   - Old/new value tracking

3. **Security Monitoring**
   - Correlation IDs for request tracing
   - Security event logging
   - Failed authentication tracking

4. **Input Validation**
   - Zod schema validation on all inputs
   - SQL injection prevention via Prisma ORM
   - Request body size limits

5. **Rate Limiting**
   - General API rate limits
   - Stricter auth endpoint limits
   - Per-user limits on sensitive operations

### What's Needed for SOC 2 Audit

1. **Documentation**
   - [ ] Information Security Policy
   - [ ] Access Control Policy
   - [ ] Incident Response Plan
   - [ ] Business Continuity Plan
   - [ ] Change Management Policy

2. **Technical Controls**
   - [ ] Encryption at rest (database, backups)
   - [ ] Encryption in transit (HTTPS everywhere)
   - [ ] MFA for all users
   - [ ] Vulnerability scanning
   - [ ] Penetration testing

3. **Operational Controls**
   - [ ] Security awareness training records
   - [ ] Background check documentation
   - [ ] Vendor risk assessments
   - [ ] Regular access reviews

---

## HIPAA Considerations

If handling Protected Health Information (PHI):

### Technical Safeguards

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Access Control | ✅ | Role-based access |
| Audit Controls | ✅ | Complete audit logging |
| Integrity Controls | ✅ | Verified records immutable |
| Transmission Security | ⚠️ | Pending HTTPS |
| Encryption | ⚠️ | Pending at-rest encryption |

### Administrative Safeguards

- [ ] BAA with hosting provider (AWS)
- [ ] HIPAA policies and procedures
- [ ] Workforce training documentation
- [ ] Risk assessment documentation

### Physical Safeguards

- Use AWS HIPAA-eligible services
- Enable AWS CloudTrail
- Use private subnets for database

---

## API Documentation

### Authentication

All endpoints except `/health` require authentication via Bearer token.

```http
Authorization: Bearer <cognito-jwt-token>
```

### Endpoints

#### Auth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/sync` - Sync user after Cognito auth
- `POST /api/auth/register` - Register new user

#### Records
- `GET /api/records` - List records (paginated, filtered)
- `GET /api/records/:id` - Get single record
- `POST /api/records` - Create new record
- `PATCH /api/records/:id` - Update draft record
- `POST /api/records/:id/submit` - Submit for verification
- `POST /api/records/:id/verify` - Verify record (supervisors/admins)
- `DELETE /api/records/:id` - Delete draft record (admins)

#### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `PATCH /api/users/:id` - Update user

#### Health
- `GET /health` - Health check (no auth required)

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid token |
| `TOKEN_EXPIRED` | JWT has expired |
| `USER_NOT_FOUND` | User not in database |
| `USER_INACTIVE` | User account not active |
| `FORBIDDEN` | Insufficient permissions |
| `TOO_MANY_ATTEMPTS` | Rate limit exceeded |
| `NOT_FOUND` | Resource not found |
| `IMMUTABLE` | Verified record cannot be modified |
| `SELF_VERIFICATION_NOT_ALLOWED` | Cannot verify own record |

---

## Scripts Reference

```bash
# Development
npm run dev          # Start all packages in dev mode
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run test         # Run all tests

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed test data
npm run db:studio    # Open Prisma Studio

# Individual packages
npm run dev --filter=@lab-counters/api
npm run dev --filter=@lab-counters/web
```

---

## License

Private - All rights reserved

---

## Contributing

This is a private commercial project. Contact the project owner for contribution guidelines.
