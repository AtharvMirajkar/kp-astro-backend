import { Router } from "express";
import { body, param } from "express-validator";
import {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
  listAdmins,
  toggleAdminStatus,
  updateAdminPermissions,
} from "../controllers/adminAuthController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

// ─── Validation rules ─────────────────────────────────────────────────────────

const passwordRules = [
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
];

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  ...passwordRules,
  body("role")
    .optional()
    .isIn(["superadmin", "admin", "editor"])
    .withMessage("Role must be: superadmin, admin, or editor"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const forgotRules = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
];

const resetRules = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Must contain at least one number"),
];

const changePasswordRules = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Must contain at least one number"),
];

// ─── Public routes (no auth required) ────────────────────────────────────────

/**
 * @route   POST /api/admin/auth/login
 * @desc    Log in with email & password → returns accessToken + refreshToken
 * @body    { email, password }
 * @access  Public
 */
router.post("/login", loginRules, login);

/**
 * @route   POST /api/admin/auth/refresh
 * @desc    Exchange a valid refreshToken for a new accessToken
 * @body    { refreshToken }
 * @access  Public
 */
router.post("/refresh", refreshToken);

/**
 * @route   POST /api/admin/auth/forgot-password
 * @desc    Send a password reset link to the admin's email (valid 15 min)
 * @body    { email }
 * @access  Public
 */
router.post("/forgot-password", forgotRules, forgotPassword);

/**
 * @route   POST /api/admin/auth/reset-password
 * @desc    Reset password using the token from the email link
 * @body    { token, newPassword }
 * @access  Public
 */
router.post("/reset-password", resetRules, resetPassword);

// ─── Protected routes (JWT required) ─────────────────────────────────────────

/**
 * @route   GET /api/admin/auth/profile
 * @desc    Get logged-in admin's profile
 * @access  Protected
 */
router.get("/profile", protect, getProfile);

/**
 * @route   PATCH /api/admin/auth/profile
 * @desc    Update logged-in admin's name
 * @body    { name }
 * @access  Protected
 */
router.patch(
  "/profile",
  protect,
  [body("name").trim().notEmpty().isLength({ min: 2, max: 100 })],
  updateProfile
);

/**
 * @route   POST /api/admin/auth/change-password
 * @desc    Change password (requires current password)
 * @body    { currentPassword, newPassword }
 * @access  Protected
 */
router.post("/change-password", protect, changePasswordRules, changePassword);

// ─── Superadmin-only routes ───────────────────────────────────────────────────

/**
 * @route   POST /api/admin/auth/register
 * @desc    Create a new admin account (superadmin only)
 * @body    { name, email, password, role?, permissions? }
 * @access  Protected + superadmin
 */
router.post("/register", protect, restrictTo("superadmin"), registerRules, register);

/**
 * @route   GET /api/admin/auth/admins
 * @desc    List all admin accounts
 * @query   page, limit, role, isActive
 * @access  Protected + superadmin
 */
router.get("/admins", protect, restrictTo("superadmin"), listAdmins);

/**
 * @route   PATCH /api/admin/auth/admins/:id/status
 * @desc    Activate or deactivate an admin account
 * @access  Protected + superadmin
 */
router.patch(
  "/admins/:id/status",
  protect,
  restrictTo("superadmin"),
  [param("id").isMongoId().withMessage("Invalid admin ID")],
  toggleAdminStatus
);

/**
 * @route   PATCH /api/admin/auth/admins/:id/permissions
 * @desc    Update role and/or permissions for an admin
 * @body    { role?, permissions? }
 * @access  Protected + superadmin
 */
router.patch(
  "/admins/:id/permissions",
  protect,
  restrictTo("superadmin"),
  [param("id").isMongoId().withMessage("Invalid admin ID")],
  updateAdminPermissions
);

export default router;
