import express from "express";
import {
  loadShopUser,
  requireLogin,
  requireAdmin,
  requireInspector,
  requireStoreRep,
  verifyShopToken,
} from "../middleware/shopAuth.js";
import { homePage } from "../controllers/homeController.js";
import {
  adminDashboard,
  getStores,
  createStore,
  updateStore,
  getChecklists,
  createChecklistItem,
  getSchedulePage,
  createInspectionSchedule,
  getAllInspections,
  getIntegrationsPage,
  testStockConnection,
  testPosConnection,
} from "../controllers/adminController.js";
import {
  adminUsers,
  addUserPage,
  editUserPage,
  saveUser,
  deleteUser,
  approveUser,
  rejectUser,
} from "../controllers/adminUserController.js";
import {
  loginPage,
  registerPage,
  forgotPasswordPage,
  dashboardPage,
  loginUser,
  quickLogin,
  registerUser,
  logoutUser,
} from "../controllers/authController.js";
import {
  getInspectorDashboard,
  getConductInspection,
  submitInspectionResponses,
  getVerifyAction,
  submitVerificationDecision,
} from "../controllers/inspectorController.js";
import {
  getStoreDashboard,
  getActionDetail,
  submitActionCorrection,
  selectBranch,
} from "../controllers/storeController.js";
import {
  getReportsList,
  viewReport,
  getReportModalContent,
  generateReportForInspection,
} from "../controllers/reportController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Global session loader & CSRF token setup (matching act9)
router.use(loadShopUser);

// Authentication Routes (matching act9)
router.get("/login", (req, res) => res.redirect("/account/login"));
router.get("/account/login", loginPage);
router.post("/login", asyncRoute(loginUser));
router.get("/register", registerPage);
router.post("/register", asyncRoute(registerUser));
router.get("/forgot-password", forgotPasswordPage);
router.get("/dashboard", dashboardPage);
router.get("/logout", logoutUser);
router.post("/logout", requireLogin, verifyShopToken, logoutUser);

// Home Route
router.get("/", (req, res, next) => {
  if (req.shopUser?.role === "admin") return res.redirect("/admin");
  if (req.shopUser?.role === "inspector" || req.shopUser?.role === "staff") return res.redirect("/inspector");
  if (req.shopUser?.role === "store_rep") return res.redirect("/store");
  next();
}, asyncRoute(homePage));

// -------------------------------------------------------------
// Admin Portal (/admin/*) - requireLogin, requireAdmin (matching act9)
// -------------------------------------------------------------
router.use("/admin", requireLogin, requireAdmin);
router.get("/admin", asyncRoute(adminDashboard));
router.get("/admin/dashboard", (req, res) => res.redirect("/admin"));

// User Management (exact act9 pattern)
router.get("/admin/users", asyncRoute(adminUsers));
router.get("/admin/users/create", addUserPage);
router.post("/admin/users", verifyShopToken, asyncRoute(saveUser));
router.post("/admin/users/:userId/approve", verifyShopToken, asyncRoute(approveUser));
router.post("/admin/users/:userId/reject", verifyShopToken, asyncRoute(rejectUser));
router.get("/admin/users/:userId/edit", asyncRoute(editUserPage));
router.post("/admin/users/:userId/edit", verifyShopToken, asyncRoute(saveUser));
router.post("/admin/users/:userId/delete", verifyShopToken, asyncRoute(deleteUser));

// Store Registry (REQ-1)
router.get("/admin/stores", asyncRoute(getStores));
router.post("/admin/stores", verifyShopToken, asyncRoute(createStore));
router.post("/admin/stores/:id/edit", verifyShopToken, asyncRoute(updateStore));

// Checklist Management (REQ-3)
router.get("/admin/checklists", asyncRoute(getChecklists));
router.post("/admin/checklists", verifyShopToken, asyncRoute(createChecklistItem));

// Schedule Inspections (REQ-2)
router.get("/admin/schedule", asyncRoute(getSchedulePage));
router.post("/admin/schedule", verifyShopToken, asyncRoute(createInspectionSchedule));

// Inspections Tracker & Reports (REQ-7)
router.get("/admin/inspections", asyncRoute(getAllInspections));
router.get("/admin/reports", asyncRoute(getReportsList));
router.post("/admin/reports/generate/:inspectionId", verifyShopToken, asyncRoute(generateReportForInspection));

// DALIStock & DALI POS Integration Settings
router.get("/admin/integrations", asyncRoute(getIntegrationsPage));
router.post("/admin/integrations/test-stock", verifyShopToken, asyncRoute(testStockConnection));
router.post("/admin/integrations/test-pos", verifyShopToken, asyncRoute(testPosConnection));

// -------------------------------------------------------------
// Inspector Role Portal (/inspector/*) - requireLogin, requireInspector
// -------------------------------------------------------------
router.use("/inspector", requireLogin, requireInspector);
router.get("/inspector", asyncRoute(getInspectorDashboard));
router.get("/inspector/dashboard", (req, res) => res.redirect("/inspector"));
router.get("/inspector/conduct/:id", asyncRoute(getConductInspection));
router.post("/inspector/conduct/:id", upload.array("evidencePhotos", 5), asyncRoute(submitInspectionResponses));
router.get("/inspector/verify/:id", asyncRoute(getVerifyAction));
router.post("/inspector/verify/:id", verifyShopToken, asyncRoute(submitVerificationDecision));

// -------------------------------------------------------------
// Store Representative Role Portal (/store/*) - requireLogin, requireStoreRep
// -------------------------------------------------------------
router.use("/store", requireLogin, requireStoreRep);
router.get("/store", asyncRoute(getStoreDashboard));
router.get("/store/dashboard", (req, res) => res.redirect("/store"));
router.post("/store/select-branch", verifyShopToken, asyncRoute(selectBranch));
router.get("/store/actions/:id", asyncRoute(getActionDetail));
router.post("/store/actions/:id", upload.array("remediationPhotos", 5), asyncRoute(submitActionCorrection));

// -------------------------------------------------------------
// Compliance Reports & Certificates
// -------------------------------------------------------------
router.get("/reports", requireLogin, asyncRoute(getReportsList));
router.get("/reports/view/:id", requireLogin, asyncRoute(viewReport));
router.get("/reports/modal/:id", requireLogin, asyncRoute(getReportModalContent));

export default router;
