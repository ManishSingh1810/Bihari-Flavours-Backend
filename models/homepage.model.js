const mongoose = require("mongoose");

const heroSlideSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const homepageSchema = new mongoose.Schema(
  {
    // Singleton guard (only one doc should exist)
    key: { type: String, default: "default", unique: true, index: true },
    heroSlides: { type: [heroSlideSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Homepage", homepageSchema);

