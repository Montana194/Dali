process.env.NODE_ENV = "test";

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "./index.js";
import { sequelize, Store } from "./models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("🧪 Starting DALIAudit Integration & Smoke Tests...");

  // 1. Verify implementation.md existence and section count
  const implPath = path.join(__dirname, "implementation.md");
  if (!fs.existsSync(implPath)) {
    throw new Error("❌ implementation.md is missing!");
  }
  const implContent = fs.readFileSync(implPath, "utf-8");
  for (let i = 1; i <= 11; i++) {
    const sectionPattern = new RegExp(`## ${i}\\.`, "i");
    if (!sectionPattern.test(implContent)) {
      throw new Error(`❌ implementation.md is missing Section ${i}!`);
    }
  }
  console.log("✅ implementation.md verified: all 11 sections present.");

  // Sync DB for test run and seed 1 store if none exists
  await sequelize.sync();
  let sampleStore = await Store.findOne({ where: { code: "DALI-MNL-001" } });
  if (!sampleStore) {
    sampleStore = await Store.create({
      code: "DALI-MNL-001",
      name: "DALI Everyday Grocery - Manila Malate Branch",
      address: "123 Mabini St., Malate",
      city: "Manila",
      region: "NCR",
      managerName: "Juan Dela Cruz",
      complianceStatus: "Compliant",
      overallRating: 94.50
    });
  }

  // 2. Start server on an ephemeral or test port
  const testPort = 3999;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(testPort, resolve));
  console.log(`✅ Test server running on port ${testPort}.`);

  const request = (path, options = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: testPort,
          path,
          method: options.method || "GET",
          headers: options.headers || {}
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                json: body ? JSON.parse(body) : null,
                body
              });
            } catch (err) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body
              });
            }
          });
        }
      );
      req.on("error", reject);
      if (options.body) {
        req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  };

  try {
    const validToken = process.env.INTEGRATION_API_KEY || "daliaudit-integration-key-2026";

    // 3. Health check test - unauthenticated must be rejected with 401
    const unauthHealth = await request("/api/integration/v1/health");
    if (unauthHealth.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /health, got: ${unauthHealth.status}`);
    }
    console.log("✅ Unauthenticated /health correctly rejected with 401.");

    // 4. Health check test - authenticated with X-API-Key
    const healthRes = await request("/api/integration/v1/health", {
      headers: { "X-API-Key": validToken }
    });
    if (healthRes.status !== 200 || healthRes.json?.status !== "ready" || !healthRes.json?.ok) {
      throw new Error(`Health check with X-API-Key failed: ${JSON.stringify(healthRes)}`);
    }
    console.log("✅ Authenticated GET /api/integration/v1/health (X-API-Key): 200 OK & status ready.");

    // 5. Auth header rejection test on /stores
    const unauthRes = await request("/api/integration/v1/stores");
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 for missing token on /stores, got: ${unauthRes.status}`);
    }
    console.log("✅ Unauthenticated request to /stores correctly rejected with 401.");

    // 6. Invalid token rejection test
    const invalidAuthRes = await request("/api/integration/v1/stores", {
      headers: { Authorization: "Bearer wrong-token" }
    });
    if (invalidAuthRes.status !== 401 && invalidAuthRes.status !== 403) {
      throw new Error(`Expected 401/403 for wrong token, got: ${invalidAuthRes.status}`);
    }
    console.log("✅ Invalid token correctly rejected with 401.");

    // 7. Valid Bearer token test on /stores
    const authRes = await request("/api/integration/v1/stores", {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    if (authRes.status !== 200 || !Array.isArray(authRes.json?.data)) {
      throw new Error(`Valid token request failed: status ${authRes.status}, data: ${JSON.stringify(authRes.json)}`);
    }
    console.log(`✅ Valid token GET /api/integration/v1/stores: 200 OK, retrieved ${authRes.json.data.length} stores.`);

    // 7. Complaint referral intake test
    const complaintRes = await request("/api/integration/v1/complaints/referral", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json"
      },
      body: {
        eventId: "TEST-EVT-001",
        storeCode: authRes.json.data[0]?.code || "DALI-MNL-001",
        complaintCategory: "Hygiene",
        complaintReference: "COMP-2026-9999",
        description: "Integration smoke test complaint referral.",
        occurredAt: new Date().toISOString()
      }
    });

    if (complaintRes.status !== 201 || complaintRes.json?.status !== "RECEIVED") {
      throw new Error(`Complaint referral failed: status ${complaintRes.status}, body: ${JSON.stringify(complaintRes.json)}`);
    }
    console.log("✅ POST /api/integration/v1/complaints/referral: 201 Created & receipt issued.");

    // 8. DALIStock Client & Model Field persistence test
    const { DaliStockClient } = await import("./integrations/dalistock-client.mjs");
    const testStockClient = new DaliStockClient({ baseUrl: "http://127.0.0.1:3999", token: validToken });
    if (typeof testStockClient.health !== "function" || typeof testStockClient.branches !== "function" || typeof testStockClient.products !== "function") {
      throw new Error("DaliStockClient is missing required methods.");
    }
    console.log("✅ DaliStockClient verified: health, branches, products methods present.");

    const { Inspection, User } = await import("./models/index.js");
    const testInspector = await User.findOne() || await User.create({
      fullName: "Test Inspector",
      email: "test.inspector@dali.ph",
      password: "hashedpassword",
      role: "inspector"
    });

    const testInspection = await Inspection.create({
      inspectionCode: `TEST-INS-${Date.now()}`,
      storeId: sampleStore.id,
      inspectorId: testInspector.id,
      status: "Scheduled",
      stockBranchCode: "BR-001",
      stockSku: "SKU-DALI-MILK-001",
      stockProductName: "Fresh Milk 1L"
    });

    const fetched = await Inspection.findByPk(testInspection.id);
    if (fetched.stockBranchCode !== "BR-001" || fetched.stockSku !== "SKU-DALI-MILK-001") {
      throw new Error(`Stock fields failed to persist on Inspection! Got: ${fetched.stockBranchCode}, ${fetched.stockSku}`);
    }
    console.log(`✅ Inspection record persisted DALIStock references: branchCode=${fetched.stockBranchCode}, sku=${fetched.stockSku}`);

    // Cleanup test inspection
    await testInspection.destroy();

    console.log("🎉 All DALIAudit integration & smoke tests passed successfully!");
  } finally {
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  });
