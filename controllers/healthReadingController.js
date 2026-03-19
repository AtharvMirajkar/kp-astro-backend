import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load data once at startup (JSON flat-file; swap to DB query when ready) ──
const rawData = JSON.parse(
  readFileSync(join(__dirname, "../data/healthData.json"), "utf-8")
);
const { health: healthData, rashiMap, _meta } = rawData;

// ─── Supported languages ──────────────────────────────────────────────────────
const SUPPORTED_LANGUAGES = ["en", "mr", "hi"];

// ─── Rashi name → index lookup (normalised, case-insensitive) ─────────────────
// Builds a flat map: "aries" → 1, "मेष" → 1, etc.
const buildRashiLookup = () => {
  const lookup = {};
  for (const [lang, signs] of Object.entries(rashiMap)) {
    for (const [name, { index }] of Object.entries(signs)) {
      lookup[name.toLowerCase()] = index;
    }
  }
  return lookup;
};
const RASHI_LOOKUP = buildRashiLookup();

// ─── Pending message templates ────────────────────────────────────────────────
const PENDING_MESSAGES = {
  en: "We are working on preparing the health reading for your Rashi and Lagna combination. Please check back soon.",
  mr: "आपल्या राशी आणि लग्नाच्या संयोगाचे आरोग्य विवेचन तयार केले जात आहे. कृपया लवकरच पुन्हा तपासा.",
  hi: "आपकी राशि और लग्न के संयोजन का स्वास्थ्य विवेचन तैयार किया जा रहा है। कृपया जल्द ही दोबारा जाँचें।",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves a user-supplied rashi/lagna string to its numeric index (1–12).
 * Accepts English names (aries), Marathi (मेष), Hindi (मेष), or bare numbers.
 */
const resolveIndex = (value) => {
  if (!value) return null;
  const normalised = String(value).trim().toLowerCase();
  // Direct numeric input
  const num = parseInt(normalised, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  // Named lookup
  return RASHI_LOOKUP[normalised] ?? null;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/health/reading
 * Query params:
 *   rashi    — Moon Sign  (e.g. "aquarius", "कुंभ", or number 11)
 *   lagna    — Ascendant  (e.g. "scorpio",  "वृश्चिक", or number 8)
 *   language — "en" | "mr" | "hi"  (default: "en")
 */
export const getHealthReading = (req, res) => {
  const { rashi, lagna, language = "en" } = req.query;

  // ── Validate language ────────────────────────────────────────────────────
  const lang = language.toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
    });
  }

  // ── Validate rashi & lagna presence ──────────────────────────────────────
  if (!rashi || !lagna) {
    return res.status(400).json({
      success: false,
      message: "Both 'rashi' (Moon Sign) and 'lagna' (Ascendant) are required.",
    });
  }

  // ── Resolve to numeric indexes ────────────────────────────────────────────
  const rashiIndex = resolveIndex(rashi);
  const lagnaIndex = resolveIndex(lagna);

  if (!rashiIndex) {
    return res.status(400).json({
      success: false,
      message: `Unrecognised rashi value: '${rashi}'. Use English (e.g. aquarius), Marathi (कुंभ), Hindi (कुंभ), or a number 1–12.`,
    });
  }
  if (!lagnaIndex) {
    return res.status(400).json({
      success: false,
      message: `Unrecognised lagna value: '${lagna}'. Use English (e.g. scorpio), Marathi (वृश्चिक), Hindi (वृश्चिक), or a number 1–12.`,
    });
  }

  // ── Look up the record ────────────────────────────────────────────────────
  const key = `${rashiIndex}_${lagnaIndex}`;
  const record = healthData[key];

  if (!record) {
    return res.status(404).json({
      success: false,
      message: "Record not found for the given combination.",
    });
  }

  // ── Content not yet authored → pending message ────────────────────────────
  if (!record.content) {
    return res.status(200).json({
      success: true,
      available: false,
      code: record.code,
      rashi: record.rashi[lang] || record.rashi.en,
      lagna: record.lagna[lang] || record.lagna.en,
      language: lang,
      message: PENDING_MESSAGES[lang],
    });
  }

  // ── Return the reading in the requested language ──────────────────────────
  const contentText = record.content[lang] || record.content.en;

  return res.status(200).json({
    success: true,
    available: true,
    code: record.code,
    category: "health",
    rashi: record.rashi[lang] || record.rashi.en,
    lagna: record.lagna[lang] || record.lagna.en,
    language: lang,
    reading: contentText,
  });
};

/**
 * GET /api/health/reading/all-languages
 * Returns the reading in all three languages at once.
 * Query params: rashi, lagna
 */
export const getHealthReadingAllLanguages = (req, res) => {
  const { rashi, lagna } = req.query;

  if (!rashi || !lagna) {
    return res.status(400).json({
      success: false,
      message: "Both 'rashi' (Moon Sign) and 'lagna' (Ascendant) are required.",
    });
  }

  const rashiIndex = resolveIndex(rashi);
  const lagnaIndex = resolveIndex(lagna);

  if (!rashiIndex) {
    return res.status(400).json({
      success: false,
      message: `Unrecognised rashi value: '${rashi}'.`,
    });
  }
  if (!lagnaIndex) {
    return res.status(400).json({
      success: false,
      message: `Unrecognised lagna value: '${lagna}'.`,
    });
  }

  const key = `${rashiIndex}_${lagnaIndex}`;
  const record = healthData[key];

  if (!record) {
    return res.status(404).json({
      success: false,
      message: "Record not found for the given combination.",
    });
  }

  if (!record.content) {
    return res.status(200).json({
      success: true,
      available: false,
      code: record.code,
      rashi: record.rashi,
      lagna: record.lagna,
      messages: PENDING_MESSAGES,
    });
  }

  return res.status(200).json({
    success: true,
    available: true,
    code: record.code,
    category: "health",
    rashi: record.rashi,
    lagna: record.lagna,
    readings: record.content,
  });
};

/**
 * GET /api/health/signs
 * Returns the full rashi / lagna sign list in all three languages.
 * Useful for populating dropdowns in the frontend / React Native app.
 */
export const getSignsList = (_req, res) => {
  const signs = Object.entries(rashiMap.en).map(([enName, { index }]) => ({
    index,
    en: enName.charAt(0).toUpperCase() + enName.slice(1),
    mr: Object.keys(rashiMap.mr).find((k) => rashiMap.mr[k].index === index) || enName,
    hi: Object.keys(rashiMap.hi).find((k) => rashiMap.hi[k].index === index) || enName,
  }));

  return res.status(200).json({
    success: true,
    message: "All 12 zodiac signs with trilingual names",
    data: signs,
  });
};

/**
 * GET /api/health/meta
 * Returns dataset metadata — total combinations, available count, etc.
 */
export const getHealthMeta = (_req, res) => {
  const total = Object.keys(healthData).length;
  const available = Object.values(healthData).filter((r) => r.content !== null).length;

  return res.status(200).json({
    success: true,
    data: {
      ..._meta,
      totalRecords: total,
      availableCombinations: available,
      pendingCombinations: total - available,
    },
  });
};
