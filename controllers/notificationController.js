import { admin } from "../config/firebase.js";
import UserBirthDetail from "../models/UserBirthDetail.js";
import { validationResult } from "express-validator";
import {
  ASTRO_NOTIFICATION_TYPES,
  ASTRO_SCREEN_MAP,
  ASTRO_NOTIFICATION_TEMPLATES,
} from "../utils/astroNotificationTypes.js";

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

/**
 * Builds the FCM message payload for React Native.
 * - `notification` block: shows the system tray notification.
 * - `data` block: readable by RN app in background/killed state.
 *   RN app should use `data.type` and `data.screen` for deep navigation.
 */
const buildFcmMessage = ({ token, tokens, title, body, type, extraData = {} }) => {
  const screen = ASTRO_SCREEN_MAP[type] || "HomeScreen";

  const dataPayload = {
    type,
    screen,
    sentAt: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(extraData).map(([k, v]) => [k, String(v)])),
  };

  const base = {
    notification: { title, body },
    data: dataPayload,
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "astrology_notifications", // register this channel in your RN app
        color: "#FF6B35",                     // saffron accent — update to your brand colour
        icon: "ic_astro_notify",              // add this drawable to your RN Android project
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          contentAvailable: true, // enables background fetch on iOS
        },
      },
      headers: {
        "apns-priority": "10",
        "apns-push-type": "alert",
      },
    },
  };

  if (token) return { ...base, token };
  if (tokens) return { ...base, tokens };
  return base;
};

const FCM_ERROR_MAP = {
  "messaging/invalid-registration-token":        "Invalid FCM device token",
  "messaging/registration-token-not-registered": "Device token is no longer registered",
  "messaging/invalid-argument":                  "Invalid notification payload",
  "messaging/quota-exceeded":                    "FCM quota exceeded, try again later",
  "messaging/message-rate-exceeded":             "Too many messages sent to this device",
  "messaging/device-message-rate-exceeded":      "Message rate exceeded for this device",
};

// ─── 1. Send astrology notification to a single device ───────────────────────

export const sendAstroNotificationToDevice = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { deviceId, type, title, body, data: extraData = {} } = req.body;

  const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
  const finalTitle = title || template.title || "Astrology Update";
  const finalBody  = body  || template.body  || "Tap to view your reading.";

  try {
    const message = buildFcmMessage({
      token: deviceId,
      title: finalTitle,
      body: finalBody,
      type,
      extraData,
    });

    const messageId = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: "Astrology notification sent successfully",
      data: { messageId, deviceId, type },
    });
  } catch (error) {
    console.error("sendAstroNotificationToDevice error:", error);
    const friendlyMessage = FCM_ERROR_MAP[error.code] || "Failed to send notification";
    const statusCode = error.code?.startsWith("messaging/invalid") ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: friendlyMessage,
      errorCode: error.code || null,
    });
  }
};

// ─── 2. Send personalised notification to a user (fetches their birth details) ─

export const sendAstroNotificationToUser = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { userId, type, title, body, data: extraData = {} } = req.body;

  try {
    const user = await UserBirthDetail.findById(userId).select("name deviceId");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
    const finalTitle = title || template.title || "Astrology Update";
    // Personalise with user's name when no custom body is provided
    const finalBody  = body
      || (template.body ? `${user.name}, ${template.body}` : "Tap to view your reading.");

    const message = buildFcmMessage({
      token: user.deviceId,
      title: finalTitle,
      body: finalBody,
      type,
      extraData: { ...extraData, userId: String(userId), userName: user.name },
    });

    const messageId = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: "Personalised astrology notification sent",
      data: { messageId, userId, userName: user.name, type },
    });
  } catch (error) {
    console.error("sendAstroNotificationToUser error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }
    const friendlyMessage = FCM_ERROR_MAP[error.code] || "Failed to send notification";
    return res.status(500).json({ success: false, message: friendlyMessage });
  }
};

// ─── 3. Broadcast an astrology notification to ALL devices ───────────────────

export const broadcastAstroNotification = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { type, title, body, data: extraData = {} } = req.body;

  try {
    const deviceIds = await UserBirthDetail.distinct("deviceId");

    if (!deviceIds.length) {
      return res.status(404).json({ success: false, message: "No registered devices found" });
    }

    const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
    const finalTitle = title || template.title || "Astrology Update";
    const finalBody  = body  || template.body  || "Tap to view your reading.";

    const CHUNK_SIZE = 500; // FCM multicast limit
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < deviceIds.length; i += CHUNK_SIZE) {
      const chunk = deviceIds.slice(i, i + CHUNK_SIZE);
      const message = buildFcmMessage({
        tokens: chunk,
        title: finalTitle,
        body: finalBody,
        type,
        extraData,
      });
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    return res.status(200).json({
      success: true,
      message: "Broadcast complete",
      data: { type, totalDevices: deviceIds.length, successCount: totalSuccess, failureCount: totalFailure },
    });
  } catch (error) {
    console.error("broadcastAstroNotification error:", error);
    return res.status(500).json({ success: false, message: "Failed to broadcast notification" });
  }
};

// ─── 4. Send daily horoscope to ALL users (designed for cron job use) ─────────

export const sendDailyHoroscopeToAll = async (_req, res) => {
  try {
    const users = await UserBirthDetail.find({}, "name deviceId").lean();

    if (!users.length) {
      return res.status(404).json({ success: false, message: "No users found" });
    }

    const template = ASTRO_NOTIFICATION_TEMPLATES[ASTRO_NOTIFICATION_TYPES.DAILY_HOROSCOPE];
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);
      const message = buildFcmMessage({
        tokens: chunk.map((u) => u.deviceId),
        title: template.title,
        body: template.body,
        type: ASTRO_NOTIFICATION_TYPES.DAILY_HOROSCOPE,
      });
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    return res.status(200).json({
      success: true,
      message: "Daily horoscope notifications dispatched",
      data: { totalUsers: users.length, successCount: totalSuccess, failureCount: totalFailure },
    });
  } catch (error) {
    console.error("sendDailyHoroscopeToAll error:", error);
    return res.status(500).json({ success: false, message: "Failed to send daily horoscope" });
  }
};

// ─── 5. Get all supported notification types (useful for your RN app/admin) ───

export const getNotificationTypes = (_req, res) => {
  const types = Object.entries(ASTRO_NOTIFICATION_TYPES).map(([key, value]) => ({
    key,
    type: value,
    screen: ASTRO_SCREEN_MAP[value],
    defaultTitle: ASTRO_NOTIFICATION_TEMPLATES[value]?.title || null,
    defaultBody:  ASTRO_NOTIFICATION_TEMPLATES[value]?.body  || null,
  }));

  return res.status(200).json({
    success: true,
    message: "Supported astrology notification types",
    data: types,
  });
};
