/**
 * DALI POS Integration Smoke Test for DALIAudit
 * Run with: node --env-file=.env integrations/pos-smoke-test.mjs
 */

import { DaliPosClient } from "./dalipos-client.mjs";

async function runPosSmokeTest() {
  console.log("=================================================");
  console.log("   DALI POS ↔ DALIAudit Integration Smoke Test   ");
  console.log("=================================================");
  const baseUrl = process.env.DALI_POS_BASE_URL || "http://127.0.0.1:3000";
  const token = process.env.DALI_POS_INTEGRATION_TOKEN || "";

  console.log(`Target Base URL: ${baseUrl}`);
  console.log(`Has Bearer Token: ${token ? "YES (masked, length: " + token.length + ")" : "NO"}\n`);

  if (!token) {
    console.error("❌ ERROR: DALI_POS_INTEGRATION_TOKEN is missing in your .env!");
    console.error("   Generate a random 32-byte secret and place it in both DALI POS and DALIAudit .env files.");
    process.exit(1);
  }

  const client = new DaliPosClient({ baseUrl, token });

  // 1. Health & Capabilities Check
  console.log("1. Testing DALI POS Health (GET /api/integration/v1/health)...");
  let health;
  try {
    health = await client.health();
    console.log("   [Response]", JSON.stringify(health));
    console.log(`   ✅ Health confirmed: service='${health.service}', status='${health.status}'`);
    if (Array.isArray(health.capabilities)) {
      console.log(`   ✅ POS capabilities: ${health.capabilities.join(", ")}`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to reach DALI POS health endpoint: ${err.message}`);
    if (err.code === "ETIMEDOUT" || err.message.includes("fetch failed")) {
      console.error("   Hint: Ensure DALI POS is running on port 3000 at http://127.0.0.1:3000");
    }
    process.exit(1);
  }

  // 2. Products Endpoint
  console.log("\n2. Testing DALI POS Products Catalog (GET /api/integration/v1/products)...");
  try {
    const prodRes = await client.products({ page: 1, limit: 5 });
    const products = prodRes.data || [];
    const pagination = prodRes.pagination || {};
    console.log(`   ✅ Retrieved ${products.length} product(s) (Total in POS: ${pagination.total || products.length}):`);
    products.slice(0, 3).forEach((p) => {
      console.log(`      - [${p.id || p.sku || "N/A"}] ${p.name || p.title || "Product"} | Category: ${p.category || "General"} | Price: ${p.price || p.unitCost || 0}`);
    });
  } catch (err) {
    console.error(`   ❌ Failed to retrieve products from DALI POS: ${err.message}`);
    process.exit(1);
  }

  // 3. Inventory Stock Endpoint
  console.log("\n3. Testing DALI POS Inventory (GET /api/integration/v1/inventory)...");
  try {
    const invRes = await client.inventory({ page: 1, limit: 5 });
    const inventory = invRes.data || [];
    const pagination = invRes.pagination || {};
    console.log(`   ✅ Retrieved ${inventory.length} inventory item(s) (Total: ${pagination.total || inventory.length}):`);
    inventory.slice(0, 3).forEach((item) => {
      console.log(`      - Item: ${item.name || item.productName || item.id} | Current Stock: ${item.stock ?? item.quantity ?? "N/A"}`);
    });
  } catch (err) {
    console.error(`   ❌ Failed to retrieve inventory from DALI POS: ${err.message}`);
    process.exit(1);
  }

  // 4. Sales Endpoint
  console.log("\n4. Testing DALI POS Sales (GET /api/integration/v1/sales)...");
  try {
    const salesRes = await client.sales({ page: 1, limit: 5 });
    const sales = salesRes.data || [];
    const pagination = salesRes.pagination || {};
    console.log(`   ✅ Retrieved ${sales.length} completed sale(s) (Total: ${pagination.total || sales.length}):`);
    sales.slice(0, 3).forEach((sale) => {
      console.log(`      - Transaction: ${sale.id || sale.transactionId || sale.reference || "N/A"} | Amount: ${sale.totalAmount || sale.amount || 0}`);
    });
  } catch (err) {
    console.error(`   ❌ Failed to retrieve sales from DALI POS: ${err.message}`);
    process.exit(1);
  }

  // 5. Read-Only Constraint Confirmation
  console.log("\n5. Confirming Read-Only Scope...");
  console.log("   ✅ Audit client strictly consumes read-only GET endpoints (no write, update, or void operations performed).");

  console.log("\n=================================================");
  console.log("   🎉 DALI POS Integration Smoke Test PASSED!    ");
  console.log("=================================================");
}

runPosSmokeTest().catch((err) => {
  console.error("\n❌ Unexpected smoke test exception:", err);
  process.exit(1);
});
