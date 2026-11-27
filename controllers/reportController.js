import { 
  ComplianceReport, 
  Inspection, 
  Store, 
  User, 
  Finding, 
  InspectionResponse, 
  ChecklistItem, 
  CorrectiveAction, 
  Evidence 
} from "../models/index.js";

// List all reports
export const getReportsList = async (req, res) => {
  try {
    const reports = await ComplianceReport.findAll({
      order: [["generatedAt", "DESC"]],
      include: [
        { model: Store, as: "store" },
        { model: User, as: "inspector" },
        { model: Inspection, as: "inspection" }
      ]
    });

    res.render("reports/list", {
      title: "Compliance Reports - DALIAudit",
      reports
    });
  } catch (error) {
    req.flash("error_msg", "Error loading compliance reports.");
    res.redirect("/admin/dashboard");
  }
};

// Helper: Fetch Report with Complete Relational Details & Auto-Creation Fallback
export const fetchReportWithDetails = async (id, userId) => {
  const reportInclude = [
    { model: Store, as: "store" },
    { model: User, as: "inspector" },
    { 
      model: Inspection, 
      as: "inspection",
      include: [
        { 
          model: InspectionResponse, 
          as: "responses",
          include: [{ model: ChecklistItem, as: "checklistItem" }]
        },
        { 
          model: Finding, 
          as: "findings",
          include: [
            { model: CorrectiveAction, as: "correctiveAction" },
            { model: Evidence, as: "evidences" }
          ]
        },
        { model: Evidence, as: "evidences" }
      ]
    }
  ];

  let report = await ComplianceReport.findByPk(id, { include: reportInclude });

  // Fallback 1: If not found by report ID, check if ID is an inspectionId
  if (!report) {
    report = await ComplianceReport.findOne({
      where: { inspectionId: id },
      include: reportInclude
    });
  }

  // Fallback 2: If no report exists yet for this inspection, auto-generate it so it is immediately previewable & printable
  if (!report) {
    const inspection = await Inspection.findByPk(id, {
      include: [
        { model: Store, as: "store" },
        { model: User, as: "inspector" },
        { model: Finding, as: "findings" }
      ]
    });

    if (inspection) {
      const count = await ComplianceReport.count();
      const reportCode = `REP-2026-${String(count + 1).padStart(3, "0")}`;
      const finalScore = inspection.score || 0;
      const grade = finalScore >= 90 ? "Grade A - Outstanding" : (finalScore >= 75 ? "Grade B - Satisfactory" : "Grade C - Needs Improvement");
      const hasViolations = (inspection.findings && inspection.findings.length > 0) || finalScore < 75;

      await ComplianceReport.create({
        reportCode,
        inspectionId: inspection.id,
        storeId: inspection.storeId,
        inspectorId: inspection.inspectorId || userId,
        summary: hasViolations 
          ? `Inspection completed with score of ${finalScore}%. ${inspection.findings?.length || 0} sanitation violations recorded requiring corrective action.`
          : `Inspection passed with score of ${finalScore}%. Full sanitation compliance observed across all food safety standards.`,
        finalScore,
        grade,
        status: "Published",
        recommendations: "Maintain strict daily sanitation logs and cold-chain compliance."
      });

      report = await ComplianceReport.findOne({
        where: { inspectionId: inspection.id },
        include: reportInclude
      });
    }
  }

  if (!report) return null;

  // Group responses by category
  const categoryScores = {};
  if (report.inspection?.responses) {
    for (const resp of report.inspection.responses) {
      const cat = resp.checklistItem?.category || "General";
      if (!categoryScores[cat]) {
        categoryScores[cat] = { total: 0, earned: 0, items: [] };
      }
      categoryScores[cat].total += resp.checklistItem?.weight || 10;
      categoryScores[cat].earned += resp.scoreAwarded || 0;
      categoryScores[cat].items.push(resp);
    }
  }

  const categoriesBreakdown = Object.keys(categoryScores).map(catName => ({
    name: catName,
    total: categoryScores[catName].total,
    earned: categoryScores[catName].earned,
    percentage: Math.round((categoryScores[catName].earned / (categoryScores[catName].total || 1)) * 100),
    items: categoryScores[catName].items
  }));

  return { report, categoriesBreakdown };
};

// View Detailed Report & Printable Inspection Record
export const viewReport = async (req, res) => {
  try {
    const { id } = req.params;
    const shouldAutoPrint = req.query.print === "true" || req.query.print === "1";
    const data = await fetchReportWithDetails(id, req.session.userId);

    if (!data) {
      req.flash("error_msg", "Compliance inspection report not found.");
      return res.redirect("/reports");
    }

    if (req.query.modal === "true" || req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.render("partials/report-document", {
        layout: false,
        report: data.report,
        categoriesBreakdown: data.categoriesBreakdown
      });
    }

    res.render("reports/view", {
      title: `Sanitation Compliance Audit ${data.report.reportCode} - DALIAudit`,
      report: data.report,
      categoriesBreakdown: data.categoriesBreakdown,
      autoPrint: shouldAutoPrint
    });
  } catch (error) {
    console.error("View report error:", error);
    req.flash("error_msg", "Failed to load report.");
    res.redirect("/admin/dashboard");
  }
};

// Modal Fragment Endpoint (for instant in-page preview without page navigation)
export const getReportModalContent = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchReportWithDetails(id, req.session.userId);

    if (!data) {
      return res.status(404).send("<div class='p-8 text-center text-rose-600 font-bold'>Inspection report not found.</div>");
    }

    res.render("partials/report-document", {
      layout: false,
      report: data.report,
      categoriesBreakdown: data.categoriesBreakdown
    });
  } catch (error) {
    console.error("Modal report error:", error);
    res.status(500).send("<div class='p-8 text-center text-rose-600 font-bold'>Failed to load inspection preview.</div>");
  }
};

// Generate Report for an Inspection
export const generateReportForInspection = async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const inspection = await Inspection.findByPk(inspectionId, {
      include: [
        { model: Store, as: "store" },
        { model: Finding, as: "findings" },
        { model: ComplianceReport, as: "report" }
      ]
    });

    if (!inspection) {
      req.flash("error_msg", "Inspection not found.");
      return res.redirect("/admin/inspections");
    }

    if (inspection.report) {
      return res.redirect(`/reports/view/${inspection.report.id}`);
    }

    const finalScore = inspection.score || 0;
    const grade = finalScore >= 90 ? "Grade A - Excellent" 
                : finalScore >= 80 ? "Grade B - Satisfactory" 
                : finalScore >= 70 ? "Grade C - Needs Improvement" 
                : "Grade F - Unsatisfactory";

    const count = await ComplianceReport.count();
    const reportCode = `REP-2026-${String(count + 1).padStart(3, "0")}`;

    const newReport = await ComplianceReport.create({
      reportCode,
      inspectionId: inspection.id,
      storeId: inspection.storeId,
      inspectorId: inspection.inspectorId,
      summary: `Official Sanitation Compliance Audit for ${inspection.store?.name}. Audit Score: ${finalScore}%.`,
      finalScore,
      grade,
      status: "Published",
      recommendations: "Maintain rigorous daily sanitization logs and temperature monitoring."
    });

    req.flash("success_msg", "Compliance report generated successfully!");
    res.redirect(`/reports/view/${newReport.id}`);
  } catch (error) {
    console.error("Generate report error:", error);
    req.flash("error_msg", "Failed to generate report.");
    res.redirect("/admin/inspections");
  }
};
