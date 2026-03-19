import { Router } from "express";
import {
  getHealthReading,
  getHealthReadingAllLanguages,
  getSignsList,
  getHealthMeta,
} from "../controllers/healthReadingController.js";

const router = Router();

/**
 * @route   GET /api/health/meta
 * @desc    Dataset info — total combinations, how many are available vs pending
 * @access  Public
 */
router.get("/meta", getHealthMeta);

/**
 * @route   GET /api/health/signs
 * @desc    Full list of 12 zodiac signs with names in English, Marathi & Hindi.
 *          Use to populate dropdowns in your frontend / React Native app.
 * @access  Public
 */
router.get("/signs", getSignsList);

/**
 * @route   GET /api/health/reading
 * @desc    Get the health reading for a specific Rashi + Lagna combination
 *          in a single language.
 *
 * @query   rashi    {string}  Moon sign  — English: "aquarius" | Marathi: "कुंभ" | number: 11
 * @query   lagna    {string}  Ascendant  — English: "scorpio"  | Marathi: "वृश्चिक" | number: 8
 * @query   language {string}  "en" | "mr" | "hi"  (default: "en")
 *
 * @example GET /api/health/reading?rashi=aquarius&lagna=scorpio&language=en
 * @example GET /api/health/reading?rashi=कुंभ&lagna=वृश्चिक&language=mr
 * @example GET /api/health/reading?rashi=11&lagna=8&language=hi
 *
 * @returns 200 with { available: true, reading: "..." }      — record found & authored
 *          200 with { available: false, message: "..." }     — record exists but content pending
 *          400 if rashi / lagna / language is invalid
 * @access  Public
 */
router.get("/reading", getHealthReading);

/**
 * @route   GET /api/health/reading/all-languages
 * @desc    Get the health reading for a Rashi + Lagna combination in all 3 languages at once.
 *          Useful when the app needs to cache or display multilingual content.
 *
 * @query   rashi  {string}  Moon sign
 * @query   lagna  {string}  Ascendant
 *
 * @example GET /api/health/reading/all-languages?rashi=aries&lagna=aries
 *
 * @access  Public
 */
router.get("/reading/all-languages", getHealthReadingAllLanguages);

export default router;
