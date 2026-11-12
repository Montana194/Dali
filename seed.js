import bcrypt from "bcryptjs";
import { 
  sequelize, 
  User, 
  Store, 
  ChecklistItem, 
  Inspection, 
  InspectionResponse, 
  Finding, 
  CorrectiveAction, 
  Evidence, 
  ComplianceReport 
} from "./models/index.js";

export async function seedDatabase() {
  console.log("🔄 Synchronizing database tables...");
  await sequelize.sync({ alter: true });
  console.log("✅ Database schema synchronized!");

  // Check if users already exist
  const count = await User.count();
  if (count > 0) {
    console.log("ℹ️ Users already exist. Skipping full re-seed.");
    return;
  }

  console.log("🌱 Seeding initial DALIAudit data...");

  // 1. Create Users
  const adminPassword = await bcrypt.hash("admin123", 10);
  const inspectorPassword = await bcrypt.hash("inspector123", 10);
  const storeRepPassword = await bcrypt.hash("store123", 10);

  const admin = await User.create({
    fullName: "Admin User",
    email: "admin@dali.ph",
    password: adminPassword,
    role: "ADMIN",
    phone: "+63 917 100 0001",
    badgeNumber: "ADM-001"
  });

  const inspector = await User.create({
    fullName: "Inspector One",
    email: "inspector@dali.ph",
    password: inspectorPassword,
    role: "INSPECTOR",
    phone: "+63 917 200 0002",
    badgeNumber: "INS-001"
  });

  const inspector2 = await User.create({
    fullName: "Inspector Maria Santos",
    email: "maria.inspector@dali.ph",
    password: inspectorPassword,
    role: "INSPECTOR",
    phone: "+63 917 200 0003",
    badgeNumber: "INS-002"
  });

  const storeRep = await User.create({
    fullName: "Store Representative (Alabang)",
    email: "rep.alabang@dali.ph",
    password: storeRepPassword,
    role: "STORE_REP",
    phone: "+63 917 300 0001",
    storeId: 1
  });

  const storeRepPasig = await User.create({
    fullName: "Store Representative (Pasig)",
    email: "rep.pasig@dali.ph",
    password: storeRepPassword,
    role: "STORE_REP",
    phone: "+63 917 300 0002",
    storeId: 2
  });

  console.log("✅ Seeded Users (Admin, Inspectors, Store Reps).");

  // 2. Create Stores
  const store1 = await Store.create({
    code: "DALI-MNL-001",
    name: "DALI Everyday Grocery - Alabang Zapote",
    address: "Km. 21 Alabang-Zapote Road, Almanza Uno, Las Piñas / Muntinlupa",
    city: "Muntinlupa",
    region: "NCR",
    managerName: "Roberto Velasco",
    contactPhone: "+63 2 8801 1234",
    complianceStatus: "Noncompliant",
    overallRating: 78,
    lastInspectionDate: new Date()
  });

  const store2 = await Store.create({
    code: "DALI-MNL-002",
    name: "DALI Everyday Grocery - Pasig Rosario",
    address: "Block 4 Lot 12 Ortigas Ave Extension, Rosario, Pasig City",
    city: "Pasig",
    region: "NCR",
    managerName: "Elena Dela Cruz",
    contactPhone: "+63 2 8642 5678",
    complianceStatus: "Compliant",
    overallRating: 96,
    lastInspectionDate: new Date(Date.now() - 7 * 86400000)
  });

  const store3 = await Store.create({
    code: "DALI-MNL-003",
    name: "DALI Everyday Grocery - Taguig C5 Pinagsama",
    address: "Lot 8 C-5 Road cor. Diego Silang, Pinagsama, Taguig City",
    city: "Taguig",
    region: "NCR",
    managerName: "Manuel Mendoza",
    contactPhone: "+63 2 8889 9012",
    complianceStatus: "For Inspection",
    overallRating: 100,
    lastInspectionDate: null
  });

  const store4 = await Store.create({
    code: "DALI-MNL-004",
    name: "DALI Everyday Grocery - Quezon City Fairview",
    address: "Unit 3 Regalado Avenue, North Fairview, Quezon City",
    city: "Quezon City",
    region: "NCR",
    managerName: "Patricia Ramos",
    contactPhone: "+63 2 8931 3456",
    complianceStatus: "Action Pending",
    overallRating: 84,
    lastInspectionDate: new Date(Date.now() - 3 * 86400000)
  });

  console.log("✅ Seeded DALI Grocery Stores.");

  // 3. Create Checklist Items
  const itemsData = [
    {
      category: "Cold Storage & Refrigeration",
      requirement: "Dairy & Beverage Chiller Temperature Control (1°C - 4°C)",
      description: "Chiller temperature must be logged three times daily and maintained strictly between 1.0°C and 4.0°C.",
      weight: 15,
      criticality: "Critical"
    },
    {
      category: "Cold Storage & Refrigeration",
      requirement: "Chest Freezers Temperature Control (-18°C or below)",
      description: "Deep chillers and ice cream/meat freezers must show -18°C or colder without excessive ice build-up.",
      weight: 12,
      criticality: "Critical"
    },
    {
      category: "Food Safety & Perishables",
      requirement: "Packaging Integrity & Expiry Date Verification",
      description: "No compromised, unsealed, swollen, or dented packages on retail display; expiry dates strictly checked.",
      weight: 12,
      criticality: "Critical"
    },
    {
      category: "Food Safety & Perishables",
      requirement: "Fresh Produce Quality & Segregation",
      description: "Fruits and root vegetables sorted daily; damaged or rotting items removed immediately.",
      weight: 10,
      criticality: "Major"
    },
    {
      category: "Store Cleanliness & Sanitation",
      requirement: "Aisle & Retail Floor Cleanliness",
      description: "Aisles free of dirt, liquid spills, slipping hazards, and product debris. Daily sanitation log posted.",
      weight: 10,
      criticality: "Minor"
    },
    {
      category: "Store Cleanliness & Sanitation",
      requirement: "Approved Sanitizer & Dilution Station",
      description: "Food-contact surfaces cleaned with approved chlorine/quaternary ammonium solution at designated PPM.",
      weight: 10,
      criticality: "Major"
    },
    {
      category: "Pest Management & Prevention",
      requirement: "Active Pest Exclusion & Trap Maintenance",
      description: "No rodent droppings, insect trails, or birds inside store; UV insect electrocutors active and clean.",
      weight: 15,
      criticality: "Critical"
    },
    {
      category: "Personnel Hygiene & Protective Equipment",
      requirement: "Staff Uniform, Hairnet & Hand Hygiene Compliance",
      description: "All branch crew wearing clean company apron, ID, hairnet, and sanitized footwear.",
      weight: 8,
      criticality: "Minor"
    },
    {
      category: "Waste Disposal & Environmental Compliance",
      requirement: "Segregated Trash Disposal & Disposal Area Sanitation",
      description: "Internal and external bins covered, clean, labeled color-coded, and emptied per schedule.",
      weight: 8,
      criticality: "Major"
    }
  ];

  const checklistItems = [];
  for (const item of itemsData) {
    const created = await ChecklistItem.create(item);
    checklistItems.push(created);
  }
  console.log(`✅ Seeded ${checklistItems.length} Checklist Items.`);

  // 4. Create Snapshot Inspection visit001 (Figure 5 Object Diagram)
  const visit001 = await Inspection.create({
    inspectionCode: "INS-2026-001",
    storeId: store1.id,
    inspectorId: inspector.id,
    scheduledDate: new Date(Date.now() - 2 * 86400000),
    inspectionDate: new Date(Date.now() - 1 * 86400000),
    status: "Noncompliant",
    score: 78.0,
    totalPoints: 100,
    earnedPoints: 78,
    passed: false,
    findingsCount: 1,
    notes: "Audit completed with noncompliance noted in Cold Storage temperature control."
  });

  // Responses
  let responseWithFinding = null;
  for (const item of checklistItems) {
    const isNoncompliant = item.requirement.includes("Chiller Temperature Control");
    const resp = await InspectionResponse.create({
      inspectionId: visit001.id,
      itemId: item.id,
      result: isNoncompliant ? "Noncompliant" : "Compliant",
      remarks: isNoncompliant 
        ? "Chiller reading was 8.2°C; temperature sheet was missing 2 days of calibration logs." 
        : "Standard met per DALI sanitation checklist protocol.",
      scoreAwarded: isNoncompliant ? 0 : item.weight
    });
    if (isNoncompliant) {
      responseWithFinding = resp;
    }
  }

  // Finding (finding01)
  const finding01 = await Finding.create({
    inspectionId: visit001.id,
    responseId: responseWithFinding ? responseWithFinding.id : null,
    itemId: checklistItems[0].id,
    severity: "Major",
    title: "Chiller Temperature Deviation & Inadequate Sanitation Log",
    description: "Cold storage unit dairy chiller temperature registered 8.2°C, violating cold chain threshold of 4.0°C. Temperature tracking clipboard lacked entries for past 72 hours.",
    deadline: new Date(Date.now() + 3 * 86400000),
    status: "Open"
  });

  // Corrective Action (action01)
  const action01 = await CorrectiveAction.create({
    findingId: finding01.id,
    inspectionId: visit001.id,
    storeId: store1.id,
    assignedToRepId: storeRep.id,
    dueDate: new Date(Date.now() + 3 * 86400000),
    status: "Pending",
    actionPlan: "Schedule HVAC refrigeration technician for compressor thermostat recalibration; enforce twice-shift temperature logging."
  });

  // Evidence (photo01)
  await Evidence.create({
    inspectionId: visit001.id,
    responseId: responseWithFinding ? responseWithFinding.id : null,
    findingId: finding01.id,
    filePath: "/images/dali-logo.png",
    fileName: "chiller_thermometer_reading.jpg",
    fileType: "image/jpeg",
    caption: "Digital probe thermometer showing 8.2°C inside dairy display cabinet",
    stage: "Inspection",
    uploadedBy: inspector.id
  });

  // Compliance Report (report01)
  await ComplianceReport.create({
    reportCode: "REP-2026-001",
    inspectionId: visit001.id,
    storeId: store1.id,
    inspectorId: inspector.id,
    summary: "Routine store sanitation audit. Found 1 major violation regarding refrigeration storage. Corrective action issued to branch manager.",
    finalScore: 78.0,
    grade: "Grade C - Needs Immediate Action",
    status: "Draft",
    recommendations: "Immediate service call to maintenance contractor for Chiller #2. Reinspection required within 72 hours."
  });

  // 5. Create a Compliant Inspection visit002 for Pasig
  const visit002 = await Inspection.create({
    inspectionCode: "INS-2026-002",
    storeId: store2.id,
    inspectorId: inspector.id,
    scheduledDate: new Date(Date.now() - 8 * 86400000),
    inspectionDate: new Date(Date.now() - 7 * 86400000),
    status: "Closed",
    score: 96.0,
    totalPoints: 100,
    earnedPoints: 96,
    passed: true,
    findingsCount: 0,
    completedAt: new Date(Date.now() - 7 * 86400000),
    notes: "Outstanding compliance. All cold storage, pest control, and food handling standards strictly upheld."
  });

  await ComplianceReport.create({
    reportCode: "REP-2026-002",
    inspectionId: visit002.id,
    storeId: store2.id,
    inspectorId: inspector.id,
    summary: "Comprehensive Sanitation & Hygiene Audit: Store passed with Grade A distinction.",
    finalScore: 96.0,
    grade: "Grade A - Excellent Compliance",
    status: "Published",
    recommendations: "Maintain exemplary sanitation routines and daily log diligence."
  });

  // 6. Create a Scheduled Inspection visit003 for Taguig
  await Inspection.create({
    inspectionCode: "INS-2026-003",
    storeId: store3.id,
    inspectorId: inspector2.id,
    scheduledDate: new Date(Date.now() + 2 * 86400000),
    inspectionDate: new Date(Date.now() + 2 * 86400000),
    status: "Scheduled",
    score: 0,
    totalPoints: 100,
    earnedPoints: 0,
    passed: true,
    findingsCount: 0,
    notes: "Scheduled monthly hygiene & sanitation routine audit."
  });

  console.log("🎉 Complete DALIAudit demo seed successfully finished!");
}

if (process.argv[1]?.includes("seed.js")) {
  seedDatabase().then(() => {
    console.log("Seeding script completed.");
    process.exit(0);
  }).catch((err) => {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  });
}
