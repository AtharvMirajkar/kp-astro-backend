import mongoose from "mongoose";

// Each field stored in 3 languages
const triLang = { en: { type: String, default: "" }, hi: { type: String, default: "" }, mr: { type: String, default: "" } };

const ratingsSchema = new mongoose.Schema({
  health:      triLang,
  wealth:      triLang,
  family:      triLang,
  loveMatters: triLang,
  occupation:  triLang,
  marriedLife: triLang,
}, { _id: false });

const dailyHoroscopeSchema = new mongoose.Schema(
  {
    sign:       { type: String, required: true, lowercase: true, trim: true,
                  enum: ["aries","taurus","gemini","cancer","leo","virgo",
                         "libra","scorpio","sagittarius","capricorn","aquarius","pisces"] },
    date:       { type: Date,   required: true },
    dateString: { type: String, required: true },

    // ── All major fields in 3 languages ──────────────────────────────────────
    prediction:  { type: Object, default: () => ({ en:"", hi:"", mr:"" }) },
    luckyNumber: { type: Object, default: () => ({ en:"", hi:"", mr:"" }) },
    luckyColor:  { type: Object, default: () => ({ en:"", hi:"", mr:"" }) },
    remedy:      { type: Object, default: () => ({ en:"", hi:"", mr:"" }) },

    // Each rating category also in 3 languages
    ratings: { type: ratingsSchema, default: () => ({}) },

    // ── Scrape status ─────────────────────────────────────────────────────────
    scraped: {
      en: { type: Boolean, default: false },
      hi: { type: Boolean, default: false },
      mr: { type: Boolean, default: false },
    },

    // ── Metadata ────────────────────────────────────────────────────────────────
    author:      { type: String, default: "Punit Pandey" },
    updatedDate: { type: String, default: "" },
    sourceUrl:   { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

dailyHoroscopeSchema.index({ sign: 1, date: 1 }, { unique: true });
dailyHoroscopeSchema.index({ dateString: 1 });

const DailyHoroscope = mongoose.model("DailyHoroscope", dailyHoroscopeSchema);
export default DailyHoroscope;
