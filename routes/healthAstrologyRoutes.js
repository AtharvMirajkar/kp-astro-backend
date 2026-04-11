import { Router } from "express";
import { query, body } from "express-validator";
import {
  getHealthReading,
  getAvailableCombinations,
  getReadingsByRashi,
  seedHealthData,
  upsertHealthReading,
} from "../controllers/healthAstrologyController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

const VALID_SIGNS_EN = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces",
];
const VALID_LANGS = ["en","hi","mr"];

const healthReadingQueryRules = [
  query("rashi").notEmpty().withMessage("rashi (Moon Sign) is required").trim(),
  query("lagna").notEmpty().withMessage("lagna (Ascendant) is required").trim(),
  query("language").optional()
    .isIn(VALID_LANGS).withMessage(`language must be one of: ${VALID_LANGS.join(", ")}`),
];

const upsertRules = [
  body("code").notEmpty().withMessage("code is required"),
  body("rashi.en").isIn(VALID_SIGNS_EN).withMessage("rashi.en must be a valid English sign name"),
  body("lagna.en").isIn(VALID_SIGNS_EN).withMessage("lagna.en must be a valid English sign name"),
  body("content.en").notEmpty().withMessage("content.en (English text) is required"),
];

// ─── PUBLIC — React Native app reads these ────────────────────────────────────

/**
 * GET /api/health-astrology/reading?rashi=aquarius&lagna=scorpio&language=en
 * Also accepts POST with { rashi, lagna, language } in body (easier from RN with Unicode).
 */
router.get("/reading", healthReadingQueryRules, getHealthReading);
router.post("/reading", getHealthReading);

/**
 * GET /api/health-astrology/combinations?language=mr
 * All available rashi+lagna combinations — for building dropdowns.
 */
router.get("/combinations", getAvailableCombinations);

/**
 * GET /api/health-astrology/rashi/:rashi?language=hi
 * All 12 lagna readings for a given rashi.
 */
router.get("/rashi/:rashi", getReadingsByRashi);

// ─── PROTECTED — Admin panel only ─────────────────────────────────────────────

/**
 * POST /api/health-astrology/seed
 * Load JSON data file into MongoDB. Safe to run multiple times (skips existing).
 */
router.post(
  "/seed",
  protect,
  requirePermission("manageHealthData"),
  seedHealthData
);

/**
 * POST /api/health-astrology/upsert
 * Add or update a single health reading (trilingual).
 * @body { code, rashi:{en,hi,mr}, lagna:{en,hi,mr}, content:{en,hi,mr}, isPublished? }
 */
router.post(
  "/upsert",
  protect,
  requirePermission("manageHealthData"),
  upsertRules,
  upsertHealthReading
);

export default router;
