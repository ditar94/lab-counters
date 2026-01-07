```markdown
# Lab Counters

A secure, auditable laboratory cell counting and documentation system designed for clinical laboratory environments with SOC 2 and HIPAA compliance considerations.

> **Quick Links**
> * **Current Sprint & Roadmap:** [README_TRACKING.md](./README_TRACKING.md) – See active development phases, granular task tracking, and "Phase" status.
> * **Deployment Guide:** [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) – See detailed AWS RDS setup, critical security checklists, and go-live procedures.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Features Implemented](#features-implemented)
- [Development Setup](#development-setup)
- [Production Readiness](#production-readiness)
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
│   │   │   ├── middleware/ # Auth, security, error handling
│   │   │   ├── routes/     # API endpoints
│   │   │   ├── services/   # Business logic (audit, calcs)
│   │   │   └── lib/        # Prisma client
│   │   └── prisma/         # Database schema
│   │
│   ├── web/              # React frontend
│   │   └── src/
│   │       ├── components/ # React components
│   │       ├── contexts/   # React contexts (Auth)
│   │       └── pages/
│   │
│   └── shared/           # Shared types and schemas

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

> *For the detailed implementation status of these features (e.g. TODO vs DONE), please see [README_TRACKING.md](./README_TRACKING.md).*

### Core Counting Features

#### Hemocytometer Counter
- **Dual-side counting** with automatic averaging
- **Tolerance checking**: ±5 if count <10, otherwise ±20%
- **Shared or separate settings**: Default applies same dilution/squares to both RBC and TNC
- **Calculations**: Automatic concentration calculations with dilution factors

#### Record Lifecycle

```

draft → pending_verification → verified (immutable)

```
Verified records become immutable with timestamp and verifier ID.

### Security Features
- **Rate Limiting**: 100 req/min (General), 10 req/min (Auth)
- **Failed Login Tracking**: Lockout after 5 failed attempts for 15 minutes
- **Security Headers**: Helmet (CSP, HSTS, X-Frame-Options)
- **Audit Logging**: Data modifications logged with correlation ID, User ID, IP, and old/new values

---

## Development Setup

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)
- npm 9+

### Quick Start
To start the local development environment (Postgres + API + Web) with one command:

```bash
npm run dev:local

```

### Manual Setup

1. **Install**: `npm install`
2. **Database**: `docker-compose up -d`
3. **Env**: `cp .env.example packages/api/.env`
4. **Migrate**: `npm run db:generate && npm run db:migrate`
5. **Start**: `npm run dev`

---

## Production Readiness

**CRITICAL:** Do not deploy without reviewing the **[Production Launch Checklist](./PRODUCTION_CHECKLIST.md)**.

Refer to that document for:

* AWS RDS PostgreSQL safety configuration (Multi-AZ, Backups)
* Cognito production setup (MFA, separate User Pools)
* Infrastructure requirements (ECS/EKS, VPC, SSL)
* Disaster Recovery plans

---

## SOC 2 Compliance Status

### Trust Service Criteria Overview

| Control | Status | Notes |
| --- | --- | --- |
| CC6.1 - Logical Access | ✅ Implemented | Role-based access, authentication |
| CC6.2 - Prior to Access | ✅ Implemented | User registration requires admin approval |
| CC6.3 - Removal of Access | ⚠️ Partial | Need admin UI for deactivation |
| CC6.6 - Threats | ✅ Implemented | Rate limiting, failed login tracking |
| CC6.7 - Transmission | ⚠️ Pending | Requires HTTPS in production |

See [PRODUCTION_CHECKLIST.md](/PRODUCTION_CHECKLIST.md) for required technical controls like Encryption at Rest and MFA.

---

## HIPAA Considerations

If handling Protected Health Information (PHI):

| Requirement | Status | Implementation |
| --- | --- | --- |
| Access Control | ✅ | Role-based access |
| Audit Controls | ✅ | Complete audit logging |
| Integrity Controls | ✅ | Verified records immutable |
| Transmission Security | ⚠️ | Pending HTTPS |

**Physical Safeguards:** Use AWS HIPAA-eligible services and private subnets.

---

## API Documentation

All endpoints except `/health` require authentication via Bearer token.

### Key Endpoints

* `GET /api/auth/me` - Get current user
* `GET /api/records` - List records (paginated, filtered)
* `POST /api/records/:id/verify` - Verify record (supervisors/admins)
* `GET /api/users` - List users

### Error Codes

* `UNAUTHORIZED`, `TOKEN_EXPIRED`, `FORBIDDEN`, `IMMUTABLE`

---

## Scripts Reference

```bash
# Development
npm run dev          # Start all packages in dev mode
npm run dev:local    # Local dev with Docker & migrations
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run test         # Run all tests

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed test data
npm run db:studio    # Open Prisma Studio

```

---

## License & Contributing

Private - All rights reserved.
This is a private commercial project. Contact the project owner for contribution guidelines.

```

```
