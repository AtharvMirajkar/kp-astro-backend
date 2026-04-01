import cron from "node-cron";
import DailyHoroscope from "../models/DailyHoroscope.js";
import { scrapeAllSigns } from "../services/astrosageScraper.js";

const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
const toDateString = (d) => d.toISOString().split("T")[0];

export const runDailyScrapeJob = async () => {
  const today = todayUTC(); const dateString = toDateString(today);
  console.log(`\n[CronJob] ▶ Daily scrape (EN+HI+MR) — ${dateString}`);
  try {
    const { results, failures } = await scrapeAllSigns();
    if (!results.length) { console.error("[CronJob] ✗ All signs failed."); return; }

    const bulkOps = results.map((s) => ({
      updateOne: {
        filter: { sign: s.sign, date: today },
        update: { $set: { sign: s.sign, date: today, dateString, prediction: s.prediction, luckyNumber: s.luckyNumber, luckyColor: s.luckyColor, remedy: s.remedy, ratings: s.ratings, scraped: s.scraped, author: s.author || "Punit Pandey", updatedDate: s.updatedDate || dateString, sourceUrl: s.sourceUrl } },
        upsert: true,
      },
    }));

    const br = await DailyHoroscope.bulkWrite(bulkOps, { ordered: false });
    const saved = (br.upsertedCount || 0) + (br.modifiedCount || 0);
    const lc = { en: 0, hi: 0, mr: 0 };
    results.forEach((r) => { if (r.scraped?.en) lc.en++; if (r.scraped?.hi) lc.hi++; if (r.scraped?.mr) lc.mr++; });
    console.log(`[CronJob] ✔ ${results.length}/12 scraped, ${saved} saved — EN:${lc.en} HI:${lc.hi} MR:${lc.mr}`);
    if (failures.length) console.warn(`[CronJob] ⚠ Failed: ${failures.map((f) => f.sign).join(", ")}`);
  } catch (err) { console.error("[CronJob] ✗ Fatal:", err.message); }
};

export const registerHoroscopeCronJob = () => {
  cron.schedule("30 0 * * *", runDailyScrapeJob, { timezone: "UTC" });
  console.log("✅ Horoscope cron registered — 06:00 AM IST (EN+HI+MR)");
};
