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

const router = Router();

/**
 * @route   GET /api/notifications/types
 * @desc    List all supported astrology notification types with default templates
 *          and the React Native screen each type navigates to.
 * @access  Public
 */
router.get("/types", getNotificationTypes);

/**
 * @route   POST /api/notifications/send
 * @desc    Send an astrology push notification to a specific device (FCM token).
 *          title & body are optional — defaults come from the type's template.
 * @body    { deviceId, type, title?, body?, data? }
 * @example { "deviceId": "fcm-token-xyz", "type": "daily_horoscope" }
 * @access  Public
 */
router.post("/send", sendToDeviceRules, sendAstroNotificationToDevice);

/**
 * @route   POST /api/notifications/send-to-user
 * @desc    Send a personalised astrology notification to a user by MongoDB ID.
 *          The user's name is automatically prepended to the body.
 * @body    { userId, type, title?, body?, data? }
 * @access  Public
 */
router.post("/send-to-user", sendToUserRules, sendAstroNotificationToUser);

/**
 * @route   POST /api/notifications/broadcast
 * @desc    Broadcast an astrology notification to ALL registered devices.
 *          Auto-chunks requests to respect FCM's 500-token limit.
 * @body    { type, title?, body?, data? }
 * @access  Public
 */
router.post("/broadcast", broadcastRules, broadcastAstroNotification);

/**
 * @route   POST /api/notifications/daily-horoscope
 * @desc    Send the daily horoscope to every registered user.
 *          Designed to be triggered by a cron job each morning.
 *          No body required — uses the built-in daily_horoscope template.
 * @access  Public
 */
router.post("/daily-horoscope", sendDailyHoroscopeToAll);

export default router;
