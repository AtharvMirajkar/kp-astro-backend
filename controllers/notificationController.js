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
      errors: errors
        .array()
        .map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  return null;
};

/**
 * buildFcmMessage — DATA-ONLY payload
 *
 * WHY: When `notification` key is present, FCM SDK auto-displays the
 * notification when the app is in background/killed state. Then our
 * Notifee handler also displays it → DOUBLE notification.
 *
 * FIX: Remove `notification` key entirely. Move title + body into `data`.
 * Notifee on the RN side reads data.title + data.body and displays a
 * fully styled notification in ALL states (foreground, background, killed).
 *
 * REQUIRED: android.priority = "high" to wake the device for data-only.
 *           apns.contentAvailable = true for iOS background delivery.
 */
const buildFcmMessage = ({
  token,
  tokens,
  title,
  body,
  type,
  extraData = {},
}) => {
  const screen = ASTRO_SCREEN_MAP[type] || "HomeScreen";

  // ALL values in FCM data payload must be strings
  const dataPayload = {
    title, // ← moved here (was in notification{})
    body, // ← moved here (was in notification{})
    type,
    screen,
    sentAt: new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(extraData).map(([k, v]) => [k, String(v)]),
    ),
  };

  const base = {
    // notification key REMOVED — Notifee handles display on RN side
    data: dataPayload,
    android: {
      priority: "high", // required to wake device for data-only
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true, // required for iOS background delivery
          sound: "default",
        },
      },
      headers: {
        "apns-priority": "5", // 5 = normal (10 = immediate, use for alerts)
        "apns-push-type": "background",
      },
    },
  };

  if (token) return { ...base, token };
  if (tokens) return { ...base, tokens };
  return base;
};

const FCM_ERROR_MAP = {
  "messaging/invalid-registration-token": "Invalid FCM token",
  "messaging/registration-token-not-registered":
    "FCM token is no longer registered — user may have reinstalled the app",
  "messaging/invalid-argument": "Invalid notification payload",
  "messaging/quota-exceeded": "FCM quota exceeded, try again later",
  "messaging/message-rate-exceeded": "Too many messages sent to this device",
  "messaging/device-message-rate-exceeded":
    "Message rate exceeded for this device",
};

// ─── 1. Send to a single FCM token (direct) ──────────────────────────────────

export const sendAstroNotificationToDevice = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { fcmToken, type, title, body, data: extraData = {} } = req.body;

  const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
  const finalTitle = title || template.title || "Astrology Update";
  const finalBody = body || template.body || "Tap to view your reading.";

  try {
    const message = buildFcmMessage({
      token: fcmToken,
      title: finalTitle,
      body: finalBody,
      type,
      extraData,
    });
    const messageId = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: { messageId, fcmToken, type },
    });
  } catch (error) {
    console.error("sendAstroNotificationToDevice error:", error);
    const friendly = FCM_ERROR_MAP[error.code] || "Failed to send notification";
    const statusCode = error.code?.startsWith("messaging/invalid") ? 400 : 500;
    return res
      .status(statusCode)
      .json({
        success: false,
        message: friendly,
        errorCode: error.code || null,
      });
  }
};

// ─── 2. Send personalised notification to a user (looks up fcmToken by userId) ─

export const sendAstroNotificationToUser = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { userId, type, title, body, data: extraData = {} } = req.body;

  try {
    // Fetch user — we need their name and fcmToken
    const user = await UserBirthDetail.findById(userId).select("name fcmToken");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.fcmToken) {
      return res.status(422).json({
        success: false,
        message: "This user does not have an FCM token registered",
      });
    }

    const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
    const finalTitle = title || template.title || "Astrology Update";
    const finalBody =
      body ||
      (template.body
        ? `${user.name}, ${template.body}`
        : "Tap to view your reading.");

    const message = buildFcmMessage({
      token: user.fcmToken,
      title: finalTitle,
      body: finalBody,
      type,
      extraData: { ...extraData, userId: String(userId), userName: user.name },
    });

    const messageId = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: "Personalised notification sent",
      data: { messageId, userId, userName: user.name, type },
    });
  } catch (error) {
    console.error("sendAstroNotificationToUser error:", error);
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID format" });
    }
    const friendly = FCM_ERROR_MAP[error.code] || "Failed to send notification";
    return res.status(500).json({ success: false, message: friendly });
  }
};

// ─── 3. Broadcast to ALL users (uses each user's stored fcmToken) ─────────────

export const broadcastAstroNotification = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { type, title, body, data: extraData = {} } = req.body;

  try {
    // Collect all non-empty fcmTokens from the DB
    const fcmTokens = await UserBirthDetail.distinct("fcmToken", {
      fcmToken: { $ne: "" },
    });

    if (!fcmTokens.length) {
      return res
        .status(404)
        .json({ success: false, message: "No registered FCM tokens found" });
    }

    const template = ASTRO_NOTIFICATION_TEMPLATES[type] || {};
    const finalTitle = title || template.title || "Astrology Update";
    const finalBody = body || template.body || "Tap to view your reading.";

    const CHUNK_SIZE = 500; // FCM multicast hard limit
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < fcmTokens.length; i += CHUNK_SIZE) {
      const chunk = fcmTokens.slice(i, i + CHUNK_SIZE);
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
      data: {
        type,
        totalTokens: fcmTokens.length,
        successCount: totalSuccess,
        failureCount: totalFailure,
      },
    });
  } catch (error) {
    console.error("broadcastAstroNotification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to broadcast notification" });
  }
};

// ─── 4. Daily horoscope to ALL users (cron-job endpoint) ─────────────────────

export const sendDailyHoroscopeToAll = async (_req, res) => {
  try {
    // Only fetch users who have a valid fcmToken
    const users = await UserBirthDetail.find(
      { fcmToken: { $exists: true, $ne: "" } },
      "name fcmToken",
    ).lean();

    if (!users.length) {
      return res
        .status(404)
        .json({ success: false, message: "No users with FCM tokens found" });
    }

    const template =
      ASTRO_NOTIFICATION_TEMPLATES[ASTRO_NOTIFICATION_TYPES.DAILY_HOROSCOPE];
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);
      const message = buildFcmMessage({
        tokens: chunk.map((u) => u.fcmToken),
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
      data: {
        totalUsers: users.length,
        successCount: totalSuccess,
        failureCount: totalFailure,
      },
    });
  } catch (error) {
    console.error("sendDailyHoroscopeToAll error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send daily horoscope" });
  }
};

// ─── 5. Get all supported notification types ─────────────────────────────────

export const getNotificationTypes = (_req, res) => {
  const types = Object.entries(ASTRO_NOTIFICATION_TYPES).map(
    ([key, value]) => ({
      key,
      type: value,
      screen: ASTRO_SCREEN_MAP[value],
      defaultTitle: ASTRO_NOTIFICATION_TEMPLATES[value]?.title || null,
      defaultBody: ASTRO_NOTIFICATION_TEMPLATES[value]?.body || null,
    }),
  );

  return res.status(200).json({
    success: true,
    message: "Supported astrology notification types",
    data: types,
  });
};
