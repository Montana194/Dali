import { 
  Store, 
  Inspection, 
  Finding, 
  CorrectiveAction, 
  Evidence, 
  ChecklistItem, 
  ComplianceReport, 
  User 
} from "../models/index.js";

// Store Dashboard
export const getStoreDashboard = async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    const allStores = await Store.findAll({ order: [["name", "ASC"]] });

    // Find store linked to user, or fallback to first store
    let store = null;
    const hasAssignedBranch = Boolean(user && user.storeId);

    if (hasAssignedBranch) {
      store = await Store.findByPk(user.storeId);
    }
    if (!store && allStores.length > 0) {
      store = allStores[0];
    }

    if (!store) {
      req.flash("error_msg", "No store branches registered yet. Please contact an administrator.");
      return res.redirect("/account/login");
    }

    const inspections = await Inspection.findAll({
      where: { storeId: store.id },
      order: [["createdAt", "DESC"]],
      include: [
        { model: User, as: "inspector" },
        { model: Finding, as: "findings" },
        { model: ComplianceReport, as: "report" }
      ]
    });

    const correctiveActions = await CorrectiveAction.findAll({
      where: { storeId: store.id },
      order: [["dueDate", "ASC"]],
      include: [
        { 
          model: Finding, 
          as: "finding",
          include: [{ model: ChecklistItem, as: "checklistItem" }]
        },
        { model: Evidence, as: "evidences" },
        { model: Inspection, as: "inspection" }
      ]
    });

    const pendingActions = correctiveActions.filter(a => ["Pending", "Rejected"].includes(a.status));
    const submittedActions = correctiveActions.filter(a => a.status === "Submitted");
    const verifiedActions = correctiveActions.filter(a => a.status === "Verified");

    res.render("store/dashboard", {
      title: `Store Portal - ${store.name}`,
      store,
      user,
      allStores,
      hasAssignedBranch,
      inspections,
      correctiveActions,
      pendingActions,
      submittedActions,
      verifiedActions
    });
  } catch (error) {
    console.error("Store dashboard error:", error);
    req.flash("error_msg", "Failed to load store dashboard.");
    res.redirect("/account/login");
  }
};

// Select or Switch Store Branch for Store Rep
export const selectBranch = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      req.flash("error_msg", "Please select a branch from the list.");
      return res.redirect("/store");
    }

    const store = await Store.findByPk(storeId);
    if (!store) {
      req.flash("error_msg", "Selected store branch was not found.");
      return res.redirect("/store");
    }

    await User.update({ storeId: parseInt(storeId) }, { where: { id: req.session.userId } });
    req.flash("success_msg", `Assigned branch updated to ${store.name} (${store.code})!`);
    res.redirect("/store");
  } catch (error) {
    console.error("Select branch error:", error);
    req.flash("error_msg", "Failed to update assigned branch.");
    res.redirect("/store");
  }
};

// View Corrective Action & Submit Form (REQ-5)
export const getActionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const action = await CorrectiveAction.findByPk(id, {
      include: [
        { 
          model: Finding, 
          as: "finding",
          include: [
            { model: ChecklistItem, as: "checklistItem" },
            { model: Evidence, as: "evidences" }
          ]
        },
        { 
          model: Inspection, 
          as: "inspection",
          include: [{ model: User, as: "inspector" }]
        },
        { model: Store, as: "store" },
        { model: Evidence, as: "evidences" }
      ]
    });

    if (!action) {
      req.flash("error_msg", "Action item not found.");
      return res.redirect("/store/dashboard");
    }

    res.render("store/action-detail", {
      title: `Remediate Finding - ${action.finding?.title}`,
      action
    });
  } catch (error) {
    console.error("Error loading action detail:", error);
    req.flash("error_msg", "Failed to load corrective action details.");
    res.redirect("/store/dashboard");
  }
};

// Submit Corrective Action with Evidence (REQ-5)
export const submitActionCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionPlan, remediationNotes } = req.body;

    const action = await CorrectiveAction.findByPk(id, {
      include: [
        { model: Finding, as: "finding" },
        { model: Inspection, as: "inspection" }
      ]
    });

    if (!action) {
      req.flash("error_msg", "Corrective action not found.");
      return res.redirect("/store/dashboard");
    }

    action.actionPlan = actionPlan;
    action.remediationNotes = remediationNotes;
    action.status = "Submitted";
    action.submittedAt = new Date();
    await action.save();

    // Update finding status
    if (action.finding) {
      action.finding.status = "In Remediation";
      await action.finding.save();
    }

    // Update inspection status to ActionSubmitted
    if (action.inspection) {
      action.inspection.status = "ActionSubmitted";
      await action.inspection.save();
    }

    // Handle uploaded remediation photos
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await Evidence.create({
          inspectionId: action.inspectionId,
          findingId: action.findingId,
          actionId: action.id,
          filePath: `/uploads/${file.filename}`,
          fileName: file.originalname,
          fileType: file.mimetype,
          caption: req.body.caption || "Store remediation proof photo",
          stage: "Remediation",
          uploadedBy: req.session.userId
        });
      }
    }

    req.flash("success_msg", "Corrective action proof submitted successfully! Assigned inspector has been notified for reinspection verification.");
    res.redirect("/store/dashboard");
  } catch (error) {
    console.error("Error submitting corrective action:", error);
    req.flash("error_msg", "Failed to submit corrective action: " + error.message);
    res.redirect(`/store/actions/${req.params.id}`);
  }
};
