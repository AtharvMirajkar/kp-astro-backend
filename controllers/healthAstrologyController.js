import HealthAstrology from "../models/HealthAstrology.js";
import { validationResult } from "express-validator";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Supported Languages ─────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = ["en", "hi", "mr"];

// ─── Sign name normalisation maps ────────────────────────────────────────────
// Accept English, Hindi and Marathi sign names from the frontend
// and normalise them to the internal English key used in the DB.

const RASHI_MAP = {
  // English
  aries:       "aries",
  taurus:      "taurus",
  gemini:      "gemini",
  cancer:      "cancer",
  leo:         "leo",
  virgo:       "virgo",
  libra:       "libra",
  scorpio:     "scorpio",
  sagittarius: "sagittarius",
  capricorn:   "capricorn",
  aquarius:    "aquarius",
  pisces:      "pisces",
  // Hindi / Marathi (Devanagari)
  मेष:     "aries",
  वृषभ:   "taurus",
  मिथुन:  "gemini",
  कर्क:   "cancer",
  सिंह:   "leo",
  कन्या:  "virgo",
  "तुळ":  "libra",
  "तुला": "libra",
  वृश्चिक:"scorpio",
  धनु:    "sagittarius",
  मकर:    "capricorn",
  कुंभ:   "aquarius",
  मीन:    "pisces",
};

// ─── "Not found" messages per language ───────────────────────────────────────

const NOT_FOUND_MSG = {
  en: "We are working on this combination. Our astrologers are preparing your health reading — please check back soon.",
  hi: "हम इस संयोजन पर काम कर रहे हैं। हमारे ज्योतिषी आपका स्वास्थ्य विवरण तैयार कर रहे हैं — कृपया जल्द ही वापस देखें।",
  mr: "आम्ही या संयोजनावर काम करत आहोत. आमचे ज्योतिषी आपले आरोग्य वाचन तयार करत आहेत — कृपया लवकरच पुन्हा तपासा.",
};

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

const normaliseSign = (value) => {
  if (!value) return null;
  return RASHI_MAP[value.trim().toLowerCase()] || null;
};

// ─── 1. GET health reading by rashi + lagna + language ───────────────────────

export const getHealthReading = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const rawRashi  = req.query.rashi  || req.body.rashi;
  const rawLagna  = req.query.lagna  || req.body.lagna;
  const rawLang   = (req.query.language || req.body.language || "en").toLowerCase().trim();

  const lang = SUPPORTED_LANGUAGES.includes(rawLang) ? rawLang : "en";

  const rashiKey = normaliseSign(rawRashi);
  const lagnaKey = normaliseSign(rawLagna);

  if (!rashiKey) {
    return res.status(400).json({
      success: false,
      message: `Invalid rashi/moon sign: "${rawRashi}". Accepted values: ${Object.keys(RASHI_MAP).join(", ")}`,
    });
  }

  if (!lagnaKey) {
    return res.status(400).json({
      success: false,
      message: `Invalid lagna/ascendant: "${rawLagna}". Accepted values: ${Object.keys(RASHI_MAP).join(", ")}`,
    });
  }

  try {
    const record = await HealthAstrology.findOne({
      "rashi.en": rashiKey,
      "lagna.en": lagnaKey,
      category: "health",
      isPublished: true,
    });

    // Record not found → return friendly "working on it" message
    if (!record) {
      return res.status(200).json({
        success: true,
        found: false,
        rashi:    rawRashi,
        lagna:    rawLagna,
        language: lang,
        message:  NOT_FOUND_MSG[lang],
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      code:     record.code,
      rashi:    record.rashi[lang]  || record.rashi.en,
      lagna:    record.lagna[lang]  || record.lagna.en,
      language: lang,
      content:  record.content[lang] || record.content.en,
      category: record.category,
    });
  } catch (error) {
    console.error("getHealthReading error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. GET all available rashi+lagna combinations (published only) ───────────

export const getAvailableCombinations = async (req, res) => {
  const rawLang = (req.query.language || "en").toLowerCase().trim();
  const lang    = SUPPORTED_LANGUAGES.includes(rawLang) ? rawLang : "en";

  try {
    const records = await HealthAstrology.find(
      { category: "health", isPublished: true },
      { code: 1, rashi: 1, lagna: 1, _id: 0 }
    ).sort({ code: 1 });

    const combinations = records.map((r) => ({
      code:  r.code,
      rashi: r.rashi[lang] || r.rashi.en,
      lagna: r.lagna[lang] || r.lagna.en,
    }));

    return res.status(200).json({
      success: true,
      language: lang,
      total: combinations.length,
      data: combinations,
    });
  } catch (error) {
    console.error("getAvailableCombinations error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. GET all readings for a given rashi (all 12 lagnas) ───────────────────

export const getReadingsByRashi = async (req, res) => {
  const rawRashi = req.params.rashi || req.query.rashi;
  const rawLang  = (req.query.language || "en").toLowerCase().trim();
  const lang     = SUPPORTED_LANGUAGES.includes(rawLang) ? rawLang : "en";

  const rashiKey = normaliseSign(rawRashi);

  if (!rashiKey) {
    return res.status(400).json({
      success: false,
      message: `Invalid rashi: "${rawRashi}"`,
    });
  }

  try {
    const records = await HealthAstrology.find(
      { "rashi.en": rashiKey, category: "health", isPublished: true },
      { code: 1, rashi: 1, lagna: 1, content: 1, _id: 0 }
    ).sort({ code: 1 });

    return res.status(200).json({
      success: true,
      rashi:    rashiKey,
      language: lang,
      total:    records.length,
      data: records.map((r) => ({
        code:    r.code,
        rashi:   r.rashi[lang]   || r.rashi.en,
        lagna:   r.lagna[lang]   || r.lagna.en,
        content: r.content[lang] || r.content.en,
      })),
    });
  } catch (error) {
    console.error("getReadingsByRashi error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 4. SEED — load JSON data into MongoDB (run once / admin use) ─────────────

export const seedHealthData = async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "../data/healthAstrology.json");
    const raw      = readFileSync(dataPath, "utf-8");
    const records  = JSON.parse(raw);

    let inserted = 0;
    let skipped  = 0;

    for (const record of records) {
      const exists = await HealthAstrology.findOne({ code: record.code });
      if (exists) {
        skipped++;
        continue;
      }
      await HealthAstrology.create({ ...record, category: "health" });
      inserted++;
    }

    return res.status(200).json({
      success: true,
      message: `Seed complete. ${inserted} records inserted, ${skipped} already existed.`,
      data: { inserted, skipped, total: records.length },
    });
  } catch (error) {
    console.error("seedHealthData error:", error);
    return res.status(500).json({ success: false, message: "Seeding failed", error: error.message });
  }
};

// ─── 5. UPSERT a single reading (admin: add/update a combination) ──────────────

export const upsertHealthReading = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const { code, rashi, lagna, content, isPublished } = req.body;

  try {
    const record = await HealthAstrology.findOneAndUpdate(
      { code },
      { $set: { code, rashi, lagna, content, category: "health", ...(isPublished !== undefined && { isPublished }) } },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Health reading saved successfully",
      data: record,
    });
  } catch (error) {
    console.error("upsertHealthReading error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
