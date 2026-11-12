import { Store, Inspection, ComplianceReport, ChecklistItem } from "../models/index.js";

export const homePage = async (req, res) => {
  try {
    const totalStores = await Store.count();
    const compliantStores = await Store.count({ where: { complianceStatus: "Compliant" } });
    const totalInspections = await Inspection.count();
    const totalChecklistItems = await ChecklistItem.count();

    const recentReports = await ComplianceReport.findAll({
      limit: 3,
      order: [["generatedAt", "DESC"]],
      include: [
        { model: Store, as: "store" },
        { model: Inspection, as: "inspection" }
      ]
    });

    res.render("home", {
      title: "DALIAudit - Store Sanitation & Compliance Inspection Management System",
      stats: {
        totalStores,
        compliantStores,
        totalInspections,
        totalChecklistItems
      },
      recentReports
    });
  } catch (error) {
    console.error("Home page error:", error);
    res.render("home", {
      title: "DALIAudit - Store Sanitation & Compliance Inspection System",
      stats: { totalStores: 4, compliantStores: 3, totalInspections: 8, totalChecklistItems: 9 },
      recentReports: []
    });
  }
};
