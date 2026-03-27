/**
 * AstroSage Daily Horoscope Scraper
 * ─────────────────────────────────────────────────────────────────────────────
 * URL: https://www.astrosage.com/horoscope/daily-{sign}-horoscope.asp
 *
 * EXACT page structure (verified 27 Mar 2026):
 *
 *  <h1>Aquarius Daily Horoscope - Aquarius Horoscope Today</h1>
 *  Author: Punit Pandey | Updated Fri, 27 Mar 2026 12:01 AM IST
 *  "Friday, March 27, 2026"                          ← plain text / <p>
 *
 *  "Health of spouse needs proper care..."           ← ✅ ACTUAL PREDICTION
 *
 *  "To get your accurate horoscope daily on your    ← app promo — STOP
 *   smartphone, download now - AstroSage Kundli app"
 *
 *  <b>Lucky Number :-</b> 3
 *  <b>Lucky Color :-</b> Saffron and Yellow
 *  <b>Remedy :-</b> Offer coconut in running water...
 *
 *  <h2>Today's Rating</h2>
 *  <b>Health:</b>  ★☆☆☆☆
 *  <b>Wealth:</b>  ★★☆☆☆
 *  <b>Family:</b>  ★★☆☆☆
 *  <b>Love Matters:</b> ★★★★★
 *  <b>Occupation:</b>   ★★★★★
 *  <b>Married Life:</b> ★★★★★
 *
 *  [long static "about the sign" SEO text — NOT prediction]
 *
 * STRATEGY: Use a raw regex on the HTML source.
 * The prediction lives between the weekday-date string and the
 * "To get your accurate horoscope" app-promo line.
 * This completely bypasses DOM traversal ambiguity.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import axiosRetry from "axios-retry";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGN_URL =
  "https://www.astrosage.com/horoscope/daily-{sign}-horoscope.asp";

export const SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

const REQUEST_DELAY_MS = 2000;

// ─── HTTP client ──────────────────────────────────────────────────────────────

const httpClient = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Referer: "https://www.astrosage.com/horoscope/",
  },
});

axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.response?.status >= 500,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Collapse all whitespace and strip HTML tags from a string */
const stripHtml = (str = "") => str.replace(/<[^>]+>/g, " ");
const cleanText = (str = "") =>
  str
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
const stripClean = (str = "") => cleanText(stripHtml(str));

/** Count filled star images in a raw HTML snippet → returns "X/5" */
const countStarsInHtml = (html = "") => {
  const filled = (html.match(/star2\.gif/g) || []).length;
  const empty = (html.match(/star1\.gif/g) || []).length;
  const total = filled + empty;
  return total > 0 ? `${filled}/${total}` : "";
};

/**
 * Extract the value after a bold label in raw HTML.
 * Pattern: <b>Lucky Number :-</b> 3
 * Returns the text content immediately after the closing </b> tag.
 */
const extractBoldValue = (html, labelRegex) => {
  // Match <b>...label...</b> followed by text (possibly through </b> or &nbsp;)
  const re = new RegExp(
    `<(?:b|strong)[^>]*>[^<]*${labelRegex.source}[^<]*<\\/(?:b|strong)>\\s*([^<]{1,200})`,
    "i",
  );
  const m = html.match(re);
  if (m) {
    return cleanText(m[1])
      .replace(/^[:\-\s]+/, "") // strip leading :-
      .replace(/\s*<.*/, "") // strip any residual tag text
      .trim();
  }
  return "";
};

// ─── Core scraper ─────────────────────────────────────────────────────────────

export const scrapeSignHoroscope = async (sign) => {
  const url = SIGN_URL.replace("{sign}", sign.toLowerCase());

  let html;
  try {
    const { data } = await httpClient.get(url);
    html = data;
  } catch (err) {
    const status = err.response?.status;
    throw new Error(
      `Fetch failed for ${url}: ${status ? `HTTP ${status}` : err.message}`,
    );
  }

  // ── STEP 1: EXTRACT ACTUAL PREDICTION ─────────────────────────────────────
  //
  // The prediction is the text that appears:
  //   AFTER  the weekday-date line   (e.g. "Friday, March 27, 2026")
  //   BEFORE the app-promo line      ("To get your accurate horoscope daily")
  //
  // This range is extracted from raw HTML, then tags are stripped.

  let prediction = "";

  // Regex: capture everything between the date line and the app promo
  // The date appears as plain text inside a <p> tag
  const predictionRegex =
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}\s*<\/p>\s*([\s\S]*?)\s*To get your accurate horoscope/i;

  const predMatch = html.match(predictionRegex);
  if (predMatch) {
    prediction = stripClean(predMatch[1]);
  }

  // Fallback: try without the closing </p> — sometimes date is bare text
  if (!prediction) {
    const fallbackRegex =
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}([\s\S]{20,1000}?)To get your accurate horoscope/i;
    const m2 = html.match(fallbackRegex);
    if (m2) {
      prediction = stripClean(m2[1]);
    }
  }

  // Final fallback: find the <p> directly before <b>Lucky Number</b>
  // by loading into Cheerio and walking backwards
  if (!prediction) {
    const $ = cheerio.load(html);
    let luckyP = null;
    $("b, strong").each((_, el) => {
      if (!luckyP && /lucky\s*number/i.test(cleanText($(el).text()))) {
        luckyP = el;
      }
    });
    if (luckyP) {
      // Find the closest previous <p> sibling
      let prev = $(luckyP).closest("p, div").prev("p");
      while (prev.length) {
        const t = cleanText(prev.text());
        if (t.length > 30 && !/download|AstroSage Kundli/i.test(t)) {
          prediction = t;
          break;
        }
        prev = prev.prev("p");
      }
    }
  }

  if (!prediction) {
    throw new Error(
      `Could not extract prediction for "${sign}". ` +
        `AstroSage may have changed their page structure. Review astrosageScraper.js.`,
    );
  }

  // ── STEP 2: LUCKY NUMBER ───────────────────────────────────────────────────
  // Raw HTML pattern: <b>Lucky Number :-</b> 3
  let luckyNumber = extractBoldValue(html, /lucky\s+number\s*:-/i);
  if (!luckyNumber) {
    const m = html.match(
      /Lucky\s+Number\s*:-\s*(?:<\/b>|<\/strong>)\s*([0-9, ]+)/i,
    );
    if (m) luckyNumber = m[1].trim();
  }

  // ── STEP 3: LUCKY COLOR ────────────────────────────────────────────────────
  // Raw HTML pattern: <b>Lucky Color :-</b> Saffron and Yellow
  let luckyColor = extractBoldValue(html, /lucky\s+colou?r\s*:-/i);
  if (!luckyColor) {
    const m = html.match(
      /Lucky\s+Colou?r\s*:-\s*(?:<\/b>|<\/strong>)\s*([A-Za-z ,&]+?)(?:<br|<\/p|<b|\n)/i,
    );
    if (m) luckyColor = cleanText(m[1]);
  }

  // ── STEP 4: REMEDY ────────────────────────────────────────────────────────
  // Raw HTML pattern: <b>Remedy :-</b> Offer coconut in running water...
  let remedy = extractBoldValue(html, /remedy\s*:-/i);
  if (!remedy) {
    const m = html.match(
      /Remedy\s*:-\s*(?:<\/b>|<\/strong>)\s*([^<]{10,400})/i,
    );
    if (m) remedy = cleanText(m[1]);
  }

  // ── STEP 5: RATINGS ───────────────────────────────────────────────────────
  //
  // Raw HTML pattern (one per category):
  //   <b>Health:</b>  <img src=".../star2.gif"><img src=".../star1.gif">...
  //
  // We extract a small HTML slice per category and count stars in it.

  const extractRating = (categoryRegex) => {
    // Grab from the bold label up to the next <b> or <br> or </p>
    const re = new RegExp(
      `<(?:b|strong)[^>]*>\\s*${categoryRegex.source}\\s*<\\/(?:b|strong)>([\\s\\S]{0,300}?)(?=<(?:b|strong)|<br|<\\/p|<h[0-9])`,
      "i",
    );
    const m = html.match(re);
    return m ? countStarsInHtml(m[1]) : "";
  };

  const ratings = {
    health: extractRating(/health\s*:/i),
    wealth: extractRating(/wealth\s*:/i),
    family: extractRating(/family\s*:/i),
    loveMatters: extractRating(/love\s+matters?\s*:/i),
    occupation: extractRating(/occupation\s*:/i),
    marriedLife: extractRating(/married\s+life\s*:/i),
  };

  // ── STEP 6: AUTHOR & DATE ─────────────────────────────────────────────────
  const $ = cheerio.load(html);
  const author =
    cleanText($("a[href*='about-astrologer']").first().text()) ||
    "Punit Pandey";

  // Extract the "Updated <date>" from the byline
  const bylineMatch = html.match(/Updated\s+\w+,\s+(\d+\s+\w+\s+\d{4})/i);
  const updatedDate = bylineMatch ? bylineMatch[1] : "";

  return {
    sign: sign.toLowerCase(),
    prediction: cleanText(prediction),
    luckyNumber,
    luckyColor,
    remedy,
    ratings,
    author,
    updatedDate,
    sourceUrl: url,
  };
};

// ─── Scrape ALL 12 signs ──────────────────────────────────────────────────────

export const scrapeAllSigns = async ({ onProgress } = {}) => {
  const results = [];
  const failures = [];

  for (let i = 0; i < SIGNS.length; i++) {
    const sign = SIGNS[i];
    try {
      console.log(`[Scraper] (${i + 1}/${SIGNS.length}) Scraping ${sign}...`);
      const data = await scrapeSignHoroscope(sign);
      results.push(data);
      onProgress?.({ sign, success: true, index: i + 1, total: SIGNS.length });
    } catch (err) {
      console.error(`[Scraper] ✗ ${sign}: ${err.message}`);
      failures.push({ sign, error: err.message });
      onProgress?.({
        sign,
        success: false,
        error: err.message,
        index: i + 1,
        total: SIGNS.length,
      });
    }

    if (i < SIGNS.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  return { results, failures };
};
