/**
 * Standalone Scrape Script — run manually
 *   npm run scrape                       # all 12 signs × 3 languages
 *   npm run scrape -- --sign=aquarius    # single sign × 3 languages
 *   npm run scrape -- --sign=aquarius --lang=mr  # single sign × single language
 */

import "dotenv/config";
import mongoose from "mongoose";
import DailyHoroscope from "../models/DailyHoroscope.js";
import {
  scrapeAllSigns,
  scrapeSignAllLanguages,
  scrapeSignSingleLanguage,
  SIGNS,
} from "../services/astrosageScraper.js";

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const toDateString = (d) => d.toISOString().split("T")[0];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const today      = todayUTC();
  const dateString = toDateString(today);

  // Parse CLI args
  const signArg = process.argv.find((a) => a.startsWith("--sign="));
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const singleSign = signArg ? signArg.split("=")[1].toLowerCase() : null;
  const singleLang = langArg ? langArg.split("=")[1].toLowerCase() : null;

  let results = [], failures = [];

  if (singleSign && singleLang) {
    // Single sign + single language
    console.log(`\n🔍 Scraping ${singleLang.toUpperCase()} for: ${singleSign}`);
    try {
      const data = await scrapeSignSingleLanguage(singleSign, singleLang);
      results = [{ sign: singleSign, prediction: { [singleLang]: data.prediction }, scraped: { [singleLang]: true }, ...data }];
    } catch (err) {
      failures = [{ sign: singleSign, error: err.message }];
      console.error(`✗ ${err.message}`);
    }
  } else if (singleSign) {
    // Single sign × all 3 languages
    console.log(`\n🔍 Scraping all 3 languages for: ${singleSign}`);
    try {
      const data = await scrapeSignAllLanguages(singleSign);
      results = [data];
    } catch (err) {
      failures = [{ sign: singleSign, error: err.message }];
    }
  } else {
    // All 12 signs × all 3 languages
    console.log(`\n🔍 Scraping all 12 signs × 3 languages for ${dateString}...`);
    ({ results, failures } = await scrapeAllSigns({
      onProgress: ({ sign, success, index, total, scraped, error }) => {
        const langs = scraped
          ? `EN:${scraped.en ? "✔" : "✗"} HI:${scraped.hi ? "✔" : "✗"} MR:${scraped.mr ? "✔" : "✗"}`
          : `✗ ${error}`;
        console.log(`  [${index}/${total}] ${sign.padEnd(13)} ${langs}`);
      },
    }));
  }

  // Bulk upsert
  if (results.length) {
    const bulkOps = results.map((scraped) => {
      const setData = {
        sign:        scraped.sign,
        date:        today,
        dateString,
        luckyNumber: scraped.luckyNumber || "",
        luckyColor:  scraped.luckyColor  || "",
        remedy:      scraped.remedy      || "",
        ratings:     scraped.ratings     || {},
        author:      scraped.author      || "Punit Pandey",
        updatedDate: scraped.updatedDate || dateString,
        sourceUrl:   scraped.sourceUrl   || "",
      };

      // Build language-specific $set keys
      if (scraped.prediction?.en) setData["prediction.en"] = scraped.prediction.en;
      if (scraped.prediction?.hi) setData["prediction.hi"] = scraped.prediction.hi;
      if (scraped.prediction?.mr) setData["prediction.mr"] = scraped.prediction.mr;
      if (scraped.scraped?.en !== undefined) setData["scraped.en"] = scraped.scraped.en;
      if (scraped.scraped?.hi !== undefined) setData["scraped.hi"] = scraped.scraped.hi;
      if (scraped.scraped?.mr !== undefined) setData["scraped.mr"] = scraped.scraped.mr;

      return {
        updateOne: {
          filter: { sign: scraped.sign, date: today },
          update: { $set: setData },
          upsert: true,
        },
      };
    });

    const bulkResult = await DailyHoroscope.bulkWrite(bulkOps, { ordered: false });
    const saved = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
    console.log(`\n✅ Saved ${saved} record(s) for ${dateString}`);

    // Coverage summary
    const langCount = { en: 0, hi: 0, mr: 0 };
    results.forEach((r) => {
      if (r.scraped?.en) langCount.en++;
      if (r.scraped?.hi) langCount.hi++;
      if (r.scraped?.mr) langCount.mr++;
    });
    console.log(`📊 Language coverage — EN: ${langCount.en}  HI: ${langCount.hi}  MR: ${langCount.mr}`);
  }

  if (failures.length) {
    console.warn(`\n⚠ Failed (${failures.length}):`, failures.map((f) => `${f.sign}: ${f.error}`).join("\n  "));
  }

  await mongoose.disconnect();
  console.log("\n✅ Done.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
