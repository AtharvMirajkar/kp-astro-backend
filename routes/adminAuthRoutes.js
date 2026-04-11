import { Router } from "express";
import { body, param } from "express-validator";
import {
  register,
  login,
  refreshToken,
  logout,
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

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Must contain at least one number"),
  body("role").optional()
    .isIn(["superadmin","admin","editor"])
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

// ─── PUBLIC routes (no auth) ──────────────────────────────────────────────────

/**
 * POST /api/admin/auth/login
 * Returns accessToken in body + sets HttpOnly refresh cookie
 */
router.post("/login", loginRules, login);

/**
 * POST /api/admin/auth/refresh
 * Reads HttpOnly cookie → returns new accessToken in body
 * No body required.
 */
router.post("/refresh", refreshToken);

/**
 * POST /api/admin/auth/logout
 * Clears the HttpOnly refresh token cookie.
 */
router.post("/logout", logout);

/**
 * POST /api/admin/auth/forgot-password
 * Sends reset link to email (valid 15 min).
 */
router.post("/forgot-password", forgotRules, forgotPassword);

/**
 * POST /api/admin/auth/reset-password
 * Resets password via token from email link.
 * Auto-logs in → returns accessToken + sets new cookie.
 */
router.post("/reset-password", resetRules, resetPassword);

// ─── PROTECTED routes (any logged-in admin) ───────────────────────────────────

/** GET /api/admin/auth/profile */
router.get("/profile", protect, getProfile);

/** PATCH /api/admin/auth/profile */
router.patch(
  "/profile",
  protect,
  [body("name").trim().notEmpty().isLength({ min: 2, max: 100 })],
  updateProfile
);

/** POST /api/admin/auth/change-password */
router.post("/change-password", protect, changePasswordRules, changePassword);

// ─── SUPERADMIN-ONLY routes ───────────────────────────────────────────────────

/** POST /api/admin/auth/register — create a new admin account */
router.post("/register", protect, restrictTo("superadmin"), registerRules, register);

/** GET /api/admin/auth/admins — list all admins */
router.get("/admins", protect, restrictTo("superadmin"), listAdmins);

/** PATCH /api/admin/auth/admins/:id/status — activate / deactivate */
router.patch(
  "/admins/:id/status",
  protect,
  restrictTo("superadmin"),
  [param("id").isMongoId().withMessage("Invalid admin ID")],
  toggleAdminStatus
);

/** PATCH /api/admin/auth/admins/:id/permissions — update role & permissions */
router.patch(
  "/admins/:id/permissions",
  protect,
  restrictTo("superadmin"),
  [param("id").isMongoId().withMessage("Invalid admin ID")],
  updateAdminPermissions
);

export default router;
