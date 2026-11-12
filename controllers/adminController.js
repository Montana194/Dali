import { 
  Store, 
  User, 
  Inspection, 
  ChecklistItem, 
  Finding, 
  CorrectiveAction, 
  ComplianceReport 
} from "../models/index.js";

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

    res.render("admin/schedule", {
      title: "Schedule Sanitation Inspection - DALIAudit",
      stores,
      inspectors,
      inspections
    });
  } catch (error) {
    req.flash("error_msg", "Error loading schedule page.");
    res.redirect("/admin");
  }
};

export const createInspectionSchedule = async (req, res) => {
  try {
    const { storeId, inspectorId, scheduledDate, notes } = req.body;
    const count = await Inspection.count();
    const code = `INS-2026-${String(count + 1).padStart(3, "0")}`;

    await Inspection.create({
      inspectionCode: code,
      storeId: parseInt(storeId),
      inspectorId: parseInt(inspectorId),
      scheduledDate: new Date(scheduledDate || Date.now()),
      status: "Scheduled",
      notes: notes || "Standard store sanitation and food safety compliance audit.",
      score: 0,
      totalPoints: 100,
      earnedPoints: 0
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
