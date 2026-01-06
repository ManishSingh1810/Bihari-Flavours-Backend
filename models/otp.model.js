const mongoose = require("mongoose");

const VALID_PURPOSES = ["signup", "login", "forgot"];

const otpSchema = new mongoose.Schema(
  {
    // ✅ Replace phone with email
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    purpose: {
      type: String,
      enum: VALID_PURPOSES,
      required: true,
      index: true,
    },

    otp: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "expired"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// ✅ TTL index (auto-delete expired OTPs)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
