/**
 * Seed Script — Create the first superadmin account
 * ────────────────────────────────────────────────────────────────────────────
 * Run once after initial deployment:
 *   node scripts/seedSuperAdmin.js
 *
 * Or with custom values via environment variables:
 *   SEED_NAME="John Doe" SEED_EMAIL="john@example.com" SEED_PASSWORD="Admin@123" \
 *   node scripts/seedSuperAdmin.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const name = process.env.SEED_NAME;
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  // Check if superadmin already exists
  const existing = await Admin.findOne({ role: "superadmin" });
  if (existing) {
    console.log(`⚠️  Superadmin already exists: ${existing.email}`);
    console.log("   Delete it first if you want to re-seed.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    role: "superadmin",
    permissions: {
      manageNotifications: true,
      manageHoroscope: true,
      manageHealthData: true,
      manageUsers: true,
      manageAdmins: true,
    },
  });

  console.log("\n✅ Superadmin created successfully!");
  console.log("─────────────────────────────────────");
  console.log(`  Name     : ${admin.name}`);
  console.log(`  Email    : ${admin.email}`);
  console.log(`  Role     : ${admin.role}`);
  console.log(
    `  Password : ${password}  ← Change this immediately after first login!`,
  );
  console.log("─────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
