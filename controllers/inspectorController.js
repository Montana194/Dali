import { 
  Inspection, 
  Store, 
  User, 
  ChecklistItem, 
  InspectionResponse, 
  Finding, 
  CorrectiveAction, 
  Evidence, 
  ComplianceReport 
} from "../models/index.js";

// Inspector Dashboard
export const getInspectorDashboard = async (req, res) => {
  try {
    const inspectorId = req.session.userId;
    const assignedInspections = await Inspection.findAll({
      where: { inspectorId },
      order: [["scheduledDate", "DESC"]],
      include: [
        { model: Store, as: "store" },
        { model: Finding, as: "findings" }
      ]
    });

    const pendingVerifications = await CorrectiveAction.findAll({
      where: { status: "Submitted" },
      include: [
        { 
          model: Inspection, 
          as: "inspection",
          where: { inspectorId },
          include: [{ model: Store, as: "store" }]
        },
        { model: Finding, as: "finding" },
        { model: Evidence, as: "evidences" },
        { model: User, as: "representative" }
      ]
    });

    const pendingCount = assignedInspections.filter(i => ["Scheduled", "InProgress"].includes(i.status)).length;
    const completedCount = assignedInspections.filter(i => ["Compliant", "Closed"].includes(i.status)).length;

    res.render("inspector/dashboard", {
      title: "Inspector Portal - DALIAudit",
      assignedInspections,
      pendingVerifications,
      metrics: {
        total: assignedInspections.length,
        pending: pendingCount,
        verifications: pendingVerifications.length,
        completed: completedCount
      }
    });
  } catch (error) {
    console.error("Inspector dashboard error:", error);
    req.flash("error_msg", "Failed to load inspector dashboard: " + error.message);
    res.redirect("/login");
  }
};

// Start or Open Inspection Form (Figure 7: InspectionFormUI & ChecklistEngine)
export const getConductInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = await Inspection.findByPk(id, {
      include: [
        { model: Store, as: "store" },
        { model: User, as: "inspector" },
        { 
          model: InspectionResponse, 
          as: "responses",
          include: [{ model: ChecklistItem, as: "checklistItem" }]
        },
        { model: Finding, as: "findings" },
        { model: Evidence, as: "evidences" }
      ]
    });

    if (!inspection) {
      req.flash("error_msg", "Inspection not found.");
      return res.redirect("/inspector/dashboard");
    }

    // If still Scheduled, advance to InProgress
    if (inspection.status === "Scheduled") {
      inspection.status = "InProgress";
      await inspection.save();
    }

    const checklistItems = await ChecklistItem.findAll({
      where: { isActive: true },
      order: [["category", "ASC"], ["id", "ASC"]]
    });

    // Group items by category
    const categoriesMap = {};
    for (const item of checklistItems) {
      if (!categoriesMap[item.category]) {
        categoriesMap[item.category] = [];
      }
      // Check if there is already a response for this item
      const existingResponse = inspection.responses?.find(r => r.itemId === item.id);
      categoriesMap[item.category].push({
        ...item.toJSON(),
        existingResponse: existingResponse ? existingResponse.toJSON() : null
      });
    }

    const categories = Object.keys(categoriesMap).map(name => ({
      name,
      items: categoriesMap[name]
    }));

    res.render("inspector/conduct", {
      title: `Sanitation Inspection ${inspection.inspectionCode} - DALIAudit`,
      inspection,
      categories
    });
  } catch (error) {
    console.error("Error opening checklist:", error);
    req.flash("error_msg", "Failed to open inspection checklist.");
    res.redirect("/inspector/dashboard");
  }
};

// Submit Inspection Checklist (Figure 7: ChecklistEngine, FindingRecorder, EvidenceManager)
export const submitInspectionResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = await Inspection.findByPk(id, {
      include: [{ model: Store, as: "store" }]
    });

    if (!inspection) {
      req.flash("error_msg", "Inspection record not found.");
      return res.redirect("/inspector/dashboard");
    }

    const checklistItems = await ChecklistItem.findAll({ where: { isActive: true } });
    let totalPossibleWeight = 0;
    let earnedWeight = 0;
    let noncompliantFindings = [];

    // Clear previous responses/findings if re-submitting in InProgress
    await InspectionResponse.destroy({ where: { inspectionId: id } });

    for (const item of checklistItems) {
      const resultKey = `result_${item.id}`;
      const remarksKey = `remarks_${item.id}`;
      const findingTitleKey = `finding_title_${item.id}`;
      const findingSeverityKey = `finding_severity_${item.id}`;

      const result = req.body[resultKey] || "Compliant";
      const remarks = req.body[remarksKey] || "";

      let scoreAwarded = 0;
      if (result === "Compliant") {
        scoreAwarded = item.weight;
        earnedWeight += item.weight;
        totalPossibleWeight += item.weight;
      } else if (result === "Noncompliant") {
        totalPossibleWeight += item.weight;
        // Noncompliant! Record finding
        noncompliantFindings.push({
          itemId: item.id,
          title: req.body[findingTitleKey] || `Violation: ${item.requirement}`,
          severity: req.body[findingSeverityKey] || item.criticality || "Major",
          description: remarks || `Failure to satisfy sanitation standard: ${item.requirement}`
        });
      }

      await InspectionResponse.create({
        inspectionId: inspection.id,
        itemId: item.id,
        result,
        remarks,
        scoreAwarded
      });
    }

    // ChecklistEngine: Calculate weighted score
    const finalScore = totalPossibleWeight > 0 
      ? Math.round((earnedWeight / totalPossibleWeight) * 100) 
      : 100;

    // Handle uploaded evidence photos
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await Evidence.create({
          inspectionId: inspection.id,
          filePath: `/uploads/${file.filename}`,
          fileName: file.originalname,
          fileType: file.mimetype,
          caption: req.body.evidenceCaption || "Sanitation inspection evidence photo",
          stage: "Inspection",
          uploadedBy: req.session.userId
        });
      }
    }

    // FindingRecorder & State Machine Transition
    const hasViolations = noncompliantFindings.length > 0;

    if (hasViolations) {
      // Create findings and corrective actions
      for (const nf of noncompliantFindings) {
        const finding = await Finding.create({
          inspectionId: inspection.id,
          itemId: nf.itemId,
          severity: nf.severity,
          title: nf.title,
          description: nf.description,
          deadline: new Date(Date.now() + (nf.severity === "Critical" ? 2 : 5) * 86400000),
          status: "Open"
        });

        // Find store representative for this store
        const storeRep = await User.findOne({ 
          where: { role: "STORE_REP", storeId: inspection.storeId } 
        });

        await CorrectiveAction.create({
          findingId: finding.id,
          inspectionId: inspection.id,
          storeId: inspection.storeId,
          assignedToRepId: storeRep ? storeRep.id : null,
          dueDate: finding.deadline,
          status: "Pending",
          actionPlan: `Immediate remediation required for ${nf.title}.`
        });
      }

      inspection.status = "Noncompliant";
      inspection.passed = false;
      inspection.findingsCount = noncompliantFindings.length;

      // Update store compliance status
      await Store.update(
        { 
          complianceStatus: "Noncompliant", 
          overallRating: finalScore,
          lastInspectionDate: new Date()
        },
        { where: { id: inspection.storeId } }
      );
    } else {
      inspection.status = "Compliant";
      inspection.passed = true;
      inspection.findingsCount = 0;

      // Update store compliance status
      await Store.update(
        { 
          complianceStatus: "Compliant", 
          overallRating: finalScore,
          lastInspectionDate: new Date()
        },
        { where: { id: inspection.storeId } }
      );
    }

    inspection.score = finalScore;
    inspection.earnedPoints = earnedWeight;
    inspection.totalPoints = totalPossibleWeight;
    inspection.completedAt = new Date();
    await inspection.save();

    // ReportGenerator: Generate compliance report
    const grade = finalScore >= 90 ? "Grade A - Excellent" 
                : finalScore >= 80 ? "Grade B - Satisfactory" 
                : finalScore >= 70 ? "Grade C - Needs Improvement" 
                : "Grade F - Unsatisfactory";

    const reportCount = await ComplianceReport.count();
    const reportCode = `REP-2026-${String(reportCount + 1).padStart(3, "0")}`;

    await ComplianceReport.create({
      reportCode,
      inspectionId: inspection.id,
      storeId: inspection.storeId,
      inspectorId: req.session.userId,
      summary: hasViolations 
        ? `Inspection finished with score of ${finalScore}%. ${noncompliantFindings.length} sanitation violations recorded requiring corrective action.`
        : `Inspection passed with outstanding score of ${finalScore}%. Full sanitation compliance observed across all food safety standards.`,
      finalScore,
      grade,
      status: hasViolations ? "Draft" : "Published",
      recommendations: hasViolations 
        ? "Branch manager must submit corrective action remediation proof before the deadline."
        : "Maintain existing store sanitation practices."
    });

    req.flash("success_msg", `Inspection ${inspection.inspectionCode} successfully evaluated! Final Score: ${finalScore}% (${inspection.status}).`);
    res.redirect(`/inspector/dashboard`);
  } catch (error) {
    console.error("Inspection submit error:", error);
    req.flash("error_msg", "Failed to submit inspection: " + error.message);
    res.redirect(`/inspector/conduct/${req.params.id}`);
  }
};

// Reinspection & Corrective Action Verification (REQ-6)
export const getVerifyAction = async (req, res) => {
  try {
    const { id } = req.params;
    const action = await CorrectiveAction.findByPk(id, {
      include: [
        { 
          model: Finding, 
          as: "finding",
          include: [{ model: ChecklistItem, as: "checklistItem" }]
        },
        { 
          model: Inspection, 
          as: "inspection",
          include: [{ model: Store, as: "store" }]
        },
        { model: Evidence, as: "evidences" },
        { model: User, as: "representative" }
      ]
    });

    if (!action) {
      req.flash("error_msg", "Corrective action not found.");
      return res.redirect("/inspector/dashboard");
    }

    res.render("inspector/verify", {
      title: `Verify Remediation - ${action.finding?.title}`,
      action
    });
  } catch (error) {
    req.flash("error_msg", "Error loading verification view.");
    res.redirect("/inspector/dashboard");
  }
};

export const submitVerificationDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, feedback } = req.body;
    const action = await CorrectiveAction.findByPk(id, {
      include: [
        { model: Finding, as: "finding" },
        { model: Inspection, as: "inspection" },
        { model: Store, as: "store" }
      ]
    });

    if (!action) {
      req.flash("error_msg", "Corrective action not found.");
      return res.redirect("/inspector/dashboard");
    }

    if (decision === "APPROVE") {
      action.status = "Verified";
      action.verifiedAt = new Date();
      action.verifiedBy = req.session.userId;
      action.inspectorFeedback = feedback || "Remediation verified and confirmed compliant upon reinspection.";
      await action.save();

      // Update finding
      if (action.finding) {
        action.finding.status = "Closed";
        await action.finding.save();
      }

      // Check if all actions for this inspection are verified
      const remainingUnverified = await CorrectiveAction.count({
        where: {
          inspectionId: action.inspectionId,
          status: ["Pending", "Submitted", "Rejected"]
        }
      });

      if (remainingUnverified === 0) {
        // All actions verified! Transition inspection to Compliant & Closed
        action.inspection.status = "Closed";
        action.inspection.passed = true;
        await action.inspection.save();

        // Update Store
        await Store.update(
          { complianceStatus: "Compliant" },
          { where: { id: action.storeId } }
        );

        // Update ComplianceReport to Published
        await ComplianceReport.update(
          { status: "Published", summary: "All corrective actions successfully remediated and verified upon reinspection. Store is certified compliant." },
          { where: { inspectionId: action.inspectionId } }
        );
      }

      req.flash("success_msg", "Corrective action verified! Inspection and store compliance updated.");
    } else {
      // Reject
      action.status = "Rejected";
      action.inspectorFeedback = feedback || "Submitted remediation does not meet required sanitation standards. Please resubmit.";
      await action.save();

      if (action.finding) {
        action.finding.status = "Open";
        await action.finding.save();
      }

      req.flash("error_msg", "Remediation rejected. Store representative notified for re-work.");
    }

    res.redirect("/inspector/dashboard");
  } catch (error) {
    console.error("Verification decision error:", error);
    req.flash("error_msg", "Failed to process verification decision.");
    res.redirect("/inspector/dashboard");
  }
};
