const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, default: "Customer" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// One review per user per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
