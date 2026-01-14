const { sendOtpEmail } = require("../utils/mail.service");
const Otp = require("../models/otp.model");
const User = require("../models/user.model");
const { generateToken } = require("../utils/jwt");

const VALID_PURPOSES = ["signup", "login", "forgot"];

const isProduction = process.env.NODE_ENV === "production";


/* ---------------- COOKIE OPTIONS ---------------- */
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "None" : "Lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

/* =====================
   SEND OTP (EMAIL)
===================== */
exports.sendOtpController = async (req, res) => {
  try {
    let { email, purpose } = req.body;
    console.log(req.body);

    if (!email || !purpose || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or purpose",
      });
    }
   

    email = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email });

    if (purpose === "signup" && existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    if ((purpose === "login" || purpose === "forgot") && !existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save / overwrite OTP
    await Otp.findOneAndUpdate(
      { email, purpose },
      {
        email,
        purpose,
        otp,
        status: "pending",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    // Send OTP via email
    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      purpose,
    });
  } catch (error) {
    console.error("Send OTP error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

/* =====================
   RESEND OTP (EMAIL)
===================== */
exports.resendOtpController = async (req, res) => {
  try {
    let { email, purpose } = req.body;

    if (!email || !purpose || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or purpose",
      });
    }

    email = email.toLowerCase().trim();

    const existingOtp = await Otp.findOne({
      email,
      purpose,
      status: "pending",
    });

    if (!existingOtp) {
      return res.status(404).json({
        success: false,
        message: "No OTP found. Please request a new OTP.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email, purpose },
      {
        otp,
        status: "pending",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { new: true }
    );

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      purpose,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

/* =====================
   VERIFY OTP (EMAIL)
===================== */
exports.verifyOtpController = async (req, res) => {
  try {
    let { email, code, purpose } = req.body;

    if (!email || !code || !purpose || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    email = email.toLowerCase().trim();

    const otpEntry = await Otp.findOne({
      email,
      purpose,
      status: "pending",
    });

    if (!otpEntry) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or already used",
      });
    }

    if (otpEntry.expiresAt < new Date()) {
      otpEntry.status = "expired";
      await otpEntry.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (otpEntry.otp !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    /* =====================
       OTP VERIFIED
    ===================== */

    if (purpose === "login" || purpose === "forgot") {
      await Otp.deleteOne({ _id: otpEntry._id });

      const user = await User.findOne({ email }).select("-password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const token = generateToken(user);
      res.cookie("token", token, cookieOptions);

      const responseData = {
        success: true,
        message: "OTP verified successfully",
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };

      if (!isProduction) responseData.token = token;

      return res.status(200).json(responseData);
    }

    /* =====================
       SIGNUP FLOW
    ===================== */

    otpEntry.status = "verified";
    await otpEntry.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

