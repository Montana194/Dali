import crypto from "node:crypto";
import { User } from "../models/index.js";

export async function loadShopUser(req, res, next) {
  try {
    req.shopUser = req.session.userId
      ? await User.findByPk(req.session.userId)
      : null;

    if (!req.session.shopToken) {
      req.session.shopToken = crypto.randomBytes(32).toString("hex");
    }

    const plainUser = req.shopUser ? req.shopUser.get({ plain: true }) : null;
    if (plainUser) {
      plainUser.role = (plainUser.role || "visitors").toLowerCase();
      plainUser.name = plainUser.name || plainUser.fullName;
    }

    res.locals.shopToken = req.session.shopToken;
    res.locals.csrfToken = req.session.shopToken;
    res.locals.shopUser = plainUser;
    res.locals.user = plainUser;
    res.locals.currentUser = plainUser;
    res.locals.isAdmin = plainUser?.role === "admin";
    res.locals.isInspector = plainUser?.role === "inspector" || plainUser?.role === "staff";
    res.locals.isStoreRep = plainUser?.role === "store_rep" || plainUser?.role === "visitors";

    res.locals.success_msg = req.flash("success_msg");
    res.locals.error_msg = req.flash("error_msg");

    next();
  } catch (error) {
    next(error);
  }
}

export function requireLogin(req, res, next) {
  if (!req.shopUser) {
    req.flash("error_msg", "Please sign in to access this page.");
    return res.redirect("/account/login");
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.shopUser) {
    return res.redirect("/account/login");
  }
  const role = (req.shopUser.role || "").toLowerCase();
  if (role !== "admin") {
    return res.status(403).send("Only administrators can access this page.");
  }
  next();
}

export function requireInspector(req, res, next) {
  if (!req.shopUser) {
    return res.redirect("/account/login");
  }
  const role = (req.shopUser.role || "").toLowerCase();
  if (role !== "inspector" && role !== "staff" && role !== "admin") {
    return res.status(403).send("Only sanitation inspectors can access this page.");
  }
  next();
}

export function requireStoreRep(req, res, next) {
  if (!req.shopUser) {
    return res.redirect("/account/login");
  }
  const role = (req.shopUser.role || "").toLowerCase();
  if (role !== "store_rep" && role !== "visitors" && role !== "admin") {
    return res.status(403).send("Only store representatives can access this page.");
  }
  next();
}

export function verifyShopToken(req, res, next) {
  const token = req.body._csrf;
  if (typeof token !== "string" || token !== req.session.shopToken) {
    return res.status(403).send("Invalid form token. Reload the page.");
  }
  next();
}

// Aliases matching act9
export const verifyToken = verifyShopToken;
export const loadUser = loadShopUser;
export const requireAuth = requireLogin;
