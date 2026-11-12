import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { User, Store } from "../models/index.js";

const roles = [
  { value: "admin", label: "Administrator (Full System Governance)" },
  { value: "inspector", label: "Sanitation Inspector / Staff (Field Audits)" },
  { value: "store_rep", label: "Store Representative (Branch Compliance)" }
];

const validId = (value) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

const safeUser = (user) => ({
  id: user.id,
  name: user.fullName || user.name,
  fullName: user.fullName || user.name,
  email: user.email,
  role: (user.role || "visitors").toLowerCase(),
  storeId: user.storeId,
  phone: user.phone,
  badgeNumber: user.badgeNumber
});

async function renderUserForm(res, values, editing = false, error = null, status = 200, isSelf = false) {
  const stores = await Store.findAll({ order: [["name", "ASC"]] });
  return res.status(status).render("admin-user-form", {
    title: editing ? "Edit User - DALIAudit" : "Add User - DALIAudit",
    editing,
    values,
    error,
    isSelf,
    stores,
    roles: roles.map(r => ({
      ...r,
      selected: (values.role || "").toLowerCase() === r.value
    }))
  });
}

// GET /admin/users
export async function adminUsers(req, res) {
  const users = await User.findAll({
    order: [["id", "DESC"]],
    include: [{ model: Store, as: "store", required: false }]
  });

  const stores = await Store.findAll({ order: [["name", "ASC"]] });
  const currentAdminId = req.shopUser?.id || req.user?.id || req.session?.userId;

  const pendingUsers = [];
  const activeUsers = [];

  users.forEach(user => {
    const plain = user.get({ plain: true });
    const normalizedRole = (plain.role || "visitors").toLowerCase();
    const isSelf = plain.id === currentAdminId;
    const isAdminAccount = normalizedRole === "admin" || isSelf;
    const isPending = (plain.status || "").toUpperCase() === "PENDING" || normalizedRole === "pending";

    const roleLabel = normalizedRole === "admin" ? "Administrator"
                    : (normalizedRole === "inspector" || normalizedRole === "staff") ? "Sanitation Inspector"
                    : normalizedRole === "store_rep" ? "Store Representative"
                    : normalizedRole.toUpperCase();

    const rolePillClass = normalizedRole === "admin" ? "role-pill-admin"
                        : (normalizedRole === "inspector" || normalizedRole === "staff") ? "role-pill-inspector"
                        : normalizedRole === "store_rep" ? "role-pill-store"
                        : "";

    const initial = (plain.fullName || plain.email || "U").trim().charAt(0).toUpperCase();

    const formatted = {
      ...plain,
      role: normalizedRole,
      roleLabel,
      rolePillClass,
      initial,
      isSelf,
      isAdminAccount,
      isPending
    };

    if (isPending) {
      pendingUsers.push(formatted);
    } else {
      activeUsers.push(formatted);
    }
  });

  res.render("admin-users", {
    title: "User Accounts & Role-Based Access - DALIAudit",
    users: activeUsers,
    pendingUsers,
    pendingCount: pendingUsers.length,
    stores
  });
}

// GET /admin/users/create
export async function addUserPage(req, res) {
  return renderUserForm(res, { role: "store_rep" });
}

// GET /admin/users/:userId/edit
export async function editUserPage(req, res) {
  if (!validId(req.params.userId)) return res.status(400).send("Invalid user ID.");
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).send("User not found.");

  const currentAdminId = req.shopUser?.id || req.user?.id || req.session?.userId;
  const isSelf = user.id === currentAdminId;
  const isProtectedAdmin = isSelf || (user.role || "").toLowerCase() === "admin";

  if (isProtectedAdmin) {
    req.flash("error_msg", "Administrator accounts are protected and cannot be edited.");
    return res.redirect("/admin/users");
  }

  return renderUserForm(res, safeUser(user), true, null, 200, false);
}

// POST /admin/users or POST /admin/users/:userId/edit
export async function saveUser(req, res) {
  const editing = req.params.userId !== undefined;
  if (editing && !validId(req.params.userId)) return res.status(400).send("Invalid user ID.");

  const user = editing ? await User.findByPk(req.params.userId) : null;
  if (editing && !user) return res.status(404).send("User not found.");

  const currentAdminId = req.shopUser?.id || req.user?.id || req.session?.userId;
  const isSelf = Boolean(editing && user && currentAdminId && user.id === currentAdminId);
  const values = {
    id: user?.id,
    name: typeof req.body.name === "string" ? req.body.name.trim() : (req.body.fullName || "").trim(),
    fullName: typeof req.body.name === "string" ? req.body.name.trim() : (req.body.fullName || "").trim(),
    email: typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "",
    role: typeof req.body.role === "string" ? req.body.role.toLowerCase() : "store_rep",
    storeId: req.body.storeId ? parseInt(req.body.storeId) : null,
    phone: req.body.phone ? req.body.phone.trim() : null,
    badgeNumber: req.body.badgeNumber ? req.body.badgeNumber.trim() : null
  };

  const password = typeof req.body.password === "string" ? req.body.password : "";
  const fail = (message) => renderUserForm(res, values, editing, message, 400, isSelf);

  if (!values.fullName || values.fullName.length > 120) {
    return fail("Enter a full name of 1–120 characters.");
  }
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return fail("Enter a valid email address.");
  }
  if (!["admin", "inspector", "store_rep", "staff", "visitors"].includes(values.role)) {
    return fail("Select a valid role.");
  }
  if (isSelf && values.role !== "admin") {
    return fail("You cannot remove your own administrator access.");
  }
  if ((!editing || password) && (password.length < 6 || Buffer.byteLength(password, "utf8") > 72)) {
    return fail("Password must contain at least 6 characters and use at most 72 bytes.");
  }

  // Check duplicate email
  const duplicate = await User.findOne({
    where: {
      email: values.email,
      ...(editing ? { id: { [Op.ne]: user.id } } : {})
    }
  });
  if (duplicate) return fail("That email address is already in use.");

  const data = {
    fullName: values.fullName,
    email: values.email,
    role: values.role,
    status: editing ? (user.status || "APPROVED") : "APPROVED",
    storeId: values.role === "store_rep" ? values.storeId : null,
    phone: values.phone,
    badgeNumber: values.role === "inspector" ? (values.badgeNumber || `INS-${Date.now().toString().slice(-4)}`) : null
  };

  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    if (editing) {
      await user.update(data);
      req.flash("success_msg", "User account updated successfully.");
    } else {
      await User.create(data);
      req.flash("success_msg", "New user registered successfully.");
    }
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Save user error:", error);
    return fail("Failed to save user: " + error.message);
  }
}

// POST /admin/users/:userId/delete
export async function deleteUser(req, res) {
  if (!validId(req.params.userId)) return res.status(400).send("Invalid user ID.");
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).send("User not found.");

  const currentAdminId = req.shopUser?.id || req.user?.id || req.session?.userId;
  const isProtectedAdmin = (currentAdminId && user.id === currentAdminId) || (user.role || "").toLowerCase() === "admin";
  if (isProtectedAdmin) {
    req.flash("error_msg", "Administrator accounts are protected and cannot be deleted.");
    return res.redirect("/admin/users");
  }

  await user.destroy();
  req.flash("success_msg", `User "${user.fullName}" deleted successfully.`);
  res.redirect("/admin/users");
}

// POST /admin/users/:userId/approve
export async function approveUser(req, res) {
  if (!validId(req.params.userId)) return res.status(400).send("Invalid user ID.");
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).send("User not found.");

  const { role, storeId } = req.body;
  const assignedRole = (role || "store_rep").toLowerCase();
  if (!["admin", "inspector", "store_rep", "staff"].includes(assignedRole)) {
    req.flash("error_msg", "Please select a valid role to assign.");
    return res.redirect("/admin/users");
  }

  const friendlyRole = assignedRole === "admin" ? "Administrator"
                     : (assignedRole === "inspector" || assignedRole === "staff") ? "Sanitation Inspector"
                     : "Store Representative";

  await user.update({
    role: assignedRole,
    status: "APPROVED",
    storeId: assignedRole === "store_rep" && storeId ? parseInt(storeId) : null,
    badgeNumber: (assignedRole === "inspector" || assignedRole === "staff") ? (user.badgeNumber || `INS-${Date.now().toString().slice(-4)}`) : null
  });

  req.flash("success_msg", `Confirmed registration for "${user.fullName}" and assigned role as ${friendlyRole}. The user can now sign in.`);
  res.redirect("/admin/users");
}

// POST /admin/users/:userId/reject
export async function rejectUser(req, res) {
  if (!validId(req.params.userId)) return res.status(400).send("Invalid user ID.");
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).send("User not found.");

  const name = user.fullName;
  await user.destroy();
  req.flash("success_msg", `Pending registration for "${name}" was rejected and removed.`);
  res.redirect("/admin/users");
}
