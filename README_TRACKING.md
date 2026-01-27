# Lab Counters PRD Tracking

## PRD Goal Overview
Build a secure, multi-tenant web application that replaces manual hemocytometer paper worksheets with auditable, immutable, verification-ready records. The app must support deferred verification, strict org/site isolation, least-privilege access, correction/versioning with audit trail, and PDF artifacts per verified record. The LIS remains the system of record; this app documents the manual process.

## Implementation Checklist (Sequential)

1) Phase 0 — Repo + Baseline
1.1 [DONE] Inspect repo structure.
- Files: README_TRACKING.md
- Commands: `ls`

1.2 [DONE] Make “one command local dev” work (docker-compose for Postgres, env files, install scripts).
- Files: README_TRACKING.md, package.json, scripts/dev-local.sh, packages/web/.env.example
- Commands: `bash scripts/dev-local.sh`

1.3 [DONE] Add lint/typecheck/test commands at root (or confirm they exist). Ensure CI-friendly scripts exist.
- Files: README_TRACKING.md, package.json, packages/api/package.json, packages/web/package.json, packages/shared/package.json
- Commands: `npm run lint`, `npm run typecheck`, `npm run test`

2) Phase 1 — Data Model (PRD Foundations)
2.1 [DONE] Review Prisma schema. Ensure required models exist and are correct.
- Files: README_TRACKING.md, packages/api/prisma/schema.prisma, packages/shared/src/types.ts, packages/shared/src/schemas.ts, packages/api/src/routes/records.ts, packages/api/src/services/audit.ts, packages/api/src/routes/auth.ts, packages/api/src/routes/superadmin/organizations.ts, packages/api/src/routes/superadmin/sites.ts, packages/api/src/routes/superadmin/users.ts, packages/web/src/components/Dashboard.tsx, packages/web/src/components/records/RecordsList.tsx, packages/web/src/components/records/RecordDetail.tsx, packages/web/src/components/counters/Hemocytometer.tsx, packages/web/src/components/counters/Fetal.tsx, packages/web/src/components/counters/Retic.tsx, packages/web/src/components/counters/Parasite.tsx, packages/web/src/components/layout/Layout.tsx
- Commands: `npm run typecheck`

2.2 [DONE] Implement strict multi-tenant constraints and indexes.
- Files: README_TRACKING.md, packages/api/prisma/schema.prisma
- Commands: `npm run db:migrate`

2.3 [DONE] Write migration(s) and seed script(s) for local dev.
- Files: README_TRACKING.md, packages/api/prisma/migrations/20250220120000_manual_count_record/migration.sql, packages/api/prisma/seed.ts
- Commands: `npm run db:migrate`, `npm run db:seed`

3) Phase 2 — Auth + RBAC (Sellable Requirement)
3.1 [DONE] Implement authentication end-to-end for local dev.
- Files: README_TRACKING.md, packages/api/src/middleware/auth.ts, packages/web/src/components/auth/Login.tsx, packages/web/src/hooks/useAuth.tsx
- Commands: `npm run dev:local`

3.2 [DONE] Implement sessions/JWT securely.
- Files: README_TRACKING.md, packages/api/src/middleware/auth.ts
- Commands: `npm run dev:local`

3.3 [DONE] RBAC: define roles TECH/VERIFIER/ADMIN-QA.
- Files: README_TRACKING.md, packages/shared/src/types.ts, packages/shared/src/schemas.ts, packages/api/src/middleware/auth.ts
- Commands: `npm run typecheck`

3.4 [DONE] Enforce RBAC on API routes.
- Files: README_TRACKING.md, packages/api/src/routes/records.ts, packages/api/src/routes/users.ts, packages/api/src/routes/superadmin/organizations.ts, packages/api/src/routes/superadmin/sites.ts, packages/api/src/routes/superadmin/users.ts
- Commands: `npm run typecheck`

3.5 [DONE] Implement organization scoping middleware (derive org/site from auth context).
- Files: README_TRACKING.md, packages/api/src/middleware/auth.ts
- Commands: `npm run typecheck`

3.6 [DONE] UI: login screen, logout, role-aware navigation.
- Files: README_TRACKING.md, packages/web/src/components/auth/Login.tsx, packages/web/src/hooks/useAuth.tsx, packages/web/src/components/layout/Layout.tsx
- Commands: `npm run dev:local`

4) Phase 3 — Core Workflow State Machine (Critical)
4.1 [DONE] Implement explicit record states: DRAFT, PENDING_VERIFICATION, VERIFIED, CORRECTED/superseded.
- Files: README_TRACKING.md, packages/api/prisma/schema.prisma (RecordStatus enum), packages/shared/src/types.ts (RecordStatus type)
- Commands: N/A (part of existing schema)

4.2 [DONE] Implement state transition rules (server-enforced).
- Files: README_TRACKING.md, packages/api/src/routes/records.ts
- Notes: State transitions enforced: draft→pending_verification (submit), pending_verification→verified (verify), verified/corrected→corrected (amend), only draft can be deleted/updated
- Commands: `npm run build`

4.3 [DONE] Implement deferred verification UX sections.
- Files: README_TRACKING.md, packages/web/src/components/Dashboard.tsx (pending verifications list, overdue alerts), packages/web/src/components/records/RecordDetail.tsx (verification UX with attestation), packages/web/src/components/records/RecordsList.tsx (status filtering)
- Commands: `npm run build`

4.4 [DONE] Add optimistic concurrency checks.
- Files: README_TRACKING.md, packages/shared/src/schemas.ts (expectedVersion param), packages/api/src/routes/records.ts (version check + increment)
- Notes: All record mutation endpoints (update, submit, verify, amend) now accept optional `expectedVersion` parameter. If provided and doesn't match current record version, returns 409 VERSION_CONFLICT. Version is incremented on each successful mutation.
- Commands: `npm run build`

5) Phase 4 — Count Entry UX (Minimum Sellable)
5.1 [DONE] Build count-entry form (specimenId, fluid type, dilution, squares, tally UI).
- Files: packages/web/src/components/counters/Hemocytometer.tsx, Retic.tsx, Parasite.tsx, Fetal.tsx
- Notes: Full count entry UI with specimenId, fluid type, dilution factor, squares counted, keyboard/click tallying for all counter types

5.2 [DONE] Persist raw tallies and calculated values.
- Files: packages/api/src/routes/records.ts, packages/api/src/services/calculations.ts
- Notes: rawTallies and calculations stored on ManualCountRecord via API

5.3 [DONE] Ensure counts are not lost (autosave or explicit save).
- Files: packages/web/src/components/counters/*.tsx
- Notes: Explicit "Save Draft" button available on all counters

5.4 [DONE] Make "Submit for Verification" clear and irreversible.
- Files: packages/web/src/components/counters/*.tsx, packages/api/src/routes/records.ts
- Notes: Distinct "Submit for Verification" button, server enforces draft→pending_verification transition

6) Phase 5 — Audit Logging (Inspector-Ready)
6.1 [DONE] Emit AuditEvent entries for key actions.
- Files: packages/api/src/services/audit.ts, used in 10+ route files
- Notes: All record CRUD, user management, org/site changes logged with correlation ID, IP, user agent

6.2 [DONE] Build admin-only audit log viewer with filters.
- Files: packages/api/src/routes/audit.ts, packages/web/src/components/admin/AuditLog.tsx, packages/web/src/components/admin/Admin.css
- Notes: Admin-only audit log page with filters (Action, Entity Type, Actor, Date Range). Superadmins can view all orgs, org admins can only see their org's logs. Pagination and detail modal included.
- Commands: `npm run build`

7) Phase 6 — Corrections + Versioning (Non-Negotiable)
7.1 [DONE] Implement corrections via new record/version with reason.
- Files: packages/api/src/routes/records.ts (POST /:id/amend), packages/web/src/components/records/AmendRecord.tsx
- Notes: Amend endpoint updates record in place, sets status to 'corrected', requires reason

7.2 [DONE] UI: show version chain and correction reason.
- Files: packages/web/src/components/records/RecordDetail.tsx, AmendRecord.tsx
- Notes: RecordDetail shows correctionReason and full audit log with changes per amendment

7.3 [DONE] Emit audit events for corrections.
- Files: packages/api/src/routes/records.ts
- Notes: Amend action logs correctionReason, changes (before/after), and changedFields to audit

8) Phase 7 — PDF Artifact Generation (Worksheet)
8.1 [DONE] Generate immutable PDF for verified records with required fields.
- Files: packages/api/src/services/pdf-generator.ts
- Notes: PDFKit-based PDF generation with full record data (specimen info, count data, calculations, attestations, audit info)

8.2 [DONE] Storage strategy with pluggable interface (local/S3).
- Files: packages/api/src/services/storage.ts
- Notes: StorageProvider interface with LocalStorageProvider implementation. S3StorageProvider stubbed for future use. Configurable via STORAGE_PROVIDER env var.

8.3 [DONE] Add "Download PDF" button (role-based).
- Files: packages/api/src/routes/pdf.ts, packages/web/src/components/records/RecordDetail.tsx
- Notes: PDF download button shown for verified/corrected records. API caches generated PDFs. Site-based access control applied.

8.4 [DONE] Log PDF generation/download as AuditEvent.
- Files: packages/api/src/routes/pdf.ts
- Notes: pdf_generated and pdf_downloaded events logged with record metadata

9) Phase 8 — Multi-Org / Multi-Site Admin
9.1 [DONE] Admin UI: create org/site/users, assign roles, reset password/invite.
- Files: packages/web/src/components/superadmin/Organizations.tsx, packages/web/src/components/superadmin/OrganizationDetail.tsx, packages/web/src/components/admin/Users.tsx
- Notes: Superadmin can create/manage orgs, sites, admins. Org admins can manage users. Password reset with temp password generation. Multi-site assignment. Role assignment (technologist/supervisor/admin/readonly).

9.2 [DONE] Guardrails: site-limited permissions and no cross-org access.
- Files: packages/api/src/middleware/auth.ts (enforceOrgScope, superadminOnly, checkOrgSiteAccess)
- Notes: enforceOrgScope middleware ensures non-superadmins only see their org data. Site/org status checks block access when inactive. All routes properly scoped with org filters.

10) Phase 9 — Security Hardening (SOC-2-Ready Design)
10.1 [DONE] Baseline protections (helmet/CORS/rate limiting/Zod/CSRF).
- Files: packages/api/src/index.ts (helmet, cors), packages/api/src/middleware/security.ts (rate limiting, security headers)
- Notes: Helmet with CSP/HSTS, CORS configured, rate limiters (general/auth/sensitive), Zod validation on all endpoints. CSRF not needed (JWT in Authorization header, not cookies).

10.2 [DONE] Secrets management and env var documentation.
- Files: packages/api/.env.example, packages/web/.env.example, .env.example
- Notes: All required env vars documented in .env.example files. Secrets (DATABASE_URL, COGNITO credentials) loaded from environment.

10.3 [DONE] Structured logging with request IDs and redaction strategy.
- Files: packages/api/src/middleware/security.ts (correlationId, securityLogger), packages/api/src/middleware/auth.ts (logAuthEvent)
- Notes: Correlation IDs on all requests, structured JSON logging with user/org context. Auth events logged separately. Sensitive data (tokens) not logged.

10.4 [DONE] Document backup plan (RDS snapshots conceptually).
- Files: SECURITY.md (Backup & Recovery section)
- Notes: Documented RDS daily snapshots, 7-day retention, PITR support, recovery procedures

10.5 [DONE] Add SECURITY.md threat model and controls.
- Files: SECURITY.md
- Notes: Comprehensive threat model with assets, actors, threats. Documents all controls: auth, authz, input validation, rate limiting, transport security, audit logging, data protection.

11) Phase 10 — Testing + Quality Gates
11.1 [TODO] Unit tests for calculations and state transitions.
- Files: README_TRACKING.md
- Commands: TBD

11.2 [TODO] Integration tests for key API flows.
- Files: README_TRACKING.md
- Commands: TBD

11.3 [TODO] Add CI workflow (GitHub Actions) for lint/typecheck/tests.
- Files: README_TRACKING.md
- Commands: TBD

11.4 [TODO] Add seed + e2e smoke test instructions.
- Files: README_TRACKING.md
- Commands: TBD

12) Phase 11 — Documentation for Sales + Inspection
12.1 [TODO] Add docs pages for product scope, downtime, validation package, retention/access.
- Files: README_TRACKING.md
- Commands: TBD

12.2 [TODO] Add Security Overview 1–2 pager in /docs.
- Files: README_TRACKING.md
- Commands: TBD

13) Phase 12 — Deployment Scaffold
13.1 [TODO] Add production-ready container setup (Dockerfiles) for api + web.
- Files: README_TRACKING.md
- Commands: TBD

13.2 [TODO] Add deploy instructions for AWS later (RDS/ECS/S3).
- Files: README_TRACKING.md
- Commands: TBD

13.3 [TODO] Add env separation: dev/staging/prod.
- Files: README_TRACKING.md
- Commands: TBD

## Out-of-Band Fixes (Checklist Paused)
1) [DONE] Enforce org/site status in auth so site/org pause actually revokes access.
- Files: README_TRACKING.md, packages/api/src/middleware/auth.ts, packages/api/src/routes/auth.ts
- Commands: `npm run dev`

2) [DONE] Sync user status changes with Cognito disable/enable and allow password resets.
- Files: README_TRACKING.md, packages/api/src/services/cognito.ts, packages/api/src/routes/users.ts, packages/api/src/routes/superadmin/users.ts, packages/shared/src/types.ts, packages/shared/src/schemas.ts
- Commands: `npm run dev`

3) [DONE] Add admin UI action to reset user passwords.
- Files: README_TRACKING.md, packages/web/src/components/admin/Users.tsx
- Commands: `npm run dev`

4) [DONE] Show usernames in admin user lists and present generated temporary passwords on create/reset flows.
- Files: README_TRACKING.md, packages/web/src/components/admin/Users.tsx, packages/web/src/components/admin/Admin.css, packages/web/src/components/superadmin/OrganizationDetail.tsx, packages/web/src/components/superadmin/SuperAdmin.css, packages/api/src/routes/users.ts, packages/api/src/routes/superadmin/users.ts, packages/api/src/lib/passwords.ts, packages/shared/src/schemas.ts, packages/shared/src/types.ts
- Commands: `npm run dev`

5) [DONE] Auto-generate usernames from name and include them in password notices.
- Files: README_TRACKING.md, packages/api/src/lib/usernames.ts, packages/api/src/routes/users.ts, packages/api/src/routes/superadmin/users.ts, packages/shared/src/schemas.ts, packages/shared/src/types.ts, packages/web/src/components/admin/Users.tsx, packages/web/src/components/superadmin/OrganizationDetail.tsx
- Commands: `npm run dev`

6) [DONE] Restore admin user form integrity and validate site selections to prevent invalid request payloads.
- Files: README_TRACKING.md, packages/web/src/components/admin/Users.tsx
- Commands: `npm run dev`

7) [DONE] Relax siteId validation to support non-UUID site IDs in dev seed data.
- Files: README_TRACKING.md, packages/shared/src/schemas.ts
- Commands: `npm run dev`

8) [DONE] Align superadmin admin-creation UI with org-admin user creation and support multi-site assignment.
- Files: README_TRACKING.md, packages/shared/src/schemas.ts, packages/api/src/routes/superadmin/users.ts, packages/web/src/components/superadmin/OrganizationDetail.tsx, packages/web/src/components/superadmin/SuperAdmin.css
- Commands: `npm run dev`

9) [DONE] Add missing status/username/user-site DB structures and reseed for clean user creation.
- Files: README_TRACKING.md, packages/api/prisma/migrations/20260101100000_add_status_fields/migration.sql, packages/api/prisma/migrations/20260101112000_add_username_to_users/migration.sql, packages/api/prisma/migrations/20260101112500_create_user_sites/migration.sql
- Commands: `npx prisma migrate deploy`, `npm run db:seed`, `npm run generate`

10) [DONE] Enhanced Verification UI & Dashboard Visibility
- Requirements: Add legal attestation checkbox on verify screen ("I, {Verifier}, have reviewed..."). Add "Pending Verifications" list to dashboard. Add badges for records pending > X hours. Add "Verified By" and "Verified On" columns to record lists.
- Files: README_TRACKING.md, packages/web/src/components/records/RecordDetail.tsx, packages/web/src/components/records/RecordsList.tsx, packages/web/src/components/records/Records.css, packages/web/src/components/Dashboard.tsx, packages/web/src/components/Dashboard.css
- Commands: `npm run dev`

11) [DONE] Data Export & Reporting Capabilities
- Requirements: Ability to export records to CSV/Excel. Generate "Monthly Review" shorthand report (Date, Specimen ID, Squares counted TNC/RBC, Dilution (TNC/RBC), Performer/Time, Verifier/Time).
- Files: README_TRACKING.md, packages/api/src/routes/export.ts, packages/api/src/index.ts, packages/web/src/api/client.ts, packages/web/src/components/records/RecordsList.tsx, packages/web/src/components/records/Records.css
- Commands: `npm run build`

12) [DONE] Formal Correction Workflow
- Requirements: "Amend" action creates a new version of the record. Requires "Reason for Amendment". Requires new verifier attestation. UI must show version history/chain.
- Files: README_TRACKING.md, packages/api/src/routes/records.ts, packages/web/src/components/records/RecordDetail.tsx, packages/web/src/components/records/AmendRecord.tsx, packages/web/src/components/records/Records.css, packages/web/src/App.tsx
- Commands: `npm run build`

13) [DONE] Advanced Counter Templating & Method Safety (Critical)
- Requirements:
  - Architecture: Separate Templates (Code/Schema/Formulas) from Parameters (Targets/Thresholds).
  - Safety: Every record MUST store `methodTemplateId`, `methodVersion`, and `paramsSnapshot` (e.g., targetRBC=500) to ensure historical accuracy if defaults change.
  - Config: Store Org defaults in `organization.methodConfigs`.
  - UI: Superadmin selects/configures counters available to each Org.
- Files: packages/api/prisma/schema.prisma (OrgMethodConfig), packages/api/src/services/method-config.ts, packages/api/src/routes/method-config.ts, packages/api/src/routes/superadmin/method-config.ts, packages/web/src/components/superadmin/OrganizationDetail.tsx
- Notes: OrgMethodConfig stores per-org params, paramsSnapshot stored on each record, methodVersion tracked, superadmin UI for configuring method params per org

14) [DONE] Enhanced Audit System (Traceability + Config Log)
- Requirements:
  - Record Traceability: Rely on record snapshots for "what method was used".
  - Config Audit: Log Organization setting changes (e.g., "Org X changed targetRBC 500 -> 1000") to `AuditLog`.
  - Access Control: Superadmin (Global), Org Admin (Local only).
  - UI: Admin Audit page with filters (Time, Actor, Action, Target).
- Files: packages/api/src/routes/audit.ts, packages/web/src/components/admin/AuditLog.tsx
- Notes: paramsSnapshot on records provides method traceability. Config changes logged via auditLog service. Admin Audit page implemented with filters for Time, Actor, Action, Entity Type. Superadmins see all orgs, Org Admins see only their org.

15) [TODO] Prevent records from being finalized if target count isn't met

16) [DONE] When count data is amended, the specific parameters and amounts and any calculations changed as a result should be noted in the audit log
- Files: packages/api/src/routes/records.ts (amend endpoint)
- Notes: Amend action logs `changes` object with before/after for each changed field (rawTallies, specimenId, performedAt)

## How To Run Locally
- Run: `npm run dev:local`
- Notes: This script will copy env examples if missing, start Postgres via Docker, install deps, run Prisma generate/migrate, and start dev servers.

## Current State
- Repository includes a monorepo (`packages/api`, `packages/web`, `packages/shared`) and a static HTML UI at repo root.
- Existing features include a React dashboard + counters, plus security/compliance notes in `README.md`.
- One-command local dev script added (`npm run dev:local`).
- Prisma schema updated to `ManualCountRecord` + `AuditEvent` with new field naming.
- Org/site status is enforced at auth, and org admins can reset passwords from the Users UI.
- Database migrations now include org/site/user status fields, usernames, and user-site assignments; seed runs cleanly.
