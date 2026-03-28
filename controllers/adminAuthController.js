import crypto from "crypto";
import Admin from "../models/Admin.js";
import { validationResult } from "express-validator";
import {
  generateAccessToken,
  generateRefreshToken,
  buildTokenPayload,
  verifyToken,
} from "../utils/jwt.js";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../services/emailService.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  return null;
};

// ─── 1. REGISTER (create admin account) ─────────────────────────────────────
// Only superadmins can create new admin accounts via API.
// The very first admin must be created via the seed script.

export const register = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { name, email, password, role = "admin", permissions } = req.body;

  try {
    // Check email uniqueness
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An admin account with this email already exists.",
      });
    }

    // Build permissions — superadmin gets all, others use provided or defaults
    const finalPermissions =
      role === "superadmin"
        ? {
            manageNotifications: true,
            manageHoroscope:     true,
            manageHealthData:    true,
            manageUsers:         true,
            manageAdmins:        true,
          }
        : permissions || {};

    const admin = await Admin.create({
      name,
      email,
      password,
      role,
      permissions: finalPermissions,
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ to: email, name, role }).catch((err) =>
      console.error("[Email] Welcome email failed:", err.message)
    );

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists." });
    }
    console.error("register error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. LOGIN ────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password } = req.body;

  try {
    // Explicitly select password (it's excluded by default via `select: false`)
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact a superadmin.",
      });
    }

    // Update last login metadata
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
    await admin.save({ validateBeforeSave: false });

    const payload      = buildTokenPayload(admin);
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin:        admin.toPublicJSON(),
        accessToken,
        refreshToken,
        expiresIn:    process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. REFRESH TOKEN ────────────────────────────────────────────────────────

export const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(422).json({ success: false, message: "refreshToken is required" });
  }

  try {
    const decoded = verifyToken(token);

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    const payload     = buildTokenPayload(admin);
    const accessToken = generateAccessToken(payload);

    return res.status(200).json({
      success: true,
      message: "Token refreshed",
      data: { accessToken, expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token. Please log in again.",
    });
  }
};

// ─── 4. FORGOT PASSWORD ──────────────────────────────────────────────────────
// Generates a secure reset token, stores its hash in DB, emails a reset link.

export const forgotPassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email } = req.body;

  try {
    const admin = await Admin.findOne({ email });

    // Always respond success — never reveal whether email exists
    if (!admin) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate a secure random token
    const rawToken   = crypto.randomBytes(32).toString("hex");
    // Store only the SHA-256 hash (never the raw token)
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    admin.passwordResetToken   = hashedToken;
    admin.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await admin.save({ validateBeforeSave: false });

    // Build reset URL — frontend will use this
    const adminPanelUrl = process.env.ADMIN_PANEL_URL || "http://localhost:3001";
    const resetUrl      = `${adminPanelUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to:         admin.email,
        name:       admin.name,
        resetToken: rawToken,
        resetUrl,
      });
    } catch (emailErr) {
      // Rollback token if email fails
      admin.passwordResetToken   = undefined;
      admin.passwordResetExpires = undefined;
      await admin.save({ validateBeforeSave: false });
      console.error("[Email] Password reset email failed:", emailErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. RESET PASSWORD ───────────────────────────────────────────────────────
// Validates the raw token, compares its hash, sets the new password.

export const resetPassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { token, newPassword } = req.body;

  try {
    // Hash the incoming raw token for DB comparison
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const admin = await Admin.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: new Date() }, // must not be expired
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or has expired. Please request a new one.",
      });
    }

    // Set new password (pre-save hook will hash it)
    admin.password             = newPassword;
    admin.passwordResetToken   = undefined;
    admin.passwordResetExpires = undefined;
    await admin.save();

    // Auto-login after reset — return fresh tokens
    const payload      = buildTokenPayload(admin);
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You are now logged in.",
      data: {
        admin:        admin.toPublicJSON(),
        accessToken,
        refreshToken,
        expiresIn:    process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 6. CHANGE PASSWORD (authenticated) ──────────────────────────────────────

export const changePassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { currentPassword, newPassword } = req.body;

  try {
    const admin = await Admin.findById(req.admin._id).select("+password");

    if (!(await admin.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    admin.password = newPassword;
    await admin.save();

    const payload      = buildTokenPayload(admin);
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      data: { accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 7. GET PROFILE (authenticated) ──────────────────────────────────────────

export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    return res.status(200).json({ success: true, data: admin.toPublicJSON() });
  } catch (error) {
    console.error("getProfile error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 8. UPDATE PROFILE (authenticated) ───────────────────────────────────────

export const updateProfile = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  // Only allow updating safe fields from this endpoint
  const { name } = req.body;

  try {
    const admin = await Admin.findByIdAndUpdate(
      req.admin._id,
      { $set: { name } },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 9. LIST ALL ADMINS (superadmin only) ────────────────────────────────────

export const listAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [admins, total] = await Promise.all([
      Admin.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Admin.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    admins.map((a) => a.toPublicJSON()),
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("listAdmins error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 10. TOGGLE ADMIN ACTIVE STATUS (superadmin only) ───────────────────────

export const toggleAdminStatus = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // Prevent superadmin from deactivating themselves
    if (admin._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Admin account ${admin.isActive ? "activated" : "deactivated"} successfully`,
      data:    admin.toPublicJSON(),
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid admin ID" });
    }
    console.error("toggleAdminStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 11. UPDATE ADMIN PERMISSIONS (superadmin only) ─────────────────────────

export const updateAdminPermissions = async (req, res) => {
  const { permissions, role } = req.body;

  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (permissions) admin.permissions = { ...admin.permissions, ...permissions };
    if (role)        admin.role        = role;

    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Admin permissions updated",
      data:    admin.toPublicJSON(),
    });
  } catch (error) {
    console.error("updateAdminPermissions error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
