/**
 * Daily Horoscope Cron Job
 * Runs at 06:00 AM IST (00:30 UTC) every day.
 * Scrapes all 12 signs from AstroSage and bulk-upserts into MongoDB.
 */

import cron from "node-cron";
import DailyHoroscope from "../models/DailyHoroscope.js";
import { scrapeAllSigns } from "../services/astrosageScraper.js";

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const toDateString = (d) => d.toISOString().split("T")[0];

export const runDailyScrapeJob = async () => {
  const today      = todayUTC();
  const dateString = toDateString(today);
  console.log(`\n[CronJob] ▶ Daily horoscope scrape — ${dateString}`);

  try {
    const { results, failures } = await scrapeAllSigns();

    if (!results.length) {
      console.error("[CronJob] ✗ All signs failed. No data saved.");
      return;
    }

    const bulkOps = results.map((scraped) => ({
      updateOne: {
        filter: { sign: scraped.sign, date: today },
        update: {
          $set: {
            sign:        scraped.sign,
            date:        today,
            dateString,
            prediction:  scraped.prediction,
            luckyNumber: scraped.luckyNumber,
            luckyColor:  scraped.luckyColor,
            remedy:      scraped.remedy,
            ratings:     scraped.ratings,
            author:      scraped.author      || "Punit Pandey",
            updatedDate: scraped.updatedDate || dateString,
            sourceUrl:   scraped.sourceUrl,
          },
        },
        upsert: true,
      },
    }));

    const bulkResult = await DailyHoroscope.bulkWrite(bulkOps, { ordered: false });
    const saved = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);

    console.log(`[CronJob] ✔ ${results.length}/12 scraped, ${saved} saved.`);
    if (failures.length) {
      console.warn(`[CronJob] ⚠ Failed: ${failures.map((f) => `${f.sign} (${f.error})`).join(", ")}`);
    }
  } catch (err) {
    console.error("[CronJob] ✗ Fatal error:", err.message);
  }
};

export const registerHoroscopeCronJob = () => {
  // 00:30 UTC = 06:00 AM IST
  cron.schedule("30 0 * * *", runDailyScrapeJob, { timezone: "UTC" });
  console.log("✅ Horoscope cron registered — fires daily at 06:00 AM IST (00:30 UTC)");
};
