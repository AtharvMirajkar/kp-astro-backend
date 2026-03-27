import DailyHoroscope from "../models/DailyHoroscope.js";
import { scrapeSignHoroscope, scrapeAllSigns, SIGNS } from "../services/astrosageScraper.js";
import { validationResult } from "express-validator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

const toDateString = (d) => d.toISOString().split("T")[0];

/** Consistent response shape for a single record */
const formatRecord = (r) => ({
  sign:        r.sign,
  date:        r.dateString,
  prediction:  r.prediction,
  luckyNumber: r.luckyNumber,
  luckyColor:  r.luckyColor,
  remedy:      r.remedy,
  ratings:     r.ratings,       // { health, wealth, family, loveMatters, occupation, marriedLife }
  author:      r.author,
  updatedDate: r.updatedDate,
  sourceUrl:   r.sourceUrl,
  lastUpdated: r.updatedAt,
});

/** Build the $set object for upserts — maps scraped fields to schema fields */
const buildSetPayload = (scraped, date, dateString) => ({
  sign:        scraped.sign,
  date,
  dateString,
  prediction:  scraped.prediction,
  luckyNumber: scraped.luckyNumber,
  luckyColor:  scraped.luckyColor,
  remedy:      scraped.remedy,
  ratings:     scraped.ratings,
  author:      scraped.author      || "Punit Pandey",
  updatedDate: scraped.updatedDate || dateString,
  sourceUrl:   scraped.sourceUrl,
});

// ─── 1. GET horoscope for one sign ───────────────────────────────────────────

export const getDailyHoroscope = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const sign      = req.params.sign.toLowerCase().trim();
  const dateParam = req.query.date;

  let targetDate;
  if (dateParam) {
    targetDate = new Date(dateParam + "T00:00:00.000Z");
    if (isNaN(targetDate)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }
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
        message:
          "Horoscope not yet available for this sign and date. " +
          "Data is refreshed daily at 06:00 AM IST. " +
          "Trigger a manual refresh: POST /api/horoscope/scrape/all",
      });
    }

    return res.status(200).json({ success: true, data: formatRecord(record) });
  } catch (err) {
    console.error("getDailyHoroscope error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. GET today's horoscope for ALL 12 signs ───────────────────────────────

export const getAllSignsHoroscope = async (req, res) => {
  const dateParam = req.query.date;
  let targetDate;

  if (dateParam) {
    targetDate = new Date(dateParam + "T00:00:00.000Z");
    if (isNaN(targetDate)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }
  } else {
    targetDate = todayUTC();
  }

  try {
    const records = await DailyHoroscope.find({ date: targetDate }).sort({ sign: 1 });

    return res.status(200).json({
      success: true,
      date:    toDateString(targetDate),
      total:   records.length,
      data:    records.map(formatRecord),
    });
  } catch (err) {
    console.error("getAllSignsHoroscope error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. SCRAPE & SAVE — single sign (on-demand) ──────────────────────────────

export const scrapeAndSaveSingleSign = async (req, res) => {
  const validationError = handleValidationErrors(req, res);
  if (validationError) return;

  const sign = req.params.sign.toLowerCase().trim();

  try {
    console.log(`[Controller] Manual scrape triggered: ${sign}`);
    const scraped    = await scrapeSignHoroscope(sign);
    const today      = todayUTC();
    const dateString = toDateString(today);

    const record = await DailyHoroscope.findOneAndUpdate(
      { sign, date: today },
      { $set: buildSetPayload(scraped, today, dateString) },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: `Horoscope scraped and saved for ${sign} (${dateString})`,
      data:    formatRecord(record),
    });
  } catch (err) {
    console.error(`scrapeAndSaveSingleSign error (${sign}):`, err.message);
    return res.status(502).json({
      success: false,
      message: err.message || "Scraping failed. AstroSage may be unreachable.",
    });
  }
};

// ─── 4. SCRAPE & SAVE — all 12 signs ─────────────────────────────────────────

export const scrapeAndSaveAllSigns = async (req, res) => {
  try {
    console.log("[Controller] Full scrape triggered for all 12 signs...");
    const today      = todayUTC();
    const dateString = toDateString(today);

    const { results, failures } = await scrapeAllSigns();

    if (!results.length) {
      return res.status(502).json({
        success: false,
        message: "Scraping failed for all signs. Check server logs.",
        failures,
      });
    }

    const bulkOps = results.map((scraped) => ({
      updateOne: {
        filter: { sign: scraped.sign, date: today },
        update: { $set: buildSetPayload(scraped, today, dateString) },
        upsert: true,
      },
    }));

    const bulkResult = await DailyHoroscope.bulkWrite(bulkOps, { ordered: false });
    const saved = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);

    return res.status(200).json({
      success:  failures.length === 0,
      date:     dateString,
      scraped:  results.length,
      saved,
      failed:   failures.length,
      failures: failures.length ? failures : undefined,
      message:
        failures.length === 0
          ? `All 12 signs scraped and saved for ${dateString}`
          : `${results.length}/12 signs saved. ${failures.length} failed.`,
    });
  } catch (err) {
    console.error("scrapeAndSaveAllSigns error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. GET history for a sign (last N days) ─────────────────────────────────

export const getHoroscopeHistory = async (req, res) => {
  const sign = req.params.sign.toLowerCase().trim();
  const days = Math.min(parseInt(req.query.days) || 7, 30);

  if (!SIGNS.includes(sign)) {
    return res.status(400).json({ success: false, message: `Invalid sign: "${sign}"` });
  }

  try {
    const from = new Date(todayUTC());
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const records = await DailyHoroscope
      .find({ sign, date: { $gte: from } })
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      sign,
      days,
      total: records.length,
      data:  records.map(formatRecord),
    });
  } catch (err) {
    console.error("getHoroscopeHistory error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 6. GET list of supported signs ──────────────────────────────────────────

export const getSupportedSigns = (_req, res) =>
  res.status(200).json({ success: true, total: SIGNS.length, signs: SIGNS });
