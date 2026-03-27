import { Router } from "express";
import { param, query } from "express-validator";
import {
  getDailyHoroscope,
  getAllSignsHoroscope,
  scrapeAndSaveSingleSign,
  scrapeAndSaveAllSigns,
  getHoroscopeHistory,
  getSupportedSigns,
} from "../controllers/dailyHoroscopeController.js";

const router = Router();

const VALID_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

const signParamRule = param("sign")
  .toLowerCase()
  .isIn(VALID_SIGNS)
  .withMessage(`Sign must be one of: ${VALID_SIGNS.join(", ")}`);

const dateQueryRule = query("date")
  .optional()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage("date must be in YYYY-MM-DD format");

// ─── Public read endpoints ────────────────────────────────────────────────────

/**
 * @route   GET /api/horoscope/signs
 * @desc    List all 12 supported zodiac sign names
 * @access  Public
 */
router.get("/signs", getSupportedSigns);

/**
 * @route   GET /api/horoscope/today
 * @desc    Get today's horoscope for ALL 12 signs in one call
 * @query   date? — YYYY-MM-DD (defaults to today)
 * @example GET /api/horoscope/today
 * @access  Public
 */
router.get("/today", dateQueryRule, getAllSignsHoroscope);

/**
 * @route   GET /api/horoscope/:sign
 * @desc    Get daily horoscope for a single zodiac sign
 * @param   sign — e.g. "aries", "scorpio", "aquarius"
 * @query   date? — YYYY-MM-DD (defaults to today)
 * @example GET /api/horoscope/aquarius
 * @example GET /api/horoscope/scorpio?date=2024-03-27
 * @access  Public
 */
router.get("/:sign", [signParamRule, dateQueryRule], getDailyHoroscope);

/**
 * @route   GET /api/horoscope/:sign/history
 * @desc    Get horoscope history for a sign (last N days, max 30)
 * @query   days? — number of days (default 7, max 30)
 * @example GET /api/horoscope/aries/history?days=14
 * @access  Public
 */
router.get("/:sign/history", [signParamRule, dateQueryRule], getHoroscopeHistory);

// ─── Admin / cron-job scrape endpoints ───────────────────────────────────────

/**
 * @route   POST /api/horoscope/scrape/all
 * @desc    Scrape today's horoscope for all 12 signs from AstroSage and save to DB.
 *          Called automatically by the cron job at 6 AM IST daily.
 *          Can also be triggered manually for a forced refresh.
 *          Takes ~20-30 seconds to complete.
 * @access  Admin (add auth middleware in production)
 */
router.post("/scrape/all", scrapeAndSaveAllSigns);

/**
 * @route   POST /api/horoscope/scrape/:sign
 * @desc    Scrape today's horoscope for a single sign from AstroSage.
 *          Useful for re-scraping a single failed sign without running all 12.
 * @param   sign — zodiac sign name
 * @access  Admin
 */
router.post("/scrape/:sign", signParamRule, scrapeAndSaveSingleSign);

export default router;
