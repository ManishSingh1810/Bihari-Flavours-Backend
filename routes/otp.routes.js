const express = require("express");
const router = express.Router();

const otpController = require("../controllers/otp.controller");

// =====================
// OTP Routes
// =====================

// Send OTP (signup, login, forgot password)
router.post("/send", otpController.sendOtpController);

// Resend OTP
router.post("/resend", otpController.resendOtpController);

// Verify OTP
router.post("/verify", otpController.verifyOtpController);

module.exports = router;
