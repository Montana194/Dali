# DALIAudit ↔ DALI POS Integration Result & Connection Guide

**Timestamp:** 2026-11-23T17:50:00+08:00  
**Service 1:** DALIAudit (Sanitation & Food Safety Compliance Audit System)  
**Service 2:** DALI POS (Point of Sale, Inventory, and Sales Transaction System)  

---

## 1. Network & Port Allocation

| Service | Port | Base URL | Primary Role |
| :--- | :--- | :--- | :--- |
| **DALI POS** | `3000` | `http://127.0.0.1:3000` | Exposes read-only products, inventory, and sales via HTTP API |
| **DALIAudit** | `3003` | `http://127.0.0.1:3003` | Inspection management, checklist engine, and store compliance API |

> **Local Isolation**: Each service runs independently with its own database. Neither system connects directly to the peer's MySQL instance. Session cookies in DALIAudit are isolated under `daliaudit.sid` to prevent localhost cookie collisions.

---

## 2. Generated 32-Byte Cryptographic Secrets

As required by Step 3 of the handout, two discrete, 32-byte base64url random tokens have been generated:

| Direction | Token Environment Variable | Secret Value |
| :--- | :--- | :--- |
| **DALIAudit → DALI POS** | `DALI_POS_INTEGRATION_TOKEN` | `puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q` |
| **DALI POS → DALIAudit** | `DALIAUDIT_API_TOKEN` | `oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc` |

---

## 3. Environment Configuration Files

### A. DALI POS `.env` (Copy and paste into DALI POS project root)
```dotenv
PORT=3000
DALI_POS_INTEGRATION_TOKEN=puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q
DALIAUDIT_BASE_URL=http://127.0.0.1:3003
DALIAUDIT_API_TOKEN=oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc
```

### B. DALIAudit `.env` (Already configured in `Project/.env`)
```dotenv
PORT=3003
HOST=0.0.0.0
DALI_POS_BASE_URL=http://127.0.0.1:3000
DALI_POS_INTEGRATION_TOKEN=puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q
DALIAUDIT_API_TOKEN=oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc
INTEGRATION_API_KEY=oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc
```

---

## 4. Implementation in DALIAudit

The following components were implemented in DALIAudit to support the handout specifications:

### 1. DALI POS Client (`integrations/dalipos-client.mjs`)
Implemented class `DaliPosClient` providing authenticated, read-only methods:
- `health()`: calls `GET /api/integration/v1/health`
- `products({ page, limit })`: calls `GET /api/integration/v1/products`
- `inventory({ page, limit })`: calls `GET /api/integration/v1/inventory`
- `sales({ page, limit, from, to })`: calls `GET /api/integration/v1/sales`
- Includes bounded 10-second timeouts, retry logic, and error parsing for `{ error: { code, message } }`.

### 2. Standalone Smoke Test (`integrations/pos-smoke-test.mjs`)
A verification script to test DALI POS connectivity from DALIAudit:
```powershell
node --env-file=.env integrations/pos-smoke-test.mjs
```

### 3. POS Service Layer (`services/posService.js`)
Handles in-memory caching (60s TTL), catalog/stock loaders, and graceful error recovery during POS outages.

### 4. Admin UI Diagnostics (`views/admin/integrations.xian`)
Added a dedicated **DALI POS Server** status panel and a **Test DALI POS Connection** button (`POST /admin/integrations/test-pos`).

### 5. Inbound Route & Token Compatibility (`routes/api.js` & `index.js`)
Updated authentication to accept `Authorization: Bearer <DALIAUDIT_API_TOKEN>` and mapped inbound paths at both `/api/...` and `/api/integration/v1/...`.

---

## 5. DALI POS Calling DALIAudit (Published API Contract)

Using the POS outbound helper `services/daliAuditClient.js`, DALI POS can query DALIAudit endpoints:

```javascript
import { requestDaliAudit } from "./services/daliAuditClient.js";

// Example: Check DALIAudit Readiness
const health = await requestDaliAudit("/api/health", { method: "GET" });

// Example: Check Branch Sanitation Compliance
const stores = await requestDaliAudit("/api/stores", { method: "GET" });

// Example: Fetch Inspection History
const audits = await requestDaliAudit("/api/inspections", { method: "GET" });
```

### Documented Routes on DALIAudit (`http://127.0.0.1:3003`):

| Method & Route | Auth Required | Response Description |
| :--- | :--- | :--- |
| `GET /api/health` | `Bearer <DALIAUDIT_API_TOKEN>` | `{"ok": true, "service": "DALIAudit", "status": "ready"}` |
| `GET /api/stores` | `Bearer <DALIAUDIT_API_TOKEN>` | Branch registry with overall compliance score and rating |
| `GET /api/inspections` | `Bearer <DALIAUDIT_API_TOKEN>` | Comprehensive inspection history and violations |
| `GET /api/reports/:reportCode` | `Bearer <DALIAUDIT_API_TOKEN>` | Official signed compliance certificate and breakdown |
| `POST /api/complaints/referral` | `Bearer <DALIAUDIT_API_TOKEN>` | Referral intake for customer hygiene issues |

---

## 6. How to Run and Verify

### Step 1: Start DALI POS on Port 3000
In the DALI POS project terminal:
```powershell
npm start
```
*(Ensure DALI POS is running at `http://127.0.0.1:3000`)*

### Step 2: Start DALIAudit on Port 3003
In the DALIAudit project terminal:
```powershell
cd Project
node index.js
```
*(DALIAudit will start at `http://0.0.0.0:3003`)*

### Step 3: Verify DALIAudit Calling DALI POS
Run the smoke test from DALIAudit:
```powershell
node --env-file=.env integrations/pos-smoke-test.mjs
```
Or run the PowerShell command from the handout:
```powershell
$token = "puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q"
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/integration/v1/health" `
  -Headers @{ Authorization = "Bearer $token"; Accept = "application/json" }
```

### Step 4: Verify DALI POS Calling DALIAudit
From PowerShell:
```powershell
$auditToken = "oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc"
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3003/api/health" `
  -Headers @{ Authorization = "Bearer $auditToken"; Accept = "application/json" }
```
Expected output:
```json
{
  "ok": true,
  "service": "DALIAudit",
  "schemaVersion": 1,
  "status": "ready"
}
```

### Step 5: Run Automated Tests
```powershell
npm test
```
All automated tests pass with 0 exit code.
