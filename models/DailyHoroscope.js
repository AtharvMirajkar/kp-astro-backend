import mongoose from "mongoose";

const dailyHoroscopeSchema = new mongoose.Schema(
  {
    // Zodiac sign key — primary lookup field
    sign: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      enum: [
        "aries", "taurus", "gemini", "cancer", "leo", "virgo",
        "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
      ],
    },

    // Midnight UTC date this record belongs to
    date:       { type: Date,   required: true },
    dateString: { type: String, required: true }, // "YYYY-MM-DD" for display

    // ── Main horoscope text (single combined paragraph from AstroSage) ───────
    // AstroSage does NOT have separate love/career/finance/health sections.
    // The full prediction is one (sometimes two) paragraph(s).
    prediction: { type: String, default: "" },

    // ── Highlights (confirmed present on every AstroSage sign page) ──────────
    luckyNumber: { type: String, default: "" },
    luckyColor:  { type: String, default: "" },
    remedy:      { type: String, default: "" },

    // ── Today's Ratings (confirmed 6 categories, each X/5 star format) ───────
    // Stored as "3/5", "5/5" etc. Empty string if not found.
    ratings: {
      health:      { type: String, default: "" },
      wealth:      { type: String, default: "" },
      family:      { type: String, default: "" },
      loveMatters: { type: String, default: "" },
      occupation:  { type: String, default: "" },
      marriedLife: { type: String, default: "" },
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    author:      { type: String, default: "Punit Pandey" },
    updatedDate: { type: String, default: "" }, // as shown on the page
    sourceUrl:   { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Unique: one record per sign per day
dailyHoroscopeSchema.index({ sign: 1, date: 1 }, { unique: true });
dailyHoroscopeSchema.index({ dateString: 1 });

const DailyHoroscope = mongoose.model("DailyHoroscope", dailyHoroscopeSchema);

export default DailyHoroscope;
