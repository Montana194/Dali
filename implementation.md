# DALITrack integration handoff: DALIAudit

**Project:** DALITrack: An Integrated Grocery Operations and Customer Service Management System Using the XianFire Framework  
**Module:** DALIAudit: Store Sanitation and Compliance Inspection Management System  
**Reviewed:** 13 November 2026  
**Repository/version:** `https://github.com/Montana194/Dali.git` (branch: `main`)  
**Contact/team:** Montana194 / DALIAudit Team  

---

## 1. Current technology and startup

| Area | Implementation |
|---|---|
| **Framework & Runtime** | Node.js (v20+ ES modules), Express 4.19.2, XianFire architectural layout |
| **View Engine** | Handlebars (`hbs` 4.2.0) rendering custom `.xian` templates with Tailwind CSS and FontAwesome 6.5.1 |
| **Database** | MySQL (dialect `mysql2` 3.9.2) managed via Sequelize ORM 6.37.3; database name `daliaudit_db` |
| **Authentication & Sessions** | `express-session` with memory store / cookie-session (`connect-flash` for flash alerts, `bcryptjs` 3.0.3 password hashing) |
| **File Uploads** | `multer` 2.0.2 storing uploaded audit evidence photos to `/public/uploads` |
| **Default HTTP Port** | `3000` (configurable via `process.env.PORT`) |
| **Startup Commands** | `npm start` (`node index.js`), `npm run dev` (`nodemon index.js`), `node seed.js` (demo data seeder) |
| **Environment Variables** | `PORT` (optional, defaults to 3000), `XIAN_ELECTRON` (internal framework flag). Note: Database host, user, and credentials currently default directly in `models/db.js` (`localhost:3306`, user: `root`, password: ``, database: `daliaudit_db`). Configuration through `.env` is proposed for external integration. |

---

## 2. Current features and roles

### 2.1 Role-Based Access Control (RBAC)

DALIAudit defines three functional user roles plus registration states:

| Role Code | User-Facing Label | Scope & Permissions |
|---|---|---|
| `admin` | **Administrator** | Full system governance. Can view/manage all store branches, manage users and roles, approve or reject self-registered user accounts, configure checklist criteria standards, schedule audits, generate official compliance reports, and access all analytics. |
| `inspector` (alias `staff`) | **Sanitation Inspector** | Field inspection portal. Can view assigned scheduled audits across any branch, launch real-time checklist audits with photo uploads, calculate live scores, log noncompliance findings, and verify submitted corrective actions from stores. |
| `store_rep` (alias `visitors`) | **Store Representative** | Branch portal. Scoped to an assigned physical DALI grocery branch (or selects branch via the branch selector). Can review inspection findings, monitor remediation deadlines, and submit corrective action remediation plans with photo proof. |
| `pending` | **Awaiting Approval** | Newly self-registered accounts are set to `status: "PENDING"` and `role: "pending"`. They cannot log in until an Administrator reviews, approves, and assigns their system role in `/admin/users`. |

### 2.2 Key User Pages and Capabilities

| Page / Route | Intended Users | Primary Capabilities |
|---|---|---|
| `/` | Public / All | Public storefront landing page detailing quality pillars, role workspaces, and entry links. |
| `/account/login` | Unauthenticated | Secure credentials authentication (email & password) with CSRF protection and role redirection. |
| `/register` | Unauthenticated | Self-registration requesting name, email, password, and phone. Creates `PENDING` account for admin confirmation. |
| `/admin` | Admin | High-level governance dashboard showing total branches, field audits, active users, pending approvals, and quick dispatch links. |
| `/admin/users` | Admin | User management dashboard: lists pending registrations with 1-click **Confirm & Assign** (role & optional branch) or **Reject**, plus active users with protected admin badges. |
| `/admin/stores` | Admin | Store branch registry: displays store codes, locations, branch managers, and overall compliance ratings. Modal to add branches. |
| `/admin/checklists` | Admin | Checklist engine: displays inspection standards across categories, weights (pts), and criticalities (Minor, Major, Critical). Modal to create new criteria. |
| `/admin/schedule` | Admin | Inspection scheduler: dispatches audits by linking a target branch, assigned inspector, audit date, and specific notes. |
| `/admin/inspections` | Admin | Global audit log table of all scheduled, in-progress, and completed inspections with report generation triggers. |
| `/inspector` | Inspector | Inspector workspace showing assigned audits, status progression, quick-launch audit buttons, and pending store fix reviews. |
| `/inspector/conduct/:id` | Inspector | Interactive live checklist execution: radio evaluation (`Compliant`, `Not Compliant`, `N/A`), automatic live score calculation, violation drawers with severity classification, and up to 5 evidence photo uploads. |
| `/inspector/verify/:id` | Inspector | Reinspection verification: reviews store's submitted remediation notes and photo proof; decision to **Approve Fix** (closes finding) or **Return to Store (Needs Rework)**. |
| `/store` | Store Rep | Branch compliance portal: assigned branch selector, compliance health metrics, open action items, due dates, and audit history. |
| `/store/actions/:id` | Store Rep | Corrective action remediation submission: action plan text, preventive policy, and photo proof upload. |
| `/reports` | All Roles | Summary table of published and draft store compliance reports. |
| `/reports/view/:id` | All Roles | Full official printable compliance certificate with category breakdowns, checklist logs, photo evidence gallery, and verified digital signature blocks. |

---

## 3. Workflows

### 3.1 Inspection Audit Lifecycle

```text
[Scheduled] ──(Inspector launches form)──> [InProgress]
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼ (All Compliant / Score >= 80%)                              ▼ (Any Finding / Violations)
            [Compliant]                                                  [Noncompliant]
                 │                                                             │
                 ▼                                                             ▼
   Auto-creates ComplianceReport                                  Auto-creates Findings & CorrectiveActions
        (Status: Published)                                              (Status: ActionPending)
                 │                                                             │
                 │                                                (Store Rep submits action plan + proof)
                 │                                                             │
                 │                                                             ▼
                 │                                                    [ActionSubmitted]
                 │                                                             │
                 │                                                (Inspector reviews verification)
                 │                                                             │
                 │                                        ┌────────────────────┴────────────────────┐
                 │                                        ▼ (Approved)                              ▼ (Rejected)
                 │                               [Verified / Closed]                       [ActionPending / Re-work]
                 │                                        │
                 └───────────────────<────────────────────┘ (When all findings verified)
                                     ▼
                                  [Closed]
                       Report status -> Published
```

| Current Status | Trigger / Action | Resulting Status | Actor |
|---|---|---|---|
| `Scheduled` | Admin dispatches audit via `/admin/schedule` | `Scheduled` | Admin |
| `Scheduled` | Inspector opens `/inspector/conduct/:id` | `InProgress` | Inspector |
| `InProgress` | Inspector submits checklist with 0 violations | `Compliant` | Inspector |
| `InProgress` | Inspector submits checklist with >= 1 noncompliant items | `Noncompliant` | Inspector |
| `Noncompliant` | Findings created; assigned to Store Rep | `ActionPending` | System |
| `ActionPending` | Store Rep submits remediation plan + photos via `/store/actions/:id` | `ActionSubmitted` (Finding: `Submitted`) | Store Rep |
| `ActionSubmitted` | Inspector approves remediation via `/inspector/verify/:id` | Finding: `Closed`, Action: `Verified` | Inspector |
| `ActionSubmitted` | Inspector rejects remediation via `/inspector/verify/:id` | Finding: `Open`, Action: `Rejected` | Inspector |
| All Findings `Closed` | Last remaining action item verified | Inspection: `Closed`, Store: `Compliant`, Report: `Published` | System |

---

## 4. Data ownership and schema

All primary keys are auto-incrementing integers (`id`) managed by MySQL `daliaudit_db`. Model definitions reside in [`Project/models/index.js`](file:///c:/Users/piama/OneDrive/Desktop/Dali/Project/models/index.js).

### 4.1 Entities Owned by DALIAudit

```text
┌─────────────────┐       1:N       ┌─────────────────────┐       1:N       ┌──────────────────────┐
│      Store      │ ───────────────< │     Inspection      │ ───────────────< │  InspectionResponse  │
└─────────────────┘                 └─────────────────────┘                 └──────────────────────┘
         │                                     │ 1:N                                    │
         │ 1:N                                 ▼                                        ▼
         │                          ┌─────────────────────┐ 1:1             ┌──────────────────────┐
         ├────────────────────────< │       Finding       │ ──────────────> │    ChecklistItem     │
         │                          └─────────────────────┘                 └──────────────────────┘
         │                                     │ 1:1
         │                                     ▼
         │ 1:N                      ┌─────────────────────┐
         └────────────────────────< │  CorrectiveAction   │
                                    └─────────────────────┘
                                               │ 1:N
                                               ▼
                                    ┌─────────────────────┐
                                    │      Evidence       │ (Photos)
                                    └─────────────────────┘
```

| Entity | Primary Key | Key Fields & Types | Relationships |
|---|---|---|---|
| **User** | `id` (Int) | `fullName`, `email` (Unique), `password`, `role` (`admin`/`inspector`/`store_rep`/`pending`), `status` (`APPROVED`/`PENDING`), `storeId` (Nullable), `phone`, `badgeNumber` | BelongsTo `Store` |
| **Store** | `id` (Int) | `code` (Unique String, e.g. `DALI-MNL-001`), `name`, `address`, `city`, `region`, `managerName`, `contactPhone`, `complianceStatus`, `overallRating` (Int 0-100), `lastInspectionDate` | HasMany `Inspection`, HasMany `User`, HasMany `CorrectiveAction` |
| **ChecklistItem** | `id` (Int) | `category` (String), `requirement` (String), `description` (Text), `weight` (Int, 1-25), `criticality` (`Minor`/`Major`/`Critical`), `isActive` (Boolean) | HasMany `InspectionResponse`, HasMany `Finding` |
| **Inspection** | `id` (Int) | `inspectionCode` (Unique String, e.g. `INS-2026-001`), `storeId`, `inspectorId`, `scheduledDate`, `inspectionDate`, `status` (Enum), `score` (Float 0-100), `totalPoints`, `earnedPoints`, `passed` (Bool), `notes`, `findingsCount`, `completedAt` | BelongsTo `Store`, BelongsTo `User` (as inspector), HasMany `InspectionResponse`, HasMany `Finding`, HasMany `CorrectiveAction`, HasMany `Evidence`, HasOne `ComplianceReport` |
| **InspectionResponse** | `id` (Int) | `inspectionId`, `itemId`, `result` (`Compliant`/`Noncompliant`/`N/A`), `remarks` (Text), `scoreAwarded` (Int) | BelongsTo `Inspection`, BelongsTo `ChecklistItem` |
| **Finding** | `id` (Int) | `inspectionId`, `responseId`, `itemId`, `severity` (`Minor`/`Major`/`Critical`), `title` (String), `description` (Text), `deadline` (Date), `status` (`Open`/`In Remediation`/`Submitted`/`Verified`/`Closed`) | BelongsTo `Inspection`, BelongsTo `ChecklistItem`, HasOne `CorrectiveAction`, HasMany `Evidence` |
| **CorrectiveAction** | `id` (Int) | `findingId`, `inspectionId`, `storeId`, `assignedToRepId`, `dueDate`, `actionPlan` (Text), `remediationNotes` (Text), `status` (`Pending`/`Submitted`/`Under Review`/`Verified`/`Rejected`), `submittedAt`, `verifiedAt`, `verifiedBy`, `inspectorFeedback` | BelongsTo `Finding`, BelongsTo `Inspection`, BelongsTo `Store`, BelongsTo `User` (representative), HasMany `Evidence` |
| **Evidence** | `id` (Int) | `inspectionId`, `responseId`, `findingId`, `actionId`, `filePath` (String), `fileName`, `fileType`, `caption`, `stage` (`Inspection`/`Remediation`/`Reinspection`), `uploadedBy` | BelongsTo `Inspection`, BelongsTo `Finding`, BelongsTo `CorrectiveAction`, BelongsTo `User` |
| **ComplianceReport** | `id` (Int) | `reportCode` (Unique String, e.g. `REP-2026-001`), `inspectionId`, `storeId`, `inspectorId`, `generatedAt`, `summary` (Text), `finalScore` (Float), `grade` (String), `status` (`Draft`/`Published`/`Archived`), `recommendations` (Text) | BelongsTo `Inspection`, BelongsTo `Store`, BelongsTo `User` (inspector) |

### 4.2 Distinguishing Local vs. Shared Identifiers

- **Local IDs:** MySQL integer auto-increment keys (`Store.id`, `User.id`, `Inspection.id`, `ChecklistItem.id`).
- **Natural Business Keys:**
  - Store: `code` (e.g. `DALI-MNL-001`) — recommended anchor for cross-module branch matching.
  - Inspection: `inspectionCode` (e.g. `INS-2026-001`).
  - Report: `reportCode` (e.g. `REP-2026-001`).
  - Inspector: `badgeNumber` (e.g. `INS-001`).

---

## 5. Implemented API contract

Currently, DALIAudit operates as a server-rendered web application with session cookies (`connect.sid`) and form-based CSRF protection (`_csrf` token stored in session). All writes require an authenticated session and valid token.

### 5.1 Route Inventory

| Method | Path | Authentication / Role | Parameters & Body | Response / Effect |
|---|---|---|---|---|
| `GET` | `/` | Public | None | 200 HTML Home Page |
| `GET` | `/account/login` | Public | None | 200 HTML Login Form |
| `POST` | `/login` | Public | Body: `email`, `password` | 302 Redirect (Sets session cookie; verifies approval status) |
| `GET` | `/register` | Public | None | 200 HTML Register Form |
| `POST` | `/register` | Public | Body: `name`, `email`, `password`, `phone` | 302 Redirect to `/account/login` (Account created with `PENDING`) |
| `POST` | `/logout` | Authenticated | Body: `_csrf` | 302 Redirect to `/` (Destroys session) |
| `GET` | `/admin` | `admin` | None | 200 HTML Admin Dashboard |
| `GET` | `/admin/users` | `admin` | None | 200 HTML User Management & Approvals |
| `POST` | `/admin/users` | `admin` | Body: `_csrf`, `name`, `email`, `password`, `role`, `storeId`, `phone`, `badgeNumber` | 302 Redirect (Creates active user) |
| `POST` | `/admin/users/:userId/approve` | `admin` | Body: `_csrf`, `role`, `storeId` | 302 Redirect (Sets `status: 'APPROVED'`, assigns role & store) |
| `POST` | `/admin/users/:userId/reject` | `admin` | Body: `_csrf` | 302 Redirect (Deletes pending registration) |
| `GET` | `/admin/users/:userId/edit` | `admin` | Param: `userId` | 200 HTML Edit User Form |
| `POST` | `/admin/users/:userId/edit` | `admin` | Body: `_csrf`, fields | 302 Redirect (Updates account details) |
| `POST` | `/admin/users/:userId/delete` | `admin` | Body: `_csrf` | 302 Redirect (Deletes user) |
| `GET` | `/admin/stores` | `admin` | None | 200 HTML Store Registry |
| `POST` | `/admin/stores` | `admin` | Body: `_csrf`, `code`, `name`, `address`, `city`, `region`, `managerName`, `contactPhone` | 302 Redirect (Creates Store) |
| `GET` | `/admin/checklists` | `admin` | None | 200 HTML Checklist Items Manager |
| `POST` | `/admin/checklists` | `admin` | Body: `_csrf`, `category`, `requirement`, `description`, `weight`, `criticality` | 302 Redirect (Creates ChecklistItem) |
| `GET` | `/admin/schedule` | `admin` | None | 200 HTML Audit Scheduling Dispatcher |
| `POST` | `/admin/schedule` | `admin` | Body: `_csrf`, `storeId`, `inspectorId`, `scheduledDate`, `notes` | 302 Redirect (Creates scheduled Inspection) |
| `GET` | `/admin/inspections` | `admin` | None | 200 HTML All Inspections Table |
| `POST` | `/admin/reports/generate/:inspectionId` | `admin` | Param: `inspectionId`, Body: `_csrf` | 302 Redirect to `/reports/view/:id` (Generates Report) |
| `GET` | `/inspector` | `inspector` | None | 200 HTML Inspector Dashboard |
| `GET` | `/inspector/conduct/:id` | `inspector` | Param: `id` | 200 HTML Checklist Inspection Execution Form |
| `POST` | `/inspector/conduct/:id` | `inspector` | Multipart: `result_<itemId>`, `remarks_<itemId>`, `finding_title_<itemId>`, `finding_severity_<itemId>`, `evidencePhotos` (files up to 5), `evidenceCaption` | 302 Redirect to `/inspector` (Evaluates score, creates findings, attaches photos) |
| `GET` | `/inspector/verify/:id` | `inspector` | Param: `id` (actionId) | 200 HTML Review Store Remediation View |
| `POST` | `/inspector/verify/:id` | `inspector` | Body: `_csrf`, `decision` (`APPROVE`/`REJECT`), `feedback` | 302 Redirect to `/inspector` (Closes finding or re-opens action) |
| `GET` | `/store` | `store_rep` | None | 200 HTML Store Representative Portal |
| `POST` | `/store/select-branch` | `store_rep` | Body: `_csrf`, `storeId` | 302 Redirect to `/store` (Updates active branch) |
| `GET` | `/store/actions/:id` | `store_rep` | Param: `id` (actionId) | 200 HTML Corrective Action Remediation Form |
| `POST` | `/store/actions/:id` | `store_rep` | Multipart: `actionPlan`, `remediationNotes`, `remediationPhotos` (files up to 5), `caption` | 302 Redirect to `/store` (Submits proof, status -> `Submitted`) |
| `GET` | `/reports` | Authenticated | None | 200 HTML Compliance Reports List |
| `GET` | `/reports/view/:id` | Authenticated | Param: `id` (reportId) | 200 HTML Official Printable Inspection Report |

---

## 6. Data needed from other modules

| Producer Module | Required Data | Identifiers | Frequency / Trigger | Purpose in DALIAudit |
|---|---|---|---|---|
| **DALIStock / Core** | Store Branch Directory | Branch Code (e.g. `DALI-MNL-001`), Branch Name, City, Region | Periodic sync or initial setup | Replaces manual store registry with centralized branch definitions. |
| **Core Identity** | Common Personnel Accounts | User email, full name, role, employee badge | On login / session sync | Centralizes login and authentication across DALITrack. |
| **DALICheck** | Product Quality & Expiration Noncompliance Flags | Store code, SKU, batch number, inspection finding reference | Event-based (when quality check fails) | Corroborates store sanitation audits with product shelf quality issues. |
| **DALIResolve** | Customer Sanitation / Hygiene Complaints | Store code, incident date, complaint category, reference ID | Event-based (customer submits pest/cleanliness complaint) | Alerts auditor to schedule targeted branch audit or prioritize specific checklist items (e.g. Pest Exclusion). |

---

## 7. Data this module can provide

| Consumer Module | Provided Data | Fields & Trigger | Access Restrictions |
|---|---|---|---|
| **DALIInsight** | Store Sanitation Ratings & Compliance Metrics | `storeCode`, `inspectionDate`, `overallRating`, `finalScore`, `grade`, `findingsCount`, `status` (Trigger: audit completion) | Read-only reporting feed. Omits passwords and internal session tokens. |
| **DALIResolve** | Branch Inspection Status & Corrective Action Verification | `storeCode`, `inspectionCode`, `complianceStatus`, `findingTitle`, `remediationStatus`, `verifiedAt` (Trigger: complaint inquiry) | Scoped to branch and relevant date window. |
| **DALICheck** | Sanitation & Cold Chain Chiller Deficiencies | `storeCode`, chiller temperature logs, pest findings, audit date | Scoped to store cold storage and facility conditions. |
| **DALIStock** | Store Cleanliness / Quarantine Notice | `storeCode`, notification of severe infestation or cold-chain failure requiring stock hold | Authorized inspection alert. |

---

## 8. Proposed integration work (Machine-to-Machine API)

*The following endpoints and authentication mechanisms are proposed for DALITrack cross-module interoperability and are not yet implemented in the current repository:*

### 8.1 Proposed Service Endpoints (`/api/integration/v1`)

```text
GET  /api/integration/v1/inspections?storeCode=DALI-MNL-001&status=Closed
GET  /api/integration/v1/reports/:reportCode
POST /api/integration/v1/complaints/referral
GET  /api/integration/v1/health
```

#### Proposed `GET /api/integration/v1/inspections` Response Example
```json
{
  "schemaVersion": 1,
  "data": [
    {
      "inspectionCode": "INS-2026-001",
      "storeCode": "DALI-MNL-001",
      "inspectorBadge": "INS-001",
      "inspectionDate": "2026-11-12T06:00:00Z",
      "status": "Noncompliant",
      "score": 78.0,
      "passed": false,
      "findingsCount": 1,
      "findings": [
        {
          "title": "Chiller Temperature Deviation & Inadequate Sanitation Log",
          "severity": "Major",
          "status": "Open",
          "deadline": "2026-11-15T06:00:00Z"
        }
      ]
    }
  ]
}
```

#### Proposed `POST /api/integration/v1/complaints/referral` Payload Example
```json
{
  "schemaVersion": 1,
  "eventId": "complaint-ref-9021",
  "storeCode": "DALI-MNL-001",
  "complaintCategory": "PEST_CONTROL",
  "complaintReference": "RES-2026-882",
  "description": "Customer reported rodent droppings near dry grain aisle.",
  "occurredAt": "2026-11-13T02:30:00Z"
}
```

---

## 9. Tests and limitations

- **Automated Tests:** Currently, tests rely on development integration scripts (`seed.js`) and live manual verification against MySQL. Automated test scripts (`npm test`) are not yet registered in `package.json`.
- **Known Limitations:**
  - Database credentials are hardcoded in `models/db.js` (`localhost:3306`, root, empty password) rather than loaded from environment variables (`.env`).
  - Session storage defaults to in-memory `MemoryStore` (production deployment requires persistent MySQL session store).
  - Image files uploaded during inspections are saved locally to `public/uploads/` (multi-server EC2 setup requires shared S3 bucket or volume).

---

## 10. Local and EC2 connectivity

### Local Multi-Port Layout

| Application | Local Port | Cookie Name |
|---|---|---|
| **DALIStock** | `http://127.0.0.1:3000` | `dalistock.sid` |
| **DALIResolve** | `http://127.0.0.1:3001` | `daliresolve.sid` |
| **DALICheck** | `http://127.0.0.1:3002` | `dalicheck.sid` |
| **DALIAudit** | `http://127.0.0.1:3003` | `daliaudit.sid` (Proposed: configure in `index.js`) |
| **DALIInsight** | `http://127.0.0.1:3004` | `daliinsight.sid` |

### Proposed AWS EC2 Reverse Proxy Subdomain
```text
https://audit.<your-domain> ──> Reverse Proxy (Nginx) ──> localhost:3003
```

---

## 11. Decisions needed from the other teams

1. **Store & Branch Identifier Standard:** Confirm that `code` (e.g. `DALI-MNL-001`) is the universal canonical key across DALIStock, DALICheck, and DALIAudit.
2. **Central Single Sign-On (SSO):** Decide whether common credentials (JWT / OAuth2 / Shared Identity provider) will be introduced or if each app maintains separate session cookies.
3. **Complaint Referral Workflow (DALIResolve &rarr; DALIAudit):** Agree on whether customer hygiene complaints automatically schedule an audit or create an alert badge on the Admin dashboard.
4. **Quality Quarantine Workflow (DALICheck &rarr; DALIAudit):** Define whether failed product batches in DALICheck trigger facility sanitation checklists.
5. **DALIInsight Reporting Data Contract:** Finalize JSON schema and polling interval for feeding store compliance scores into the executive dashboard.
