import { 
  Store, 
  User, 
  Inspection, 
  ChecklistItem, 
  Finding, 
  CorrectiveAction, 
  ComplianceReport 
} from "../models/index.js";
import stockService from "../services/stockService.js";
import posService from "../services/posService.js";

// Modeled after act9 adminDashboard
export async function adminDashboard(req, res) {
  try {
    const [storeCount, inspectionCount, userCount, reportCount, pendingUserCount] = await Promise.all([
      Store.count(),
      Inspection.count(),
      User.count({ where: { status: "APPROVED" } }),
      ComplianceReport.count(),
      User.count({ where: { status: "PENDING" } })
    ]);

    res.render("admin-dashboard", {
      title: "Admin Dashboard",
      storeCount,
      inspectionCount,
      userCount,
      reportCount,
      pendingUserCount
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    req.flash("error_msg", "Failed to load dashboard: " + error.message);
    res.redirect("/account/login");
  }
}

export const getAdminDashboard = adminDashboard;

// Store Management (REQ-1)
export const getStores = async (req, res) => {
  try {
    const stores = await Store.findAll({ order: [["name", "ASC"]] });
    res.render("admin/stores", {
      title: "Store Registry - DALIAudit",
      stores
    });
  } catch (error) {
    req.flash("error_msg", "Error loading stores.");
    res.redirect("/admin");
  }
};

export const createStore = async (req, res) => {
  try {
    const { code, name, address, city, region, managerName, contactPhone } = req.body;
    await Store.create({
      code: code || `DALI-${Date.now().toString().slice(-4)}`,
      name,
      address,
      city: city || "Metro Manila",
      region: region || "NCR",
      managerName,
      contactPhone,
      complianceStatus: "For Inspection",
      overallRating: 100
    });
    req.flash("success_msg", `Store "${name}" created successfully!`);
    res.redirect("/admin/stores");
  } catch (error) {
    req.flash("error_msg", "Failed to create store: " + error.message);
    res.redirect("/admin/stores");
  }
};

export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, managerName, contactPhone, complianceStatus } = req.body;
    await Store.update(
      { name, address, managerName, contactPhone, complianceStatus },
      { where: { id } }
    );
    req.flash("success_msg", "Store updated successfully.");
    res.redirect("/admin/stores");
  } catch (error) {
    req.flash("error_msg", "Failed to update store: " + error.message);
    res.redirect("/admin/stores");
  }
};

// Checklist Management
export const getChecklists = async (req, res) => {
  try {
    const items = await ChecklistItem.findAll({ order: [["category", "ASC"], ["weight", "DESC"]] });
    res.render("admin/checklists", {
      title: "Sanitation Checklist Engine - DALIAudit",
      items
    });
  } catch (error) {
    req.flash("error_msg", "Error loading checklists.");
    res.redirect("/admin");
  }
};

export const createChecklistItem = async (req, res) => {
  try {
    const { category, requirement, description, weight, criticality } = req.body;
    await ChecklistItem.create({
      category,
      requirement,
      description,
      weight: parseInt(weight) || 10,
      criticality: criticality || "Major",
      isActive: true
    });
    req.flash("success_msg", "Sanitation checklist item added successfully.");
    res.redirect("/admin/checklists");
  } catch (error) {
    req.flash("error_msg", "Failed to add checklist item: " + error.message);
    res.redirect("/admin/checklists");
  }
};

// Inspection Scheduling (REQ-2)
export const getSchedulePage = async (req, res) => {
  try {
    const stores = await Store.findAll({ order: [["name", "ASC"]] });
    const inspectors = await User.findAll({ 
      where: { role: ["inspector", "staff", "INSPECTOR"] }, 
      order: [["fullName", "ASC"]] 
    });
    const inspections = await Inspection.findAll({
      order: [["scheduledDate", "DESC"]],
      include: [
        { model: Store, as: "store" },
        { model: User, as: "inspector" }
      ]
    });

    // Fetch DALIStock branches and product catalog with graceful fallback
    const [stockBranchData, stockProductData] = await Promise.all([
      stockService.getPermittedBranches(),
      stockService.getCatalogProducts({ page: 1, limit: 100 })
    ]);

    res.render("admin/schedule", {
      title: "Schedule Sanitation Inspection - DALIAudit",
      stores,
      inspectors,
      inspections,
      stockBranches: stockBranchData.branches || [],
      stockProducts: stockProductData.products || [],
      stockLive: stockBranchData.isLive,
      stockStale: stockBranchData.isStale,
      stockFallback: stockBranchData.isFallback
    });
  } catch (error) {
    req.flash("error_msg", "Error loading schedule page.");
    res.redirect("/admin");
  }
};

export const createInspectionSchedule = async (req, res) => {
  try {
    const { storeId, inspectorId, scheduledDate, notes, stockBranchCode, stockSku } = req.body;
    const count = await Inspection.count();
    const code = `INS-2026-${String(count + 1).padStart(3, "0")}`;

    // Validate references if provided
    let stockProductName = null;
    let finalBranchCode = stockBranchCode || null;

    if (!finalBranchCode && storeId) {
      const selectedStore = await Store.findByPk(storeId);
      finalBranchCode = selectedStore?.stockBranchCode || selectedStore?.code || null;
    }

    if (stockSku) {
      const validation = await stockService.validateSelection(finalBranchCode, stockSku);
      if (!validation.valid) {
        req.flash("error_msg", validation.error);
        return res.redirect("/admin/schedule");
      }
      if (validation.product) {
        stockProductName = validation.product.name;
      }
    }

    await Inspection.create({
      inspectionCode: code,
      storeId: parseInt(storeId),
      inspectorId: parseInt(inspectorId),
      scheduledDate: new Date(scheduledDate || Date.now()),
      status: "Scheduled",
      notes: notes || "Standard store sanitation and food safety compliance audit.",
      score: 0,
      totalPoints: 100,
      earnedPoints: 0,
      stockBranchCode: finalBranchCode,
      stockSku: stockSku || null,
      stockProductName
    });

    req.flash("success_msg", `Inspection ${code} successfully scheduled and assigned!`);
    res.redirect("/admin/schedule");
  } catch (error) {
    req.flash("error_msg", "Failed to schedule inspection: " + error.message);
    res.redirect("/admin/schedule");
  }
};

// All Inspections View
export const getAllInspections = async (req, res) => {
  try {
    const inspections = await Inspection.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        { model: Store, as: "store" },
        { model: User, as: "inspector" },
        { model: Finding, as: "findings" },
        { model: ComplianceReport, as: "report" }
      ]
    });

    res.render("admin/inspections", {
      title: "All Inspections - DALIAudit",
      inspections
    });
  } catch (error) {
    req.flash("error_msg", "Error loading inspections.");
    res.redirect("/admin");
  }
};

// DALI Modules Integration Management (DALIStock & DALI POS)
export const getIntegrationsPage = async (req, res) => {
  try {
    const testResult = req.session.stockTestResult || null;
    const posTestResult = req.session.posTestResult || null;
    res.render("admin/integrations", {
      title: "Integrations & Connections - DALIAudit",
      stockUrl: process.env.STOCK_API_BASE_URL || "http://10.183.59.144:3000",
      stockBranch: process.env.STOCK_BRANCH_CODE || "BR-001",
      hasToken: Boolean(process.env.STOCK_API_TOKEN),
      posUrl: process.env.DALI_POS_BASE_URL || "http://127.0.0.1:3000",
      hasPosToken: Boolean(process.env.DALI_POS_INTEGRATION_TOKEN),
      port: process.env.PORT || 3003,
      testResult,
      posTestResult
    });
  } catch (error) {
    req.flash("error_msg", "Error loading integrations page.");
    res.redirect("/admin");
  }
};

export const testStockConnection = async (req, res) => {
  try {
    const result = await stockService.checkConnection();
    req.session.stockTestResult = result;

    if (result.ok) {
      req.flash("success_msg", `DALIStock connection verified! Target: ${result.system}, Authenticated Source: ${result.source}`);
    } else {
      req.flash("error_msg", `DALIStock connection failed: ${result.error}`);
    }

    res.redirect("/admin/integrations");
  } catch (error) {
    req.flash("error_msg", "Unexpected error testing connection: " + error.message);
    res.redirect("/admin/integrations");
  }
};

export const testPosConnection = async (req, res) => {
  try {
    const result = await posService.checkConnection();
    req.session.posTestResult = result;

    if (result.ok) {
      req.flash("success_msg", `DALI POS connection verified! Service: ${result.service}, Status: ${result.status}`);
    } else {
      req.flash("error_msg", `DALI POS connection failed: ${result.error}`);
    }

    res.redirect("/admin/integrations");
  } catch (error) {
    req.flash("error_msg", "Unexpected error testing DALI POS: " + error.message);
    res.redirect("/admin/integrations");
  }
};
