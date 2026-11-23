# Integration Handout: DALI POS → DALIAudit Service Connection

> **Audience:** DALI POS Developers, System Architects, and AI Assistants.  
> **Purpose:** Step-by-step instructions and technical API contract to connect **DALI POS** with **DALIAudit** locally or across LAN.

---

## 1. Network Topology & Port Allocation

| Service | Port | Local Base URL | Primary Role |
| :--- | :--- | :--- | :--- |
| **DALI POS** | `3000` | `http://127.0.0.1:3000` | Point of Sale, Inventory Catalog, and Sales Transactions |
| **DALIAudit** | `3003` | `http://127.0.0.1:3003` | Store Sanitation, Food Safety Audit, and Compliance Management |

> **Architectural Boundary:**  
> - Each system manages its own MySQL database. **DALIAudit and DALI POS must never connect directly to each other's database.**  
> - All cross-system integration occurs strictly through authenticated HTTP REST APIs.  
> - DALIAudit uses session cookie `daliaudit.sid` to avoid session clashing on localhost.

---

## 2. Environment Configuration for DALI POS

Add the following environment variables to the **DALI POS `.env`** file:

```dotenv
# Server Configuration (DALI POS runs on 3000)
PORT=3000

# 1. Token accepted by DALI POS for incoming requests from DALIAudit:
DALI_POS_INTEGRATION_TOKEN=puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q

# 2. DALIAudit Outbound Connection:
DALIAUDIT_BASE_URL=http://127.0.0.1:3003
DALIAUDIT_API_TOKEN=oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc
```

*(Note: If running across different laptops on the same Wi-Fi, replace `127.0.0.1` with the respective laptop LAN IPv4 address).*

---

## 3. How DALI POS Calls DALIAudit

When DALI POS makes an outbound HTTP request to DALIAudit, it must include:
```http
Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc
Accept: application/json
```

---

## 4. Published DALIAudit API Endpoints

All endpoints are hosted at `http://127.0.0.1:3003`:

### Endpoint 1: Health & Readiness Probe
* **Route:** `GET /api/health` *(also available at `/api/integration/v1/health`)*
* **Headers:** `Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc`
* **Success Response (`200 OK`):**
  ```json
  {
    "ok": true,
    "service": "DALIAudit",
    "schemaVersion": 1,
    "status": "ready"
  }
  ```
* **Failure Response (`503 Service Unavailable`):**
  ```json
  {
    "ok": false,
    "service": "DALIAudit",
    "status": "unavailable",
    "error": { "code": "DATABASE_UNAVAILABLE", "message": "Database connection failed." }
  }
  ```

---

### Endpoint 2: Store Branches & Sanitation Status
* **Route:** `GET /api/stores` *(or `/api/integration/v1/stores`)*
* **Headers:** `Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc`
* **Description:** Returns the branch registry with their current food safety rating and compliance status.
* **Success Response (`200 OK`):**
  ```json
  {
    "schemaVersion": 1,
    "data": [
      {
        "id": 1,
        "code": "BR-001",
        "name": "DALI Everyday Grocery - Calapan Branch",
        "address": "J.P. Rizal St., San Vicente, Calapan City",
        "city": "Calapan",
        "region": "MIMAROPA",
        "managerName": "Maria Santos",
        "complianceStatus": "Compliant",
        "overallRating": 95,
        "lastInspectionDate": "2026-11-20T08:30:00.000Z"
      }
    ]
  }
  ```

---

### Endpoint 3: Store Inspection History
* **Route:** `GET /api/inspections` *(or `/api/integration/v1/inspections`)*
* **Query Parameters (Optional):**
  * `storeCode` (e.g. `?storeCode=BR-001`)
  * `status` (e.g. `?status=Compliant` or `?status=Noncompliant`)
* **Headers:** `Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc`
* **Success Response (`200 OK`):**
  ```json
  {
    "schemaVersion": 1,
    "data": [
      {
        "id": 10,
        "inspectionCode": "INS-2026-003",
        "status": "Compliant",
        "score": 94.5,
        "passed": true,
        "scheduledDate": "2026-11-20T00:00:00.000Z",
        "completedAt": "2026-11-20T10:15:00.000Z",
        "stockBranchCode": "BR-001",
        "stockSku": null,
        "findingsCount": 0,
        "store": {
          "code": "BR-001",
          "name": "DALI Everyday Grocery - Calapan Branch"
        }
      }
    ]
  }
  ```

---

### Endpoint 4: Official Compliance Report Certificate
* **Route:** `GET /api/reports/:reportCode` *(or `/api/integration/v1/reports/:reportCode`)*
* **Headers:** `Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc`
* **Success Response (`200 OK`):**
  ```json
  {
    "schemaVersion": 1,
    "data": {
      "reportCode": "REP-2026-001",
      "grade": "Grade A - Excellent",
      "finalScore": 95,
      "generatedAt": "2026-11-20T10:20:00.000Z",
      "summary": "Full food safety compliance achieved across cold chain and retail aisles.",
      "recommendations": "Maintain daily temperature logging logs three times daily.",
      "store": {
        "code": "BR-001",
        "name": "DALI Everyday Grocery - Calapan Branch"
      }
    }
  }
  ```

---

### Endpoint 5: Hygiene Incident Referral Intake
* **Route:** `POST /api/complaints/referral` *(or `/api/integration/v1/complaints/referral`)*
* **Headers:**
  * `Authorization: Bearer oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc`
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "eventId": "POS-INCIDENT-2026-001",
    "storeCode": "BR-001",
    "complaintCategory": "Hygiene",
    "complaintReference": "TX-99021-RETURN",
    "description": "Customer returned milk bottle citing warm chiller temperature at shelf.",
    "occurredAt": "2026-11-23T17:30:00.000Z"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "schemaVersion": 1,
    "status": "RECEIVED",
    "referralReceipt": "AUDIT-REF-894215",
    "eventId": "POS-INCIDENT-2026-001",
    "storeCode": "BR-001",
    "message": "Customer complaint registered for upcoming branch audit scope."
  }
  ```

---

## 5. DALI POS Implementation Example (Node.js)

In the DALI POS codebase, you can invoke DALIAudit using your helper `services/daliAuditClient.js`:

```javascript
import { requestDaliAudit } from "./services/daliAuditClient.js";

// 1. Verify DALIAudit is healthy
export async function checkAuditSystem() {
  const health = await requestDaliAudit("/api/health", { method: "GET" });
  console.log("DALIAudit Status:", health.status); // 'ready'
  return health;
}

// 2. Lookup branch compliance status before opening POS register
export async function getBranchAuditStatus(branchCode = "BR-001") {
  const response = await requestDaliAudit(`/api/stores`, { method: "GET" });
  const store = response.data.find(s => s.code === branchCode);
  return store ? store.complianceStatus : "Unknown";
}
```

---

## 6. How DALIAudit Calls DALI POS

DALIAudit consumes the following read-only POS endpoints at `http://127.0.0.1:3000`:

| Endpoint | Method | Expected Data |
| :--- | :--- | :--- |
| `/api/integration/v1/health` | `GET` | Health and supported capabilities (`products`, `inventory`, `sales`) |
| `/api/integration/v1/products` | `GET` | Catalog products (name, category, price, costPrice, stock) |
| `/api/integration/v1/inventory`| `GET` | Active items and stock count |
| `/api/integration/v1/sales`    | `GET` | Completed sales records for compliance verification |

DALIAudit sends:
```http
Authorization: Bearer puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q
Accept: application/json
```

---

## 7. Verification Commands

### Test 1: Verify DALIAudit from DALI POS Terminal (PowerShell)
```powershell
$token = "oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc"
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3003/api/health" `
  -Headers @{ Authorization = "Bearer $token"; Accept = "application/json" }
```
**Expected Output:**
```json
{
  "ok": true,
  "service": "DALIAudit",
  "schemaVersion": 1,
  "status": "ready"
}
```

### Test 2: Verify DALI POS from DALIAudit Terminal (PowerShell)
```powershell
$posToken = "puYZxd3jo5xAyoqV5PjgDdmM-5qfDsSRkEJ-sZoyO9Q"
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/integration/v1/health" `
  -Headers @{ Authorization = "Bearer $posToken"; Accept = "application/json" }
```

---

## 8. Summary Checklist for DALI POS Team

- [ ] Paste `DALI_POS_INTEGRATION_TOKEN` into your `.env`.
- [ ] Set `DALIAUDIT_BASE_URL=http://127.0.0.1:3003` in your `.env`.
- [ ] Set `DALIAUDIT_API_TOKEN=oZh1fMRqnYFVySSdPhITpodaihiK4nCrhCgbnjYMTwc` in your `.env`.
- [ ] Start DALI POS on Port `3000`.
- [ ] Run the PowerShell smoke check to confirm `200 OK` from DALIAudit.
