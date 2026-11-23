/*
    DALIAudit: Store Sanitation and Compliance Inspection Management System
    DALI Everyday Grocery Quality & Safety Assurance
*/

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import apiRouter from "./routes/api.js";
import fs from "fs";
import hbs from "hbs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import { loadShopUser } from "./middleware/shopAuth.js";
import { sequelize } from "./models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(process.cwd(), "public")));

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "daliaudit-secure-session-key-2026";
const sessionCookieName = process.env.SESSION_COOKIE_NAME || "daliaudit.sid";

app.use(
  session({
    name: sessionCookieName,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    }
  })
);
app.use(flash());
app.use(loadShopUser);

// Register Handlebars Helpers
hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("neq", (a, b) => a !== b);
hbs.registerHelper("gt", (a, b) => a > b);
hbs.registerHelper("gte", (a, b) => a >= b);
hbs.registerHelper("lt", (a, b) => a < b);
hbs.registerHelper("or", (a, b) => a || b);
hbs.registerHelper("and", (a, b) => a && b);
hbs.registerHelper("json", (context) => JSON.stringify(context));

hbs.registerHelper("formatDate", (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
});

hbs.registerHelper("formatDateTime", (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
});

// Human-readable labels for internal status codes
const STATUS_LABELS = {
  Scheduled: "Scheduled",
  InProgress: "In Progress",
  Compliant: "Compliant",
  Noncompliant: "Not Compliant",
  Closed: "Closed – Resolved",
  ActionPending: "Waiting for Store Fixes",
  ActionSubmitted: "Fixes Submitted",
  UnderReview: "Under Review",
  Submitted: "Submitted for Review",
  Pending: "Pending",
  Rejected: "Returned – Needs Rework",
  Verified: "Verified",
  Open: "Open",
  "In Remediation": "Being Fixed",
  "For Inspection": "Awaiting Inspection",
  Draft: "Draft",
  Published: "Published"
};
const statusLabel = (status) => STATUS_LABELS[status] || status || "—";
hbs.registerHelper("statusLabel", (status) => statusLabel(status));

// Human-readable labels for user roles
const ROLE_LABELS = {
  admin: "Administrator",
  inspector: "Sanitation Inspector",
  staff: "Sanitation Inspector",
  store_rep: "Store Representative",
  visitors: "Store Representative",
  pending: "Awaiting Approval"
};
hbs.registerHelper("roleLabel", (role) => ROLE_LABELS[(role || "").toLowerCase()] || role || "—");

hbs.registerHelper("statusBadge", (status) => {
  let bg = "bg-slate-100 text-slate-700 border-slate-300";
  let icon = "fa-circle";
  
  switch (status) {
    case "Compliant":
    case "Closed":
    case "Verified":
      bg = "bg-emerald-50 text-emerald-700 border-emerald-300";
      icon = "fa-check-circle";
      break;
    case "Noncompliant":
    case "Critical":
    case "Rejected":
      bg = "bg-rose-50 text-rose-700 border-rose-300";
      icon = "fa-times-circle";
      break;
    case "Scheduled":
      bg = "bg-purple-50 text-purple-700 border-purple-300";
      icon = "fa-calendar-check";
      break;
    case "InProgress":
    case "UnderReview":
    case "Submitted":
      bg = "bg-blue-50 text-blue-700 border-blue-300";
      icon = "fa-spinner";
      break;
    case "ActionPending":
    case "ActionSubmitted":
    case "Pending":
    case "In Remediation":
      bg = "bg-amber-50 text-amber-700 border-amber-300";
      icon = "fa-clock";
      break;
    case "For Inspection":
      bg = "bg-cyan-50 text-cyan-700 border-cyan-300";
      icon = "fa-search";
      break;
  }
  
  return new hbs.SafeString(
    `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border whitespace-nowrap ${bg}">
      <i class="fas ${icon} text-xs"></i> ${hbs.Utils.escapeExpression(statusLabel(status))}
    </span>`
  );
});

hbs.registerHelper("severityBadge", (severity) => {
  let style = "bg-amber-100 text-amber-800 border-amber-300";
  if (severity === "Critical") {
    style = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
  } else if (severity === "Minor") {
    style = "bg-sky-100 text-sky-800 border-sky-300";
  }
  return new hbs.SafeString(
    `<span class="inline-flex items-center px-2.5 py-0.5 rounded text-sm font-semibold border whitespace-nowrap ${style}">
      ${hbs.Utils.escapeExpression(severity)}
    </span>`
  );
});

hbs.registerHelper("scoreColor", (score) => {
  if (score >= 90) return "text-emerald-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 70) return "text-amber-600";
  return "text-rose-600";
});

// Configure View Engine
app.engine("xian", async (filePath, options, callback) => {
  try {
    const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, "views");

    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => {
        if (err) return reject(err);
        resolve(html);
      });
    });

    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) {
    callback(err);
  }
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

// Register partials recursively
const registerPartialsDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      registerPartialsDir(fullPath);
    } else if (entry.name.endsWith(".xian")) {
      const partialName = path.relative(path.join(__dirname, "views/partials"), fullPath)
        .replace(/\\/g, "/")
        .replace(".xian", "");
      const content = fs.readFileSync(fullPath, "utf8");
      hbs.registerPartial(partialName, content);
      // Also register bare filename
      const bareName = entry.name.replace(".xian", "");
      hbs.registerPartial(bareName, content);
    }
  }
};

registerPartialsDir(path.join(__dirname, "views/partials"));

// Integration API Router
app.use("/api/integration/v1", apiRouter);
app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);

// Main Router
app.use("/", router);

// Auto-sync database tables on startup
sequelize.sync().catch(err => console.error("Database sync error:", err));

export default app;

export const startServer = (port = PORT, host = process.env.HOST) => {
  return new Promise((resolve, reject) => {
    // If HOST is 0.0.0.0 or not set, omit host argument so Node listens on dual-stack (IPv4 & IPv6 localhost)
    const listenArgs = host && host !== "0.0.0.0" ? [port, host] : [port];
    const server = app.listen(...listenArgs, () => {
      console.log(`🚀 DALIAudit System running at http://0.0.0.0:${port} and http://localhost:${port}`);
      resolve(server);
    });
    server.on("error", reject);
  });
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun && !process.env.XIAN_ELECTRON) {
  startServer();
}
