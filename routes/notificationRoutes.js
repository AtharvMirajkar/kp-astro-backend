import { Router } from "express";
import {
  sendAstroNotificationToDevice,
  sendAstroNotificationToUser,
  broadcastAstroNotification,
  sendDailyHoroscopeToAll,
  getNotificationTypes,
} from "../controllers/notificationController.js";
import {
  sendToDeviceRules,
  sendToUserRules,
  broadcastRules,
} from "../middleware/validators.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * GET /api/notifications/types
 * List all supported astrology notification types.
 * Public — used by the admin panel dropdown, no auth needed.
 */
router.get("/types", getNotificationTypes);

// ─── PROTECTED — require login + manageNotifications permission ───────────────

/**
 * POST /api/notifications/send
 * Send to a specific device by FCM token.
 * @body { fcmToken, type, title?, body?, data? }
 */
router.post(
  "/send",
  protect,
  requirePermission("manageNotifications"),
  sendToDeviceRules,
  sendAstroNotificationToDevice
);

/**
 * POST /api/notifications/send-to-user
 * Send personalised notification to a user by their MongoDB ID.
 * @body { userId, type, title?, body?, data? }
 */
router.post(
  "/send-to-user",
  protect,
  requirePermission("manageNotifications"),
  sendToUserRules,
  sendAstroNotificationToUser
);

/**
 * POST /api/notifications/broadcast
 * Broadcast to ALL registered FCM tokens.
 * @body { type, title?, body?, data? }
 */
router.post(
  "/broadcast",
  protect,
  requirePermission("manageNotifications"),
  broadcastRules,
  broadcastAstroNotification
);

/**
 * POST /api/notifications/daily-horoscope
 * Trigger the daily horoscope blast manually (also fires via cron at 6 AM IST).
 * Superadmin or anyone with manageNotifications permission.
 */
router.post(
  "/daily-horoscope",
  protect,
  requirePermission("manageNotifications"),
  sendDailyHoroscopeToAll
);

export default router;
