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
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "../utils/cookie.js";
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
      errors: errors
        .array()
        .map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  return null;
};

// ─── 1. REGISTER (superadmin only — creates new admin account) ────────────────

export const register = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { name, email, password, role = "admin", permissions } = req.body;

  try {
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An admin account with this email already exists.",
      });
    }

    const finalPermissions =
      role === "superadmin"
        ? {
            manageNotifications: true,
            manageHoroscope: true,
            manageHealthData: true,
            manageUsers: true,
            manageAdmins: true,
          }
        : permissions || {};

    const admin = await Admin.create({
      name,
      email,
      password,
      role,
      permissions: finalPermissions,
    });

    sendWelcomeEmail({ to: email, name, role }).catch((err) =>
      console.error("[Email] Welcome email failed:", err.message),
    );

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists." });
    }
    console.error("register error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. LOGIN ─────────────────────────────────────────────────────────────────
// Returns:
//   - accessToken  in the JSON body  (store in memory / state — NOT localStorage)
//   - refreshToken in an HttpOnly cookie  (browser handles it automatically)

export const login = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !(await admin.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact a superadmin.",
      });
    }

    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
    await admin.save({ validateBeforeSave: false });

    const payload = buildTokenPayload(admin);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Set refresh token in HttpOnly cookie — NOT in the response body
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: admin.toPublicJSON(),
        accessToken, // store in memory/state only
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        // refreshToken is in the HttpOnly cookie — not returned in body
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. REFRESH TOKEN ─────────────────────────────────────────────────────────
// Reads the refresh token from the HttpOnly cookie (not the request body).
// Returns a new accessToken in the JSON body.

export const refreshToken = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  console.log("Token from frontend (cookie):", token); // Debug log

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No refresh token found. Please log in again.",
    });
  }

  try {
    const decoded = verifyToken(token);

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({
          success: false,
          message: "Session invalid. Please log in again.",
        });
    }

    const payload = buildTokenPayload(admin);
    const newAccessToken = generateAccessToken(payload);
    // Also rotate the refresh token cookie for extra security
    const newRefreshToken = generateRefreshToken(payload);
    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      message: "Token refreshed",
      data: {
        accessToken: newAccessToken,
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({
      success: false,
      message: "Refresh token expired or invalid. Please log in again.",
    });
  }
};

// ─── 4. LOGOUT ────────────────────────────────────────────────────────────────
// Clears the HttpOnly refresh token cookie.

export const logout = async (req, res) => {
  clearRefreshCookie(res);
  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully." });
};

// ─── 5. FORGOT PASSWORD ───────────────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { email } = req.body;

  try {
    const admin = await Admin.findOne({ email });

    // Always return same message — never reveal if email exists
    if (!admin) {
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    admin.passwordResetToken = hashedToken;
    admin.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await admin.save({ validateBeforeSave: false });

    const adminPanelUrl =
      process.env.ADMIN_PANEL_URL || "http://localhost:3001";
    const resetUrl = `${adminPanelUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: admin.email,
        name: admin.name,
        resetToken: rawToken,
        resetUrl,
      });
    } catch (emailErr) {
      admin.passwordResetToken = undefined;
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
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 6. RESET PASSWORD ────────────────────────────────────────────────────────

export const resetPassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { token, newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const admin = await Admin.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token is invalid or has expired. Please request a new one.",
      });
    }

    admin.password = newPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;
    await admin.save();

    // Auto-login: set new cookie + return access token
    const payload = buildTokenPayload(admin);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You are now logged in.",
      data: {
        admin: admin.toPublicJSON(),
        accessToken,
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      },
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 7. CHANGE PASSWORD (authenticated) ──────────────────────────────────────

export const changePassword = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { currentPassword, newPassword } = req.body;

  try {
    const admin = await Admin.findById(req.admin._id).select("+password");

    if (!(await admin.comparePassword(currentPassword))) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect." });
    }

    admin.password = newPassword;
    await admin.save();

    // Rotate tokens after password change
    const payload = buildTokenPayload(admin);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      data: { accessToken, expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 8. GET PROFILE ───────────────────────────────────────────────────────────

export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    return res.status(200).json({ success: true, data: admin.toPublicJSON() });
  } catch (error) {
    console.error("getProfile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 9. UPDATE PROFILE ────────────────────────────────────────────────────────

export const updateProfile = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { name } = req.body;

  try {
    const admin = await Admin.findByIdAndUpdate(
      req.admin._id,
      { $set: { name } },
      { new: true, runValidators: true },
    );
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 10. LIST ALL ADMINS (superadmin only) ────────────────────────────────────

export const listAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [admins, total] = await Promise.all([
      Admin.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Admin.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: admins.map((a) => a.toPublicJSON()),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("listAdmins error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 11. TOGGLE ADMIN STATUS (superadmin only) ────────────────────────────────

export const toggleAdminStatus = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });

    if (admin._id.toString() === req.admin._id.toString()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You cannot deactivate your own account.",
        });
    }

    admin.isActive = !admin.isActive;
    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Admin account ${admin.isActive ? "activated" : "deactivated"} successfully`,
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    if (error.name === "CastError")
      return res
        .status(400)
        .json({ success: false, message: "Invalid admin ID" });
    console.error("toggleAdminStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 12. UPDATE ADMIN PERMISSIONS (superadmin only) ──────────────────────────

export const updateAdminPermissions = async (req, res) => {
  const { permissions, role } = req.body;

  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });

    if (permissions)
      admin.permissions = { ...admin.permissions.toObject(), ...permissions };
    if (role) admin.role = role;

    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Admin permissions updated",
      data: admin.toPublicJSON(),
    });
  } catch (error) {
    console.error("updateAdminPermissions error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
