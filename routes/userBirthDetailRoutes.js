import { Router } from "express";
import {
  createUserBirthDetail,
  getAllUserBirthDetails,
  getUserBirthDetailById,
  updateUserBirthDetail,
  updateFcmToken,
  deleteUserBirthDetail,
} from "../controllers/userBirthDetailController.js";
import {
  createUserBirthDetailRules,
  updateUserBirthDetailRules,
} from "../middleware/validators.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

// ─── PUBLIC — called from the React Native app ────────────────────────────────

/**
 * POST /api/users
 * Create or update user birth details (upsert by deviceId).
 * @body { name, gender, deviceId, fcmToken, dateOfBirth, timeOfBirth, placeOfBirth }
 */
router.post("/", createUserBirthDetailRules, createUserBirthDetail);

/**
 * PATCH /api/users/fcm-token
 * Update only the FCM token for a device (called from RN on token refresh).
 * @body { deviceId, fcmToken }
 */
router.patch("/fcm-token", updateFcmToken);

// ─── PROTECTED — Admin panel reads/manages users ──────────────────────────────

/**
 * GET /api/users?page=1&limit=20&deviceId=...&gender=male
 * List all user birth detail records (paginated, filterable).
 */
router.get(
  "/",
  protect,
  requirePermission("manageUsers"),
  getAllUserBirthDetails
);

/**
 * GET /api/users/:id
 * Get a single user record by MongoDB _id.
 */
router.get(
  "/:id",
  protect,
  requirePermission("manageUsers"),
  getUserBirthDetailById
);

/**
 * PUT /api/users/:id
 * Update any field(s) on a user record.
 */
router.put(
  "/:id",
  protect,
  requirePermission("manageUsers"),
  updateUserBirthDetailRules,
  updateUserBirthDetail
);

/**
 * DELETE /api/users/:id
 * Delete a user record.
 */
router.delete(
  "/:id",
  protect,
  requirePermission("manageUsers"),
  deleteUserBirthDetail
);

export default router;
