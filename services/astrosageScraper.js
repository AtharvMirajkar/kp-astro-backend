/**
 * AstroSage Multilingual Daily Horoscope Scraper
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIRMED URL PATTERNS + PAGE STRUCTURES (verified Apr 1, 2026):
 *
 * ── ENGLISH ──────────────────────────────────────────────────────────────────
 * URL  : https://www.astrosage.com/horoscope/daily-{sign}-horoscope.asp
 * Anchor: weekday-date line → "To get your accurate horoscope"
 * Lucky : <b>Lucky Number :-</b>  <b>Lucky Color :-</b>  <b>Remedy :-</b>
 * Ratings: <b>Health:</b> <b>Wealth:</b> <b>Family:</b>
 *           <b>Love Matters:</b> <b>Occupation:</b> <b>Married Life:</b>
 *
 * ── HINDI ────────────────────────────────────────────────────────────────────
 * URL  : https://www.astrosage.com/rashifal/{slug}-rashifal.asp
 * Slugs: mesh, vrishabha, mithun, karka, simha, kanya, tula,
 *        vrishchika, dhanu, makara, kumbha, meena
 * Anchor: **Wednesday, April 1, 2026** → "अपना सटीक राशिफल"
 * Lucky : <b>शुभ अंक :-</b>  <b>शुभ रंग :-</b>  <b>उपाय :-</b>
 * Ratings: <b>स्वास्थ्य:</b>  <b>धन-सम्पत्ति:</b>  <b>परिवार:</b>
 *          <b>प्रेम आदि:</b>  <b>व्यवसाय:</b>  <b>वैवाहिक जीवन:</b>
 *
 * ── MARATHI ──────────────────────────────────────────────────────────────────
 * URL  : https://www.astrosage.com/marathi/rashi-bhavishya/{slug}-rashi-bhavishya.asp
 * CONFIRMED working slugs (verified from search results + 404 errors fixed):
 *   aries=mesh, taurus=vrishabha, gemini=mithun, cancer=karka,
 *   leo=simha, virgo=kanya, libra=tula, scorpio=vrishchik,
 *   sagittarius=dhanu, capricorn=makar, aquarius=kumbha, pisces=meen
 * Structure: same as English — prediction → "अधिक माहिती" / app promo
 * Lucky : <b>शुभ अंक :-</b>  <b>शुभ रंग :-</b>  <b>उपाय :-</b>
 * Ratings: <b>आरोग्य:</b>  <b>धन:</b>  <b>कुटुंब:</b>
 *          <b>प्रेम:</b>  <b>व्यवसाय:</b>  <b>वैवाहिक जीवन:</b>
 */

import axios from "axios";
import * as cheerio from "cheerio";
import axiosRetry from "axios-retry";

// ─── URL templates ────────────────────────────────────────────────────────────

const URL_EN = "https://www.astrosage.com/horoscope/daily-{sign}-horoscope.asp";
const URL_HI = "https://www.astrosage.com/rashifal/{sign}-rashifal.asp";
const URL_MR = "https://www.astrosage.com/marathi/rashi-bhavishya/{sign}-rashi-bhavishya.asp";

export const SIGNS = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces",
];

// ── Confirmed URL slugs ───────────────────────────────────────────────────────

const SLUG_HI = {
  aries:"mesh", taurus:"vrishabha", gemini:"mithun", cancer:"karka",
  leo:"simha", virgo:"kanya", libra:"tula", scorpio:"vrishchika",
  sagittarius:"dhanu", capricorn:"makara", aquarius:"kumbha", pisces:"meena",
};

// Confirmed from sign nav links on the live Marathi page (Apr 2026)
const SLUG_MR = {
  aries:"mesh", taurus:"vrishabha", gemini:"mithun", cancer:"karka",
  leo:"simha", virgo:"kanya", libra:"tula", scorpio:"vrishchika",
  sagittarius:"dhanu", capricorn:"makara", aquarius:"kumbha", pisces:"meena",
};

const REQUEST_DELAY_MS = 1500;

// ─── HTTP client ──────────────────────────────────────────────────────────────

const httpClient = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8,mr;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control":   "no-cache",
    "Referer":         "https://www.astrosage.com/",
  },
});

axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) || (err.response?.status >= 500),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep      = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml  = (s = "") => s.replace(/<[^>]+>/g, " ");
const cleanText  = (s = "") => s.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
const stripClean = (s = "") => cleanText(stripHtml(s));

/** Count star2.gif (filled) vs star1.gif (empty) in an HTML chunk → "X/5" */
const starsInHtml = (html = "") => {
  const filled = (html.match(/star2\.gif/g) || []).length;
  const empty  = (html.match(/star1\.gif/g) || []).length;
  const total  = filled + empty;
  return total > 0 ? `${filled}/${total}` : "";
};

/**
 * Extract text immediately after a <b>Label</b> tag.
 * Works for both English and Devanagari label patterns.
 */
const afterBold = (html, labelRegex) => {
  const re = new RegExp(
    `<(?:b|strong)[^>]*>[^<]*${labelRegex.source}[^<]*<\\/(?:b|strong)>([^<]{1,300})`,
    "i"
  );
  const m = html.match(re);
  return m ? cleanText(m[1]).replace(/^[:\-–\s]+/, "").trim() : "";
};

/** Extract star rating for a bold label */
const ratingAfterBold = (html, labelRegex) => {
  const re = new RegExp(
    `<(?:b|strong)[^>]*>[^<]*${labelRegex.source}[^<]*<\\/(?:b|strong)>([\\s\\S]{0,300}?)(?=<(?:b|strong)|<br|<\\/p|<h[0-9]|<img[^>]*sign)`,
    "i"
  );
  const m = html.match(re);
  return m ? starsInHtml(m[1]) : "";
};

// ─── ENGLISH scraper ──────────────────────────────────────────────────────────

export const scrapeEnglish = async (sign) => {
  const url = URL_EN.replace("{sign}", sign.toLowerCase());
  let html;
  try {
    const { data } = await httpClient.get(url);
    html = data;
  } catch (err) {
    throw new Error(`[EN] Fetch failed (${url}): ${err.response?.status || err.message}`);
  }

  // Prediction: between weekday-date </p> and "To get your accurate horoscope"
  let prediction = "";
  const m1 = html.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}\s*<\/p>\s*([\s\S]*?)\s*To get your accurate horoscope/i
  );
  if (m1) prediction = stripClean(m1[1]);

  if (!prediction) {
    const m2 = html.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}([\s\S]{20,1000}?)To get your accurate horoscope/i
    );
    if (m2) prediction = stripClean(m2[1]);
  }
  if (!prediction) throw new Error(`[EN] Could not extract prediction for "${sign}"`);

  const luckyNumber = afterBold(html, /lucky\s+number\s*:-/i) ||
    (html.match(/Lucky\s+Number\s*:-\s*(?:<\/b>|<\/strong>)\s*([0-9, ]+)/i) || [])[1]?.trim() || "";

  const luckyColor = afterBold(html, /lucky\s+colou?r\s*:-/i) ||
    cleanText((html.match(/Lucky\s+Colou?r\s*:-\s*(?:<\/b>|<\/strong>)\s*([A-Za-z ,&]+?)(?:<br|<\/p|<b|\n)/i) || [])[1] || "");

  const remedy = afterBold(html, /remedy\s*:-/i) ||
    cleanText((html.match(/Remedy\s*:-\s*(?:<\/b>|<\/strong>)\s*([^<]{10,400})/i) || [])[1] || "");

  const ratings = {
    health:      ratingAfterBold(html, /health\s*:/i),
    wealth:      ratingAfterBold(html, /wealth\s*:/i),
    family:      ratingAfterBold(html, /family\s*:/i),
    loveMatters: ratingAfterBold(html, /love\s+matters?\s*:/i),
    occupation:  ratingAfterBold(html, /occupation\s*:/i),
    marriedLife: ratingAfterBold(html, /married\s+life\s*:/i),
  };

  const $ = cheerio.load(html);
  const author      = cleanText($("a[href*='about-astrologer']").first().text()) || "Punit Pandey";
  const bylineMatch = html.match(/Updated\s+\w+,\s+(\d+\s+\w+\s+\d{4})/i);
  const updatedDate = bylineMatch ? bylineMatch[1] : "";

  return { prediction: cleanText(prediction), luckyNumber, luckyColor, remedy, ratings, author, updatedDate, sourceUrl: url };
};

// ─── HINDI scraper ────────────────────────────────────────────────────────────
// Page structure (confirmed from live Kumbha page):
//   **Wednesday, April 1, 2026**
//   <prediction paragraph>
//   अपना सटीक राशिफल...  ← app promo, STOP here
//   **शुभ अंक :-** 4
//   **शुभ रंग :-** भूरा और सलेटी
//   **उपाय :-** केले के पेड...
//   Ratings: स्वास्थ्य / धन-सम्पत्ति / परिवार / प्रेम आदि / व्यवसाय / वैवाहिक जीवन

export const scrapeHindi = async (sign) => {
  const slug = SLUG_HI[sign];
  if (!slug) throw new Error(`[HI] No slug defined for sign: ${sign}`);
  const url = URL_HI.replace("{sign}", slug);

  let html;
  try {
    const { data } = await httpClient.get(url);
    html = data;
  } catch (err) {
    throw new Error(`[HI] Fetch failed (${url}): ${err.response?.status || err.message}`);
  }

  // Prediction: between **weekday-date** and "अपना सटीक राशिफल"
  // Hindi pages wrap the date in **bold** markdown or plain text after <h2>
  let prediction = "";

  // Primary: between date line and app-promo
  const m1 = html.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}\s*(?:<\/(?:p|strong|b)>)?\s*<\/p>?\s*([\s\S]*?)\s*अपना\s*सटीक\s*राशिफल/i
  );
  if (m1) prediction = stripClean(m1[1]);

  // Fallback: grab text between date and app promo (different HTML wrapping)
  if (!prediction) {
    const m2 = html.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}([\s\S]{20,1500}?)अपना\s*सटीक\s*राशिफल/i
    );
    if (m2) prediction = stripClean(m2[1]);
  }

  // Second fallback: between date and शुभ अंक (lucky number label)
  if (!prediction) {
    const m3 = html.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}([\s\S]{20,1500}?)शुभ\s*अंक/i
    );
    if (m3) prediction = stripClean(m3[1]);
  }

  if (!prediction) throw new Error(`[HI] Could not extract prediction for "${sign}" from ${url}`);

  // Lucky fields (Hindi labels confirmed from live page)
  const luckyNumber = afterBold(html, /शुभ\s*अंक\s*:-/i);
  const luckyColor  = afterBold(html, /शुभ\s*रंग\s*:-/i);
  const remedy      = afterBold(html, /उपाय\s*:-/i);

  // Ratings (Hindi label names confirmed from live page)
  const ratings = {
    health:      ratingAfterBold(html, /स्वास्थ्य\s*:/i),
    wealth:      ratingAfterBold(html, /धन-सम्पत्ति\s*:/i) || ratingAfterBold(html, /धन\s*:/i),
    family:      ratingAfterBold(html, /परिवार\s*:/i),
    loveMatters: ratingAfterBold(html, /प्रेम\s*आदि\s*:/i) || ratingAfterBold(html, /प्रेम\s*:/i),
    occupation:  ratingAfterBold(html, /व्यवसाय\s*:/i),
    marriedLife: ratingAfterBold(html, /वैवाहिक\s*जीवन\s*:/i),
  };

  return { prediction: cleanText(prediction), luckyNumber, luckyColor, remedy, ratings, sourceUrl: url };
};

// ─── MARATHI scraper ──────────────────────────────────────────────────────────
// Structure is similar to English — same anchor pattern
// Lucky labels: शुभ अंक :- / शुभ रंग :- / उपाय :-
// Ratings labels (Marathi): आरोग्य / धन / कुटुंब / प्रेम / व्यवसाय / वैवाहिक जीवन

export const scrapeMarathi = async (sign) => {
  const slug = SLUG_MR[sign];
  if (!slug) throw new Error(`[MR] No slug defined for sign: ${sign}`);
  const url = URL_MR.replace("{sign}", slug);

  let html;
  try {
    const { data } = await httpClient.get(url);
    html = data;
  } catch (err) {
    throw new Error(`[MR] Fetch failed (${url}): ${err.response?.status || err.message}`);
  }

  // Strategy 1: same anchor as English — between date </p> and app promo
  // Marathi app promo text: "अचूक राशीभविष्य" or "अधिक माहिती"
  let prediction = "";

  // Confirmed Marathi page structure (Apr 2026):
  // "SignName राशी भविष्य (Weekday, Month DD, YYYY)\n<prediction>\nतुमचे सटीक राशि भविष्य..."
  // The prediction text is a PLAIN TEXT NODE directly after the "(Date)" pattern,
  // NOT inside a </p> tag. Anchor end: "तुमचे सटीक राशि भविष्य"

  // Strategy 1: between (date) and Marathi app promo text
  const m1 = html.match(
    /\((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}\)\s*([\s\S]{20,2000}?)\s*तुमचे\s*सटीक/i
  );
  if (m1) prediction = stripClean(m1[1]);

  // Strategy 2: between (date) and lucky number label "भाग्यांक"
  if (!prediction) {
    const m2 = html.match(
      /\((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}\)\s*([\s\S]{20,2000}?)\s*भाग्यांक/i
    );
    if (m2) prediction = stripClean(m2[1]);
  }

  // Strategy 3: Cheerio — first long Marathi <p> after the date heading
  if (!prediction) {
    const $ = cheerio.load(html);
    $("p").each((_, el) => {
      if (prediction) return;
      const t = cleanText($(el).text());
      if (t.length < 40) return;
      if (!/[\u0900-\u097F]/.test(t)) return;
      if (/भाग्यांक|भाग्य\s*रंग|उपाय|cookie|copyright|privacy|download|astrosage/i.test(t)) return;
      prediction = t;
    });
  }

  if (!prediction) throw new Error(`[MR] Could not extract prediction for "${sign}" from ${url}`);

  // Confirmed Marathi lucky labels (from live page Apr 2026):
  // भाग्यांक (not शुभ अंक!), भाग्य रंग (not शुभ रंग!), उपाय
  const luckyNumber = afterBold(html, /भाग्यांक\s*:-/i);
  const luckyColor  = afterBold(html, /भाग्य\s*रंग\s*:-/i);
  const remedy      = afterBold(html, /उपाय\s*:-/i);

  // Confirmed Marathi rating labels (from live page Apr 2026):
  // आरोग्य / धन / परिवार / प्रेम विषयक / व्यवसाय / वैवाहिक जीवन
  const ratings = {
    health:      ratingAfterBold(html, /आरोग्य\s*:/i),
    wealth:      ratingAfterBold(html, /धन\s*:/i),
    family:      ratingAfterBold(html, /परिवार\s*:/i),
    loveMatters: ratingAfterBold(html, /प्रेम\s*विषयक\s*:/i),
    occupation:  ratingAfterBold(html, /व्यवसाय\s*:/i),
    marriedLife: ratingAfterBold(html, /वैवाहिक\s*जीवन\s*:/i),
  };

  return { prediction: cleanText(prediction), luckyNumber, luckyColor, remedy, ratings, sourceUrl: url };
};

// ─── Scrape ONE sign — all 3 languages ───────────────────────────────────────

export const scrapeSignAllLanguages = async (sign) => {
  const result = {
    sign,
    prediction:  { en: "", hi: "", mr: "" },
    luckyNumber: { en: "", hi: "", mr: "" },
    luckyColor:  { en: "", hi: "", mr: "" },
    remedy:      { en: "", hi: "", mr: "" },
    ratings: {
      health:      { en: "", hi: "", mr: "" },
      wealth:      { en: "", hi: "", mr: "" },
      family:      { en: "", hi: "", mr: "" },
      loveMatters: { en: "", hi: "", mr: "" },
      occupation:  { en: "", hi: "", mr: "" },
      marriedLife: { en: "", hi: "", mr: "" },
    },
    author:      "Punit Pandey",
    updatedDate: "",
    sourceUrl:   "",
    scraped:     { en: false, hi: false, mr: false },
    errors:      {},
  };

  // ── English ──────────────────────────────────────────────────────────────────
  try {
    const en = await scrapeEnglish(sign);
    result.prediction.en      = en.prediction;
    result.luckyNumber.en     = en.luckyNumber;
    result.luckyColor.en      = en.luckyColor;
    result.remedy.en          = en.remedy;
    Object.keys(result.ratings).forEach((k) => { result.ratings[k].en = en.ratings[k] || ""; });
    result.author             = en.author;
    result.updatedDate        = en.updatedDate;
    result.sourceUrl          = en.sourceUrl;
    result.scraped.en         = true;
  } catch (err) {
    result.errors.en = err.message;
    console.error(`[Scraper] EN failed for ${sign}: ${err.message}`);
  }

  await sleep(REQUEST_DELAY_MS);

  // ── Hindi ────────────────────────────────────────────────────────────────────
  try {
    const hi = await scrapeHindi(sign);
    result.prediction.hi      = hi.prediction;
    result.luckyNumber.hi     = hi.luckyNumber;
    result.luckyColor.hi      = hi.luckyColor;
    result.remedy.hi          = hi.remedy;
    Object.keys(result.ratings).forEach((k) => { result.ratings[k].hi = hi.ratings[k] || ""; });
    result.scraped.hi         = true;
  } catch (err) {
    result.errors.hi = err.message;
    console.error(`[Scraper] HI failed for ${sign}: ${err.message}`);
  }

  await sleep(REQUEST_DELAY_MS);

  // ── Marathi ──────────────────────────────────────────────────────────────────
  try {
    const mr = await scrapeMarathi(sign);
    result.prediction.mr      = mr.prediction;
    result.luckyNumber.mr     = mr.luckyNumber;
    result.luckyColor.mr      = mr.luckyColor;
    result.remedy.mr          = mr.remedy;
    Object.keys(result.ratings).forEach((k) => { result.ratings[k].mr = mr.ratings[k] || ""; });
    result.scraped.mr         = true;
  } catch (err) {
    result.errors.mr = err.message;
    console.error(`[Scraper] MR failed for ${sign}: ${err.message}`);
  }

  return result;
};

// ─── Re-scrape one language for one sign ─────────────────────────────────────

export const scrapeSignSingleLanguage = async (sign, lang) => {
  if (lang === "en") return scrapeEnglish(sign);
  if (lang === "hi") return scrapeHindi(sign);
  if (lang === "mr") return scrapeMarathi(sign);
  throw new Error(`Unsupported language: "${lang}". Use en, hi, or mr.`);
};

// ─── Scrape ALL 12 signs ──────────────────────────────────────────────────────

export const scrapeAllSigns = async ({ onProgress } = {}) => {
  const results = [], failures = [];

  for (let i = 0; i < SIGNS.length; i++) {
    const sign = SIGNS[i];
    try {
      console.log(`[Scraper] (${i + 1}/${SIGNS.length}) ${sign}...`);
      const data = await scrapeSignAllLanguages(sign);
      results.push(data);
      onProgress?.({ sign, success: true, index: i + 1, total: SIGNS.length, scraped: data.scraped });
    } catch (err) {
      console.error(`[Scraper] ✗ ${sign}: ${err.message}`);
      failures.push({ sign, error: err.message });
      onProgress?.({ sign, success: false, error: err.message, index: i + 1, total: SIGNS.length });
    }
    if (i < SIGNS.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  return { results, failures };
};
