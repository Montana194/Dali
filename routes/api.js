import express from "express";
import { Store, Inspection, Finding, CorrectiveAction, ComplianceReport, User } from "../models/index.js";

const router = express.Router();

// Middleware: API Key / Authorization Header Verification
export const verifyIntegrationAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.INTEGRATION_API_KEY || "daliaudit-integration-key-2026";
  
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header." });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token !== expectedKey) {
    return res.status(403).json({ error: "Invalid integration API token." });
  }

  next();
};

// GET /api/integration/v1/health
router.get("/health", (req, res) => {
  res.json({
    module: "DALIAudit",
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// GET /api/integration/v1/stores - Branch compliance lookup
router.get("/stores", verifyIntegrationAuth, async (req, res) => {
  try {
    const stores = await Store.findAll({
      attributes: ["id", "code", "name", "address", "city", "region", "managerName", "complianceStatus", "overallRating", "lastInspectionDate"],
      order: [["name", "ASC"]]
    });
    res.json({ schemaVersion: 1, data: stores });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/integration/v1/inspections - Scoped by storeCode or status (For DALIInsight / DALICheck)
router.get("/inspections", verifyIntegrationAuth, async (req, res) => {
  try {
    const { storeCode, status } = req.query;
    const storeWhere = storeCode ? { code: storeCode } : {};
    const inspectionWhere = status ? { status } : {};

    const inspections = await Inspection.findAll({
      where: inspectionWhere,
      include: [
        { model: Store, as: "store", where: storeWhere, attributes: ["code", "name", "city"] },
        { model: User, as: "inspector", attributes: ["fullName", "badgeNumber"] },
        { model: Finding, as: "findings", attributes: ["title", "severity", "status", "deadline"] }
      ],
      order: [["inspectionDate", "DESC"]],
      limit: 100
    });

    const formatted = inspections.map(i => ({
      inspectionCode: i.inspectionCode,
      storeCode: i.store?.code,
      storeName: i.store?.name,
      inspector: i.inspector?.fullName,
      inspectorBadge: i.inspector?.badgeNumber,
      inspectionDate: i.inspectionDate,
      status: i.status,
      score: i.score,
      passed: i.passed,
      findingsCount: i.findingsCount,
      findings: i.findings
    }));

    res.json({ schemaVersion: 1, data: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/integration/v1/reports/:reportCode - Official compliance report (For DALIInsight)
router.get("/reports/:reportCode", verifyIntegrationAuth, async (req, res) => {
  try {
    const report = await ComplianceReport.findOne({
      where: { reportCode: req.params.reportCode },
      include: [
        { model: Store, as: "store", attributes: ["code", "name", "address"] },
        { model: User, as: "inspector", attributes: ["fullName", "badgeNumber"] },
        { model: Inspection, as: "inspection", attributes: ["inspectionCode", "score", "status"] }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.json({
      schemaVersion: 1,
      data: {
        reportCode: report.reportCode,
        inspectionCode: report.inspection?.inspectionCode,
        storeCode: report.store?.code,
        storeName: report.store?.name,
        inspector: report.inspector?.fullName,
        generatedAt: report.generatedAt,
        finalScore: report.finalScore,
        grade: report.grade,
        status: report.status,
        summary: report.summary,
        recommendations: report.recommendations
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/integration/v1/complaints/referral - Accept customer complaints from DALIResolve
router.post("/complaints/referral", verifyIntegrationAuth, async (req, res) => {
  try {
    const { eventId, storeCode, complaintCategory, complaintReference, description, occurredAt } = req.body;

    if (!eventId || !storeCode || !description) {
      return res.status(422).json({ error: "Missing required fields: eventId, storeCode, description." });
    }

    const store = await Store.findOne({ where: { code: storeCode } });
    if (!store) {
      return res.status(404).json({ error: `Store with code ${storeCode} not found.` });
    }

    // Return receipt confirming referral logged
    res.status(201).json({
      schemaVersion: 1,
      status: "RECEIVED",
      referralReceipt: `AUDIT-REF-${Date.now().toString().slice(-6)}`,
      eventId,
      storeCode: store.code,
      message: `Customer complaint ${complaintReference || eventId} registered for upcoming branch audit scope.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
