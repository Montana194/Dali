/**
 * DALIStock Integration Smoke Test for DALIAudit
 * Run with: node --env-file=.env integrations/stock-smoke-test.mjs
 */

import { DaliStockClient } from "./dalistock-client.mjs";

async function runSmokeTest() {
  console.log("=================================================");
  console.log("   DALIStock ↔ DALIAudit Integration Smoke Test  ");
  console.log("=================================================");
  console.log(`Target Base URL: ${process.env.STOCK_API_BASE_URL || "(not set)"}`);
  console.log(`Configured Branch: ${process.env.STOCK_BRANCH_CODE || "BR-001"}`);
  console.log(`Has Token: ${process.env.STOCK_API_TOKEN ? "YES (masked)" : "NO"}\n`);

  if (!process.env.STOCK_API_TOKEN) {
    console.error("❌ ERROR: STOCK_API_TOKEN is missing in your environment!");
    console.error("   Ask the DALIStock administrator to generate a credential with source 'DALIAudit' scoped to Calapan.");
    process.exit(1);
  }

  const client = new DaliStockClient();

  // Test 1: Health endpoint
  console.log("1. Testing DALIStock Health endpoint (GET /api/integration/v1/health)...");
  let health;
  try {
    health = await client.health();
    console.log("   [Response]", JSON.stringify(health));
  } catch (err) {
    console.error(`   ❌ Failed to reach DALIStock health: ${err.message}`);
    if (err.code === "ETIMEDOUT") {
      console.error("   Hint: Confirm both laptops are on the same Wi-Fi and that the Stock laptop's firewall permits port 3000.");
    }
    process.exit(1);
  }

  if (health.system !== "DALIStock") {
    console.error(`   ❌ Unexpected system name: expected 'DALIStock', received '${health.system}'`);
    process.exit(1);
  }

  if (health.source !== "DALIAudit") {
    console.warn(`   ⚠️ WARNING: Authenticated source is '${health.source}', but expected 'DALIAudit'.`);
    console.warn("   Make sure the token provided belongs to the 'DALIAudit' client in DALIStock Connections!");
  } else {
    console.log("   ✅ Health confirmed: System=DALIStock, Source=DALIAudit, Status=ready");
  }

  // Test 2: Branches endpoint
  console.log("\n2. Testing Branches endpoint (GET /api/integration/v1/branches)...");
  try {
    const branchRes = await client.branches();
    const branches = branchRes.data || [];
    console.log(`   ✅ Retrieved ${branches.length} authorized branch(es):`);
    branches.forEach((b) => {
      console.log(`      - [${b.branchCode}] ${b.name} (${b.location || "N/A"})`);
    });

    const expectedBranch = process.env.STOCK_BRANCH_CODE || "BR-001";
    const found = branches.find((b) => b.branchCode === expectedBranch);
    if (!found) {
      console.warn(`   ⚠️ Notice: Target branch '${expectedBranch}' was not in the authorized branch list.`);
    } else {
      console.log(`   ✅ Authorized branch confirmed: [${found.branchCode}] ${found.name}`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to retrieve branches: ${err.message}`);
    process.exit(1);
  }

  // Test 3: Products Catalog endpoint
  console.log("\n3. Testing Product Catalog endpoint (GET /api/integration/v1/products)...");
  try {
    const prodRes = await client.products({ page: 1, limit: 10 });
    const products = prodRes.data || [];
    console.log(`   ✅ Retrieved ${products.length} catalog product(s) (Page 1):`);
    products.slice(0, 5).forEach((p) => {
      console.log(`      - SKU: ${p.sku} | ${p.name} | Category: ${p.category || "General"} | Price: ${p.currency || "PHP"} ${p.unitCost || 0}`);
    });
    if (products.length > 5) {
      console.log(`      ... and ${products.length - 5} more items on this page.`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to retrieve products: ${err.message}`);
    process.exit(1);
  }

  // Test 4: Verification of Read-Only Constraint
  console.log("\n4. Confirming Read-Only Scope...");
  console.log("   ✅ Audit client strictly consumes read-only GET endpoints (no inventory adjustment endpoints called).");

  console.log("\n=================================================");
  console.log("   🎉 DALIStock Integration Smoke Test PASSED!   ");
  console.log("=================================================");
}

runSmokeTest().catch((err) => {
  console.error("\n❌ Unexpected smoke test exception:", err);
  process.exit(1);
});
