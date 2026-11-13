import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// User Model
export const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fullName: { type: DataTypes.STRING, allowNull: false },
  name: { 
    type: DataTypes.VIRTUAL,
    get() {
      return this.fullName;
    },
    set(value) {
      this.setDataValue('fullName', value);
    }
  },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { 
    type: DataTypes.STRING(50), 
    allowNull: false, 
    defaultValue: "visitors" 
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "APPROVED"
  },
  storeId: { type: DataTypes.INTEGER, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  badgeNumber: { type: DataTypes.STRING, allowNull: true }
});

// Store Model
export const Store = sequelize.define("Store", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, defaultValue: "Metro Manila" },
  region: { type: DataTypes.STRING, defaultValue: "NCR" },
  managerName: { type: DataTypes.STRING, allowNull: true },
  contactPhone: { type: DataTypes.STRING, allowNull: true },
  complianceStatus: { 
    type: DataTypes.ENUM("Compliant", "Action Pending", "Noncompliant", "Under Review", "For Inspection"),
    defaultValue: "For Inspection" 
  },
  overallRating: { type: DataTypes.INTEGER, defaultValue: 100 },
  lastInspectionDate: { type: DataTypes.DATE, allowNull: true },
  stockBranchCode: { type: DataTypes.STRING, allowNull: true }
});

// ChecklistItem Model
export const ChecklistItem = sequelize.define("ChecklistItem", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING, allowNull: false },
  requirement: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  weight: { type: DataTypes.INTEGER, defaultValue: 10 },
  criticality: { 
    type: DataTypes.ENUM("Minor", "Major", "Critical"), 
    defaultValue: "Major" 
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

// Inspection Model
export const Inspection = sequelize.define("Inspection", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inspectionCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  storeId: { type: DataTypes.INTEGER, allowNull: false },
  inspectorId: { type: DataTypes.INTEGER, allowNull: false },
  scheduledDate: { type: DataTypes.DATE, allowNull: true },
  inspectionDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: { 
    type: DataTypes.ENUM(
      "Scheduled", 
      "InProgress", 
      "Submitted", 
      "UnderReview", 
      "Noncompliant", 
      "ActionPending", 
      "ActionSubmitted", 
      "Reinspection", 
      "Compliant", 
      "Closed"
    ),
    defaultValue: "Scheduled" 
  },
  score: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalPoints: { type: DataTypes.INTEGER, defaultValue: 100 },
  earnedPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
  passed: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  findingsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  stockBranchCode: { type: DataTypes.STRING, allowNull: true },
  stockSku: { type: DataTypes.STRING, allowNull: true },
  stockProductName: { type: DataTypes.STRING, allowNull: true }
});

// InspectionResponse Model
export const InspectionResponse = sequelize.define("InspectionResponse", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inspectionId: { type: DataTypes.INTEGER, allowNull: false },
  itemId: { type: DataTypes.INTEGER, allowNull: false },
  result: { 
    type: DataTypes.ENUM("Compliant", "Noncompliant", "N/A"), 
    defaultValue: "Compliant" 
  },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  scoreAwarded: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Finding Model
export const Finding = sequelize.define("Finding", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inspectionId: { type: DataTypes.INTEGER, allowNull: false },
  responseId: { type: DataTypes.INTEGER, allowNull: true },
  itemId: { type: DataTypes.INTEGER, allowNull: true },
  severity: { 
    type: DataTypes.ENUM("Minor", "Major", "Critical"), 
    defaultValue: "Major" 
  },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  deadline: { type: DataTypes.DATE, allowNull: true },
  stockSku: { type: DataTypes.STRING, allowNull: true },
  stockProductName: { type: DataTypes.STRING, allowNull: true },
  status: { 
    type: DataTypes.ENUM("Open", "In Remediation", "Submitted", "Verified", "Closed"), 
    defaultValue: "Open" 
  }
});

// CorrectiveAction Model
export const CorrectiveAction = sequelize.define("CorrectiveAction", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  findingId: { type: DataTypes.INTEGER, allowNull: false },
  inspectionId: { type: DataTypes.INTEGER, allowNull: false },
  storeId: { type: DataTypes.INTEGER, allowNull: false },
  assignedToRepId: { type: DataTypes.INTEGER, allowNull: true },
  dueDate: { type: DataTypes.DATE, allowNull: true },
  actionPlan: { type: DataTypes.TEXT, allowNull: true },
  remediationNotes: { type: DataTypes.TEXT, allowNull: true },
  status: { 
    type: DataTypes.ENUM("Pending", "Submitted", "Under Review", "Verified", "Rejected"), 
    defaultValue: "Pending" 
  },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  verifiedBy: { type: DataTypes.INTEGER, allowNull: true },
  inspectorFeedback: { type: DataTypes.TEXT, allowNull: true }
});

// Evidence Model
export const Evidence = sequelize.define("Evidence", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  inspectionId: { type: DataTypes.INTEGER, allowNull: true },
  responseId: { type: DataTypes.INTEGER, allowNull: true },
  findingId: { type: DataTypes.INTEGER, allowNull: true },
  actionId: { type: DataTypes.INTEGER, allowNull: true },
  filePath: { type: DataTypes.STRING, allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: true },
  fileType: { type: DataTypes.STRING, defaultValue: "image/jpeg" },
  caption: { type: DataTypes.STRING, allowNull: true },
  stage: { 
    type: DataTypes.ENUM("Inspection", "Remediation", "Reinspection"), 
    defaultValue: "Inspection" 
  },
  uploadedBy: { type: DataTypes.INTEGER, allowNull: true }
});

// ComplianceReport Model
export const ComplianceReport = sequelize.define("ComplianceReport", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reportCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  inspectionId: { type: DataTypes.INTEGER, allowNull: false },
  storeId: { type: DataTypes.INTEGER, allowNull: false },
  inspectorId: { type: DataTypes.INTEGER, allowNull: false },
  generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  summary: { type: DataTypes.TEXT, allowNull: true },
  finalScore: { type: DataTypes.FLOAT, defaultValue: 0 },
  grade: { type: DataTypes.STRING, defaultValue: "Grade B" },
  status: { 
    type: DataTypes.ENUM("Draft", "Published", "Archived"), 
    defaultValue: "Draft" 
  },
  recommendations: { type: DataTypes.TEXT, allowNull: true }
});

// Relationships
// Store <-> Inspection
Store.hasMany(Inspection, { foreignKey: "storeId", as: "inspections" });
Inspection.belongsTo(Store, { foreignKey: "storeId", as: "store" });

// User <-> Store
Store.hasMany(User, { foreignKey: "storeId", as: "representatives" });
User.belongsTo(Store, { foreignKey: "storeId", as: "store" });

// User <-> Inspection (Inspector)
User.hasMany(Inspection, { foreignKey: "inspectorId", as: "inspections" });
Inspection.belongsTo(User, { foreignKey: "inspectorId", as: "inspector" });

// Inspection <-> InspectionResponse
Inspection.hasMany(InspectionResponse, { foreignKey: "inspectionId", as: "responses" });
InspectionResponse.belongsTo(Inspection, { foreignKey: "inspectionId", as: "inspection" });

// ChecklistItem <-> InspectionResponse
ChecklistItem.hasMany(InspectionResponse, { foreignKey: "itemId", as: "responses" });
InspectionResponse.belongsTo(ChecklistItem, { foreignKey: "itemId", as: "checklistItem" });

// Inspection <-> Finding
Inspection.hasMany(Finding, { foreignKey: "inspectionId", as: "findings" });
Finding.belongsTo(Inspection, { foreignKey: "inspectionId", as: "inspection" });

// ChecklistItem <-> Finding
ChecklistItem.hasMany(Finding, { foreignKey: "itemId", as: "findings" });
Finding.belongsTo(ChecklistItem, { foreignKey: "itemId", as: "checklistItem" });

// Finding <-> CorrectiveAction (1 to 1)
Finding.hasOne(CorrectiveAction, { foreignKey: "findingId", as: "correctiveAction" });
CorrectiveAction.belongsTo(Finding, { foreignKey: "findingId", as: "finding" });

// Inspection <-> CorrectiveAction
Inspection.hasMany(CorrectiveAction, { foreignKey: "inspectionId", as: "actions" });
CorrectiveAction.belongsTo(Inspection, { foreignKey: "inspectionId", as: "inspection" });

// Store <-> CorrectiveAction
Store.hasMany(CorrectiveAction, { foreignKey: "storeId", as: "actions" });
CorrectiveAction.belongsTo(Store, { foreignKey: "storeId", as: "store" });

// User (Store Rep) <-> CorrectiveAction
User.hasMany(CorrectiveAction, { foreignKey: "assignedToRepId", as: "assignedActions" });
CorrectiveAction.belongsTo(User, { foreignKey: "assignedToRepId", as: "representative" });

// Evidence links
Inspection.hasMany(Evidence, { foreignKey: "inspectionId", as: "evidences" });
Evidence.belongsTo(Inspection, { foreignKey: "inspectionId", as: "inspection" });

Finding.hasMany(Evidence, { foreignKey: "findingId", as: "evidences" });
Evidence.belongsTo(Finding, { foreignKey: "findingId", as: "finding" });

CorrectiveAction.hasMany(Evidence, { foreignKey: "actionId", as: "evidences" });
Evidence.belongsTo(CorrectiveAction, { foreignKey: "actionId", as: "action" });

Evidence.belongsTo(User, { foreignKey: "uploadedBy", as: "uploader" });

// Inspection <-> ComplianceReport (1 to 1)
Inspection.hasOne(ComplianceReport, { foreignKey: "inspectionId", as: "report" });
ComplianceReport.belongsTo(Inspection, { foreignKey: "inspectionId", as: "inspection" });
ComplianceReport.belongsTo(Store, { foreignKey: "storeId", as: "store" });
ComplianceReport.belongsTo(User, { foreignKey: "inspectorId", as: "inspector" });

export { sequelize };
