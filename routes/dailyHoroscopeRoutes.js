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

const router = Router();

const VALID_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];
const VALID_LANGS = ["en", "hi", "mr"];

const signParamRule = param("sign")
  .toLowerCase()
  .isIn(VALID_SIGNS)
  .withMessage(`sign must be one of: ${VALID_SIGNS.join(", ")}`);

const langQueryRule = query(["language", "lang"])
  .optional()
  .isIn(VALID_LANGS)
  .withMessage(`language must be one of: ${VALID_LANGS.join(", ")}`);

const dateQueryRule = query("date")
  .optional()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage("date must be in YYYY-MM-DD format");

// ─── Public read endpoints ────────────────────────────────────────────────────

/**
 * @route   GET /api/horoscope/signs
 * @desc    List all 12 supported signs and supported languages
 */
router.get("/signs", getSupportedSigns);

/**
 * @route   GET /api/horoscope/coverage
 * @desc    Show which signs have been scraped per language for a given date
 * @query   date? — YYYY-MM-DD (defaults to today)
 * @example GET /api/horoscope/coverage
 */
router.get("/coverage", dateQueryRule, getScrapeCoverage);

/**
 * @route   GET /api/horoscope/today
 * @desc    Get today's horoscope for ALL 12 signs in the requested language
 * @query   language? — en | hi | mr (default: en)
 * @query   date?     — YYYY-MM-DD (default: today)
 * @example GET /api/horoscope/today?language=mr
 */
router.get("/today", [langQueryRule, dateQueryRule], getAllSignsHoroscope);

/**
 * @route   GET /api/horoscope/:sign
 * @desc    Get daily horoscope for one sign in the requested language
 * @param   sign     — e.g. "aquarius", "scorpio"
 * @query   language — en | hi | mr (default: en)
 * @query   date?    — YYYY-MM-DD (default: today)
 * @example GET /api/horoscope/aquarius?language=hi
 * @example GET /api/horoscope/scorpio?language=mr&date=2026-03-27
 */
router.get("/:sign", [signParamRule, langQueryRule, dateQueryRule], getDailyHoroscope);

/**
 * @route   GET /api/horoscope/:sign/history
 * @desc    Get past N days of horoscope for a sign in the requested language
 * @query   language — en | hi | mr (default: en)
 * @query   days?    — number of days (default: 7, max: 30)
 * @example GET /api/horoscope/aries/history?language=hi&days=14
 */
router.get("/:sign/history", [signParamRule, langQueryRule, dateQueryRule], getHoroscopeHistory);

// ─── Admin / scrape endpoints ─────────────────────────────────────────────────

/**
 * @route   POST /api/horoscope/scrape/all
 * @desc    Scrape all 12 signs × all 3 languages (EN, HI, MR) for today
 *          Called by cron job at 06:00 AM IST. Can also be triggered manually.
 *          Takes ~3-4 minutes (36 HTTP requests with polite delays).
 * @access  Admin
 */
router.post("/scrape/all", scrapeAndSaveAllSigns);

/**
 * @route   POST /api/horoscope/scrape/:sign
 * @desc    Scrape a single sign in all 3 languages (or one specific language)
 * @param   sign   — zodiac sign
 * @query   lang?  — en | hi | mr — if set, re-scrapes only that language
 * @example POST /api/horoscope/scrape/aquarius
 * @example POST /api/horoscope/scrape/aquarius?lang=mr
 * @access  Admin
 */
router.post("/scrape/:sign", signParamRule, scrapeAndSaveSingleSign);

export default router;
