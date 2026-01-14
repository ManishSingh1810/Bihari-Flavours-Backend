const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const { generateToken } = require("../utils/jwt");

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
   SIGNUP (EMAIL + OTP)
===================== */
exports.signup = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    email = email.toLowerCase().trim();

    // OTP must be verified for signup
    const otpEntry = await Otp.findOne({
      email,
      purpose: "signup",
      status: "verified",
    });

    if (!otpEntry) {
      return res.status(400).json({
        success: false,
        message: "OTP not verified",
      });
    }

    // Prevent duplicate user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create user
    const newUser = await User.create({
      name,
      email,
      password,
      role: "user",
    });

    // Cleanup OTP
    await Otp.deleteOne({ _id: otpEntry._id });

    const token = generateToken(newUser);

    res.cookie("token", token, cookieOptions);

   const responseData = {
  success: true,
  message: "User created successfully",
  token, // ✅ always return token
  user: {
    id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
  },
};

return res.status(201).json(responseData);

  }catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed",
    });
  }
};

/* =====================
   SIGNIN (EMAIL + PASSWORD)
===================== */
exports.signin = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.cookie("token", token, cookieOptions);

const responseData = {
  success: true,
  message: "Login successful",
  token, // ✅ always return token
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
};

return res.status(200).json(responseData);

  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

/* =====================
   LOGOUT
===================== */
exports.logout = async (req, res) => {
  try {
    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};




