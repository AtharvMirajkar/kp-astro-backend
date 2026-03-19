import { body, param, query } from "express-validator";

// ─── User Birth Detail Validators ────────────────────────────────────────────

export const createUserBirthDetailRules = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),

  body("gender")
    .trim()
    .notEmpty().withMessage("Gender is required")
    .isIn(["male", "female", "other", "prefer_not_to_say"])
    .withMessage("Gender must be: male, female, other, or prefer_not_to_say"),

  body("deviceId")
    .trim()
    .notEmpty().withMessage("Device ID is required"),

  body("dateOfBirth")
    .notEmpty().withMessage("Date of birth is required")
    .isISO8601().withMessage("Date of birth must be a valid ISO 8601 date (e.g. 1990-05-15)")
    .custom((value) => {
      if (new Date(value) > new Date()) throw new Error("Date of birth cannot be in the future");
      return true;
    }),

  body("timeOfBirth")
    .trim()
    .notEmpty().withMessage("Time of birth is required")
    .matches(/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
    .withMessage("Time of birth must be in HH:MM or HH:MM:SS format"),

  body("placeOfBirth")
    .trim()
    .notEmpty().withMessage("Place of birth is required")
    .isLength({ min: 2, max: 200 }).withMessage("Place of birth must be 2–200 characters"),
];

export const updateUserBirthDetailRules = [
  param("id").isMongoId().withMessage("Invalid record ID"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),

  body("gender")
    .optional()
    .trim()
    .isIn(["male", "female", "other", "prefer_not_to_say"])
    .withMessage("Gender must be: male, female, other, or prefer_not_to_say"),

  body("deviceId")
    .optional()
    .trim()
    .notEmpty().withMessage("Device ID cannot be empty"),

  body("dateOfBirth")
    .optional()
    .isISO8601().withMessage("Date of birth must be a valid ISO 8601 date")
    .custom((value) => {
      if (new Date(value) > new Date()) throw new Error("Date of birth cannot be in the future");
      return true;
    }),

  body("timeOfBirth")
    .optional()
    .trim()
    .matches(/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
    .withMessage("Time of birth must be in HH:MM or HH:MM:SS format"),

  body("placeOfBirth")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage("Place of birth must be 2–200 characters"),
];

// ─── Astrology Notification Validators ───────────────────────────────────────

const VALID_ASTRO_TYPES = [
  "daily_horoscope", "weekly_horoscope", "monthly_horoscope",
  "kundali_ready", "planet_transit", "lucky_day_alert",
  "remedies", "panchang", "compatibility", "nakshatra_alert",
  "dasha_change", "eclipse_alert", "retrograde_alert",
  "festival_muhurat", "custom",
];

export const sendToDeviceRules = [
  body("deviceId").trim().notEmpty().withMessage("Device ID (FCM token) is required"),
  body("type")
    .trim()
    .notEmpty().withMessage("Notification type is required")
    .isIn(VALID_ASTRO_TYPES).withMessage(`type must be one of: ${VALID_ASTRO_TYPES.join(", ")}`),
  body("title").optional().trim().isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),
  body("body").optional().trim().isLength({ max: 300 }).withMessage("Body cannot exceed 300 characters"),
  body("data").optional().isObject().withMessage("data must be a key-value object"),
];

export const sendToUserRules = [
  body("userId").isMongoId().withMessage("Valid userId (MongoDB ObjectId) is required"),
  body("type")
    .trim()
    .notEmpty().withMessage("Notification type is required")
    .isIn(VALID_ASTRO_TYPES).withMessage(`type must be one of: ${VALID_ASTRO_TYPES.join(", ")}`),
  body("title").optional().trim().isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),
  body("body").optional().trim().isLength({ max: 300 }).withMessage("Body cannot exceed 300 characters"),
  body("data").optional().isObject().withMessage("data must be a key-value object"),
];

export const broadcastRules = [
  body("type")
    .trim()
    .notEmpty().withMessage("Notification type is required")
    .isIn(VALID_ASTRO_TYPES).withMessage(`type must be one of: ${VALID_ASTRO_TYPES.join(", ")}`),
  body("title").optional().trim().isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),
  body("body").optional().trim().isLength({ max: 300 }).withMessage("Body cannot exceed 300 characters"),
  body("data").optional().isObject().withMessage("data must be a key-value object"),
];
