import bcrypt from "bcryptjs";
import { User, Store } from "../models/index.js";

export const loginPage = async (req, res) => {
  if (req.user) {
    const role = (req.user.role || "").toLowerCase();
    if (role === "admin") return res.redirect("/admin");
    if (role === "inspector" || role === "staff") return res.redirect("/inspector");
    return res.redirect("/store");
  }
  const stores = await Store.findAll();
  res.render("login", { 
    title: "Sign In - DALIAudit", 
    stores 
  });
};

export const registerPage = async (req, res) => {
  const stores = await Store.findAll({ order: [["name", "ASC"]] });
  res.render("register", { 
    title: "Create Account - DALIAudit", 
    stores 
  });
};

export const forgotPasswordPage = (req, res) => {
  res.render("forgotpassword", { title: "Forgot Password - DALIAudit" });
};

export const dashboardPage = (req, res) => {
  if (!req.user) return res.redirect("/account/login");
  const role = (req.user.role || "").toLowerCase();
  if (role === "admin") return res.redirect("/admin");
  if (role === "inspector" || role === "staff") return res.redirect("/inspector");
  return res.redirect("/store");
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: (email || "").trim().toLowerCase() } });
    if (!user) {
      req.flash("error_msg", "User account not found. Please verify your email.");
      return res.redirect("/account/login");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error_msg", "Incorrect password entered.");
      return res.redirect("/account/login");
    }

    // Check confirmation status
    const status = (user.status || "APPROVED").toUpperCase();
    const role = (user.role || "visitors").toLowerCase();

    if (status === "PENDING" || role === "pending") {
      req.flash(
        "error_msg",
        "Your account registration is awaiting Administrator confirmation and role assignment. Please wait for an administrator to approve your account before logging in."
      );
      return res.redirect("/account/login");
    }

    if (status === "REJECTED") {
      req.flash("error_msg", "Your registration was not approved. Please contact an administrator.");
      return res.redirect("/account/login");
    }

    req.session.userId = user.id;
    req.flash("success_msg", `Welcome, ${user.fullName}!`);

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
      }
      if (role === "admin") return res.redirect("/admin");
      if (role === "inspector" || role === "staff") return res.redirect("/inspector");
      return res.redirect("/store");
    });
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error_msg", "An unexpected error occurred during login.");
    res.redirect("/account/login");
  }
};

export const quickLogin = async (req, res) => {
  const { role } = req.params;
  try {
    let email = "admin@dali.ph";
    if (role === "inspector") email = "inspector@dali.ph";
    if (role === "store") email = "rep.alabang@dali.ph";

    const user = await User.findOne({ where: { email } });
    if (user) {
      req.session.userId = user.id;
      const normalizedRole = (user.role || "").toLowerCase();
      req.flash("success_msg", `Switched to ${user.fullName} (${user.role} role).`);
      return req.session.save(() => {
        if (normalizedRole === "admin") return res.redirect("/admin");
        if (normalizedRole === "inspector" || normalizedRole === "staff") return res.redirect("/inspector");
        return res.redirect("/store");
      });
    }
    res.redirect("/account/login");
  } catch (err) {
    console.error(err);
    res.redirect("/account/login");
  }
};

export const registerUser = async (req, res) => {
  try {
    const fullName = req.body.fullName || req.body.name;
    const { email, password, phone } = req.body;

    if (!fullName || !email || !password) {
      req.flash("error_msg", "Please provide your full name, email, and password.");
      return res.redirect("/register");
    }

    if (password.length < 6) {
      req.flash("error_msg", "Password must be at least 6 characters.");
      return res.redirect("/register");
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      req.flash("error_msg", "An account with this email address already exists.");
      return res.redirect("/register");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await User.count();
    const isFirstUser = userCount === 0;

    const assignedRole = isFirstUser ? "admin" : "pending";
    const assignedStatus = isFirstUser ? "APPROVED" : "PENDING";

    const user = await User.create({
      fullName: fullName.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: assignedRole,
      status: assignedStatus,
      phone: phone ? phone.trim() : null,
      badgeNumber: isFirstUser ? "ADM-001" : null
    });

    if (isFirstUser) {
      req.session.userId = user.id;
      req.flash("success_msg", "Initial Administrator account registered successfully!");
      return res.redirect("/admin");
    }

    // Normal registrant: not logged in yet, awaits admin approval & role assignment
    req.flash(
      "success_msg",
      "Registration submitted successfully! Your account is awaiting Administrator confirmation and role assignment before you can sign in."
    );
    return res.redirect("/account/login");
  } catch (error) {
    console.error("Register error:", error);
    req.flash("error_msg", "Failed to register account: " + error.message);
    res.redirect("/register");
  }
};

export const logoutUser = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};
