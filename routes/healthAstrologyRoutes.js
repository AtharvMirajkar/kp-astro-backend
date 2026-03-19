import { Router } from "express";
import { query, body } from "express-validator";
import {
  getHealthReading,
  getAvailableCombinations,
  getReadingsByRashi,
  seedHealthData,
  upsertHealthReading,
} from "../controllers/healthAstrologyController.js";

const router = Router();

const VALID_SIGNS_EN = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces",
];
const VALID_LANGS = ["en", "hi", "mr"];

// ─── Validation rules ─────────────────────────────────────────────────────────

const healthReadingQueryRules = [
  query("rashi")
    .notEmpty().withMessage("rashi (Moon Sign) is required")
    .trim(),
  query("lagna")
    .notEmpty().withMessage("lagna (Ascendant) is required")
    .trim(),
  query("language")
    .optional()
    .isIn(VALID_LANGS)
    .withMessage(`language must be one of: ${VALID_LANGS.join(", ")}`),
];

const upsertRules = [
  body("code").notEmpty().withMessage("code is required"),
  body("rashi.en").isIn(VALID_SIGNS_EN).withMessage("rashi.en must be a valid English sign name"),
  body("lagna.en").isIn(VALID_SIGNS_EN).withMessage("lagna.en must be a valid English sign name"),
  body("content.en").notEmpty().withMessage("content.en (English text) is required"),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/health-astrology/reading
 * @desc    Get health reading for a specific rashi + lagna combination.
 *          Accepts sign names in English, Hindi (Devanagari), or Marathi.
 *          Returns the "working on it" message if data is not yet available.
 * @query   rashi, lagna, language (en | hi | mr)
 * @example GET /api/health-astrology/reading?rashi=aquarius&lagna=scorpio&language=en
 * @example GET /api/health-astrology/reading?rashi=कुंभ&lagna=वृश्चिक&language=mr
 * @access  Public
 */
router.get("/reading", healthReadingQueryRules, getHealthReading);

/**
 * @route   POST /api/health-astrology/reading
 * @desc    Same as GET /reading but accepts rashi, lagna, language in the JSON body.
 *          Useful for React Native when passing complex Unicode params is tricky.
 * @body    { rashi, lagna, language }
 * @access  Public
 */
router.post("/reading", getHealthReading);

/**
 * @route   GET /api/health-astrology/combinations
 * @desc    List all available (published) rashi + lagna combinations.
 *          Useful for building dropdowns in the frontend.
 * @query   language (en | hi | mr)
 * @access  Public
 */
router.get("/combinations", getAvailableCombinations);

/**
 * @route   GET /api/health-astrology/rashi/:rashi
 * @desc    Get all 12 lagna readings for a given rashi.
 * @param   rashi — sign name in English or Devanagari
 * @query   language (en | hi | mr)
 * @example GET /api/health-astrology/rashi/aries?language=hi
 * @access  Public
 */
router.get("/rashi/:rashi", getReadingsByRashi);

/**
 * @route   POST /api/health-astrology/seed
 * @desc    Seed the MongoDB collection from the local JSON data file.
 *          Safe to call multiple times — skips already-existing codes.
 *          Restrict this endpoint in production (add admin auth middleware).
 * @access  Admin
 */
router.post("/seed", seedHealthData);

/**
 * @route   POST /api/health-astrology/upsert
 * @desc    Add or update a single health reading (admin use).
 * @body    { code, rashi: {en,hi,mr}, lagna: {en,hi,mr}, content: {en,hi,mr}, isPublished? }
 * @access  Admin
 */
router.post("/upsert", upsertRules, upsertHealthReading);

export default router;
