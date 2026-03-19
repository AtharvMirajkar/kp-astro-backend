import mongoose from "mongoose";

const multiLangTextSchema = new mongoose.Schema(
  {
    en: { type: String, default: "" },
    hi: { type: String, default: "" },
    mr: { type: String, default: "" },
  },
  { _id: false }
);

const healthAstrologySchema = new mongoose.Schema(
  {
    // Unique identifier e.g. "H.1.01" (rashi number . lagna number)
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^H\.\d+\.\d+$/, "Code must follow format H.{rashiNo}.{lagnaNo} e.g. H.1.01"],
    },

    // Moon Sign / Rashi
    rashi: {
      type: multiLangTextSchema,
      required: true,
    },

    // Ascendant / Lagna
    lagna: {
      type: multiLangTextSchema,
      required: true,
    },

    // Trilingual health reading
    content: {
      type: multiLangTextSchema,
      required: true,
    },

    // Category for future expansion (health, career, finance, etc.)
    category: {
      type: String,
      default: "health",
      lowercase: true,
      trim: true,
      index: true,
    },

    // Marks whether this entry is ready or still pending content
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for the primary lookup: rashi (en) + lagna (en)
healthAstrologySchema.index({ "rashi.en": 1, "lagna.en": 1 }, { unique: true });
healthAstrologySchema.index({ category: 1, isPublished: 1 });

const HealthAstrology = mongoose.model("HealthAstrology", healthAstrologySchema);

export default HealthAstrology;
