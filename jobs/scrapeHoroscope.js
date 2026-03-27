/**
 * Standalone scrape script — run manually with:
 *   npm run scrape
 *   npm run scrape -- --sign=aries
 *
 * This connects to MongoDB, runs the scraper, saves results, and exits.
 * Useful for testing or for first-time data population.
 */

import "dotenv/config";
import mongoose from "mongoose";
import DailyHoroscope from "../models/DailyHoroscope.js";
import { scrapeAllSigns, scrapeSignHoroscope } from "../services/astrosageScraper.js";

const todayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const toDateString = (d) => d.toISOString().split("T")[0];

const run = async () => {
  // ── Connect to MongoDB ───────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const today      = todayUTC();
  const dateString = toDateString(today);

  // ── Parse optional --sign=xxx CLI argument ───────────────────────────────
  const signArg = process.argv.find((a) => a.startsWith("--sign="));
  const singleSign = signArg ? signArg.split("=")[1].toLowerCase() : null;

  let results = [];
  let failures = [];

  if (singleSign) {
    console.log(`\n🔍 Scraping single sign: ${singleSign}...`);
    try {
      const data = await scrapeSignHoroscope(singleSign);
      results = [data];
    } catch (err) {
      failures = [{ sign: singleSign, error: err.message }];
      console.error(`✗ Failed: ${err.message}`);
    }
  } else {
    console.log(`\n🔍 Scraping all 12 signs for ${dateString}...`);
    ({ results, failures } = await scrapeAllSigns({
      onProgress: ({ sign, success, index, total, error }) => {
        const status = success ? "✔" : "✗";
        console.log(`  [${index}/${total}] ${status} ${sign}${error ? ` — ${error}` : ""}`);
      },
    }));
  }

  // ── Bulk upsert ──────────────────────────────────────────────────────────
  if (results.length) {
    const bulkOps = results.map((scraped) => ({
      updateOne: {
        filter: { sign: scraped.sign, date: today },
        update: {
          $set: {
            sign:        scraped.sign,
            date:        today,
            dateString,
            prediction:  scraped.prediction,
            highlights:  scraped.highlights,
            sourceUrl:   scraped.sourceUrl,
          },
        },
        upsert: true,
      },
    }));

    const bulkResult = await DailyHoroscope.bulkWrite(bulkOps, { ordered: false });
    const saved = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
    console.log(`\n✅ Saved ${saved} record(s) for ${dateString}`);
  }

  if (failures.length) {
    console.warn(`\n⚠ Failed signs (${failures.length}):`,
      failures.map((f) => `${f.sign}: ${f.error}`).join("\n  "));
  }

  await mongoose.disconnect();
  console.log("\n✅ Done. MongoDB disconnected.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
