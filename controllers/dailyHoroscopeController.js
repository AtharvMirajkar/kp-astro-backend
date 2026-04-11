import DailyHoroscope from "../models/DailyHoroscope.js";
import {
  scrapeSignAllLanguages,
  scrapeSignSingleLanguage,
  scrapeAllSigns,
  SIGNS,
} from "../services/astrosageScraper.js";
import { validationResult } from "express-validator";

const SUPPORTED_LANGS = ["en", "hi", "mr"];

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

const todayUTC = () => {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
};
const toDateString = (d) => d.toISOString().split("T")[0];

/** Pick the language-specific value from a trilingual field, fallback to EN */
const pick = (field, lang) => {
  if (!field) return "";
  return field[lang] || field.en || "";
};

/** Format one record for API response — all fields in requested language */
const formatRecord = (r, lang = "en") => ({
  sign: r.sign,
  date: r.dateString,
  language: lang,
  prediction: pick(r.prediction, lang),
  luckyNumber: pick(r.luckyNumber, lang),
  luckyColor: pick(r.luckyColor, lang),
  remedy: pick(r.remedy, lang),
  ratings: {
    health: pick(r.ratings?.health, lang),
    wealth: pick(r.ratings?.wealth, lang),
    family: pick(r.ratings?.family, lang),
    loveMatters: pick(r.ratings?.loveMatters, lang),
    occupation: pick(r.ratings?.occupation, lang),
    marriedLife: pick(r.ratings?.marriedLife, lang),
  },
  scraped: r.scraped,
  author: r.author,
  updatedDate: r.updatedDate,
  sourceUrl: r.sourceUrl,
  lastUpdated: r.updatedAt,
});

/** Build $set payload from a fully scraped result */
const buildSetPayload = (scraped, date, dateString) => ({
  sign: scraped.sign,
  date,
  dateString,
  prediction: scraped.prediction,
  luckyNumber: scraped.luckyNumber,
  luckyColor: scraped.luckyColor,
  remedy: scraped.remedy,
  ratings: scraped.ratings,
  scraped: scraped.scraped,
  author: scraped.author || "Punit Pandey",
  updatedDate: scraped.updatedDate || dateString,
  sourceUrl: scraped.sourceUrl || "",
});

// ─── 1. GET horoscope — sign + language + date ────────────────────────────────

export const getDailyHoroscope = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const sign = req.params.sign.toLowerCase().trim();
  const lang = (req.query.language || req.query.lang || "en")
    .toLowerCase()
    .trim();
  const dateParam = req.query.date;

  if (!SUPPORTED_LANGS.includes(lang)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported language. Use: en, hi, mr`,
    });
  }

  let targetDate;
  if (dateParam) {
    targetDate = new Date(dateParam + "T00:00:00.000Z");
    if (isNaN(targetDate))
      return res
        .status(400)
        .json({ success: false, message: "Invalid date. Use YYYY-MM-DD" });
  } else {
    targetDate = todayUTC();
  }

  try {
    const record = await DailyHoroscope.findOne({ sign, date: targetDate });

    if (!record) {
      return res.status(404).json({
        success: false,
        sign,
        date: toDateString(targetDate),
        language: lang,
        message:
          "Horoscope not available for this date. Data refreshes daily at 06:00 AM IST. " +
          "Manual refresh: POST /api/horoscope/scrape/all",
      });
    }

    // Warn if requested language not scraped yet
    if (!record.scraped?.[lang]) {
      return res.status(200).json({
        success: true,
        found: true,
        data: formatRecord(record, "en"),
        warning:
          `Language "${lang}" not yet scraped for this date. Showing English. ` +
          `Trigger: POST /api/horoscope/scrape/${sign}?lang=${lang}`,
      });
    }

    return res
      .status(200)
      .json({ success: true, found: true, data: formatRecord(record, lang) });
  } catch (err) {
    console.error("getDailyHoroscope error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. GET all 12 signs for today ───────────────────────────────────────────

export const getAllSignsHoroscope = async (req, res) => {
  const lang = (req.query.language || req.query.lang || "en")
    .toLowerCase()
    .trim();
  const dateParam = req.query.date;

  if (!SUPPORTED_LANGS.includes(lang)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported language. Use: en, hi, mr`,
    });
  }

  let targetDate;
  if (dateParam) {
    targetDate = new Date(dateParam + "T00:00:00.000Z");
    if (isNaN(targetDate))
      return res.status(400).json({ success: false, message: "Invalid date." });
  } else {
    targetDate = todayUTC();
  }

  try {
    const records = await DailyHoroscope.find({ date: targetDate }).sort({
      sign: 1,
    });
    return res.status(200).json({
      success: true,
      date: toDateString(targetDate),
      language: lang,
      total: records.length,
      data: records.map((r) => formatRecord(r, lang)),
    });
  } catch (err) {
    console.error("getAllSignsHoroscope error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. SCRAPE & SAVE — single sign ──────────────────────────────────────────

export const scrapeAndSaveSingleSign = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const sign = req.params.sign.toLowerCase().trim();
  const lang = (req.query.lang || "").toLowerCase().trim();

  try {
    const today = todayUTC();
    const dateString = toDateString(today);

    if (lang && SUPPORTED_LANGS.includes(lang)) {
      // Re-scrape a single language only
      console.log(
        `[Controller] Re-scraping ${lang.toUpperCase()} for: ${sign}`,
      );
      const scraped = await scrapeSignSingleLanguage(sign, lang);

      const setData = {
        [`prediction.${lang}`]: scraped.prediction,
        [`luckyNumber.${lang}`]: scraped.luckyNumber || "",
        [`luckyColor.${lang}`]: scraped.luckyColor || "",
        [`remedy.${lang}`]: scraped.remedy || "",
        [`scraped.${lang}`]: true,
      };
      // Also update per-language ratings
      const ratingKeys = [
        "health",
        "wealth",
        "family",
        "loveMatters",
        "occupation",
        "marriedLife",
      ];
      if (scraped.ratings) {
        ratingKeys.forEach((k) => {
          if (scraped.ratings[k] !== undefined)
            setData[`ratings.${k}.${lang}`] = scraped.ratings[k];
        });
      }
      if (lang === "en") {
        setData.author = scraped.author || "Punit Pandey";
        setData.updatedDate = scraped.updatedDate || dateString;
        setData.sourceUrl = scraped.sourceUrl || "";
      }

      const record = await DailyHoroscope.findOneAndUpdate(
        { sign, date: today },
        { $set: setData },
        { upsert: true, new: true, runValidators: true },
      );

      return res.status(200).json({
        success: true,
        message: `${lang.toUpperCase()} scraped for ${sign} (${dateString})`,
        data: formatRecord(record, lang),
      });
    }

    // All 3 languages
    console.log(`[Controller] Full 3-language scrape: ${sign}`);
    const scraped = await scrapeSignAllLanguages(sign);
    const record = await DailyHoroscope.findOneAndUpdate(
      { sign, date: today },
      { $set: buildSetPayload(scraped, today, dateString) },
      { upsert: true, new: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: `All languages scraped for ${sign} (${dateString})`,
      scraped: scraped.scraped,
      errors: Object.keys(scraped.errors || {}).length
        ? scraped.errors
        : undefined,
      data: formatRecord(record, "en"),
    });
  } catch (err) {
    console.error(`scrapeAndSaveSingleSign error (${sign}):`, err.message);
    return res
      .status(502)
      .json({ success: false, message: err.message || "Scraping failed" });
  }
};

// ─── 4. SCRAPE & SAVE — all 12 signs ─────────────────────────────────────────

export const scrapeAndSaveAllSigns = async (req, res) => {
  try {
    console.log("[Controller] Full scrape: all 12 signs × 3 languages...");
    const today = todayUTC();
    const dateString = toDateString(today);

    const { results, failures } = await scrapeAllSigns();

    if (!results.length) {
      return res
        .status(502)
        .json({ success: false, message: "All signs failed.", failures });
    }

    const bulkOps = results.map((s) => ({
      updateOne: {
        filter: { sign: s.sign, date: today },
        update: { $set: buildSetPayload(s, today, dateString) },
        upsert: true,
      },
    }));

    const bulkResult = await DailyHoroscope.bulkWrite(bulkOps, {
      ordered: false,
    });
    const saved =
      (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);

    const langCount = { en: 0, hi: 0, mr: 0 };
    results.forEach((r) => {
      if (r.scraped?.en) langCount.en++;
      if (r.scraped?.hi) langCount.hi++;
      if (r.scraped?.mr) langCount.mr++;
    });

    return res.status(200).json({
      success: failures.length === 0,
      date: dateString,
      scraped: results.length,
      saved,
      failed: failures.length,
      failures: failures.length ? failures : undefined,
      languages: langCount,
      message: `${results.length}/12 signs saved. EN:${langCount.en} HI:${langCount.hi} MR:${langCount.mr}`,
    });
  } catch (err) {
    console.error("scrapeAndSaveAllSigns error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. GET history ───────────────────────────────────────────────────────────

export const getHoroscopeHistory = async (req, res) => {
  const sign = req.params.sign.toLowerCase().trim();
  const lang = (req.query.language || req.query.lang || "en")
    .toLowerCase()
    .trim();
  const days = Math.min(parseInt(req.query.days) || 7, 30);

  if (!SIGNS.includes(sign))
    return res
      .status(400)
      .json({ success: false, message: `Invalid sign: "${sign}"` });
  if (!SUPPORTED_LANGS.includes(lang))
    return res
      .status(400)
      .json({ success: false, message: "Use en, hi, or mr" });

  try {
    const from = new Date(todayUTC());
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const records = await DailyHoroscope.find({
      sign,
      date: { $gte: from },
    }).sort({ date: -1 });
    return res.status(200).json({
      success: true,
      sign,
      language: lang,
      days,
      total: records.length,
      data: records.map((r) => formatRecord(r, lang)),
    });
  } catch (err) {
    console.error("getHoroscopeHistory error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 6. GET scrape coverage ───────────────────────────────────────────────────

export const getScrapeCoverage = async (req, res) => {
  const targetDate = req.query.date
    ? new Date(req.query.date + "T00:00:00.000Z")
    : todayUTC();

  if (isNaN(targetDate))
    return res.status(400).json({ success: false, message: "Invalid date" });

  try {
    const records = await DailyHoroscope.find(
      { date: targetDate },
      { sign: 1, scraped: 1 },
    ).sort({ sign: 1 });

    const byLang = { en: 0, hi: 0, mr: 0 };
    records.forEach((r) => {
      if (r.scraped?.en) byLang.en++;
      if (r.scraped?.hi) byLang.hi++;
      if (r.scraped?.mr) byLang.mr++;
    });

    return res.status(200).json({
      success: true,
      data: {
        date: toDateString(targetDate),
        total: records.length,
        byLang,
        signs: records.map((r) => ({
          sign: r.sign,
          en: !!r.scraped?.en,
          hi: !!r.scraped?.hi,
          mr: !!r.scraped?.mr,
        })),
      },
    });
  } catch (err) {
    console.error("getScrapeCoverage error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─── 7. Supported signs ───────────────────────────────────────────────────────

export const getSupportedSigns = (_req, res) =>
  res.status(200).json({
    success: true,
    total: SIGNS.length,
    signs: SIGNS,
    languages: SUPPORTED_LANGS,
  });
