import { Router } from "express";
import { param, query } from "express-validator";
import {
  getDailyHoroscope,
  getAllSignsHoroscope,
  scrapeAndSaveSingleSign,
  scrapeAndSaveAllSigns,
  getHoroscopeHistory,
  getScrapeCoverage,
  getSupportedSigns,
} from "../controllers/dailyHoroscopeController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

const VALID_SIGNS = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces",
];
const VALID_LANGS = ["en","hi","mr"];

const signParamRule = param("sign")
  .toLowerCase()
  .isIn(VALID_SIGNS)
  .withMessage(`sign must be one of: ${VALID_SIGNS.join(", ")}`);

const langQueryRule = query(["language","lang"])
  .optional()
  .isIn(VALID_LANGS)
  .withMessage(`language must be one of: ${VALID_LANGS.join(", ")}`);

const dateQueryRule = query("date")
  .optional()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage("date must be in YYYY-MM-DD format");

// ─── PUBLIC — React Native app reads these ────────────────────────────────────

/** GET /api/horoscope/signs */
router.get("/signs", getSupportedSigns);

/** GET /api/horoscope/today?language=mr */
router.get("/today", [langQueryRule, dateQueryRule], getAllSignsHoroscope);

/** GET /api/horoscope/:sign?language=hi&date=2026-04-01 */
router.get("/:sign", [signParamRule, langQueryRule, dateQueryRule], getDailyHoroscope);

/** GET /api/horoscope/:sign/history?language=mr&days=7 */
router.get("/:sign/history", [signParamRule, langQueryRule, dateQueryRule], getHoroscopeHistory);

// ─── PROTECTED — Admin panel only ─────────────────────────────────────────────

/**
 * GET /api/horoscope/coverage?date=2026-04-01
 * Shows scrape status per language. Admin panel dashboard use.
 */
router.get(
  "/coverage",
  protect,
  requirePermission("manageHoroscope"),
  dateQueryRule,
  getScrapeCoverage
);

/**
 * POST /api/horoscope/scrape/all
 * Scrape all 12 signs × 3 languages. Triggered by cron or manually.
 */
router.post(
  "/scrape/all",
  protect,
  requirePermission("manageHoroscope"),
  scrapeAndSaveAllSigns
);

/**
 * POST /api/horoscope/scrape/:sign?lang=mr
 * Re-scrape a single sign (all langs or specific lang).
 */
router.post(
  "/scrape/:sign",
  protect,
  requirePermission("manageHoroscope"),
  signParamRule,
  scrapeAndSaveSingleSign
);

export default router;
