import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type:     String,
      required: [true, "Email is required"],
      unique:   true,
      trim:     true,
      lowercase: true,
      match:    [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select:    false, // never returned in queries unless explicitly requested
    },

    // ── Role & permissions ──────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    ["superadmin", "admin", "editor"],
      default: "admin",
    },

    // Granular permissions for the admin panel
    permissions: {
      manageNotifications: { type: Boolean, default: true  },
      manageHoroscope:     { type: Boolean, default: true  },
      manageHealthData:    { type: Boolean, default: true  },
      manageUsers:         { type: Boolean, default: false },
      manageAdmins:        { type: Boolean, default: false },
    },

    // ── Account state ───────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },

    // ── Password reset ──────────────────────────────────────────────────────
    passwordResetToken:   { type: String,  select: false },
    passwordResetExpires: { type: Date,    select: false },

    // ── Session tracking ────────────────────────────────────────────────────
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ─────────────────────────────────────────────────────────────────
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1, isActive: 1 });

// ── Pre-save: hash password ──────────────────────────────────────────────────
adminSchema.pre("save", async function (next) {
  // Only hash when password is new or modified
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare password ───────────────────────────────────────
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: safe public profile (no sensitive fields) ───────────────
adminSchema.methods.toPublicJSON = function () {
  return {
    id:          this._id,
    name:        this.name,
    email:       this.email,
    role:        this.role,
    permissions: this.permissions,
    isActive:    this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt:   this.createdAt,
  };
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
