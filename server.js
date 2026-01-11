
require("dotenv").config();
// server.js
const express = require("express");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("./config/nodemailer");

// Routes
const otpRoutes = require("./routes/otp.routes");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const couponRoutes = require("./routes/coupon.routes");
const orderRoutes = require("./routes/order.routes"); 
const {razorpayWebhook} = require("./controllers/order.controller");

const app = express();

// 🔥 START CRON JOBS
require('./jobs/tempOrderCleanup');
// --------------------
// Middlewares
// --------------------


// Restrict CORS to the frontend origin. Uses FRONTEND_URL env if provided,
const allowedOrigins = [process.env.FRONTEND_URL];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: This origin is not allowed'));
    }
  },
  credentials: true,
}));
connectDB();
app.use(cookieParser());

// --------------------
// RAZORPAY WEBHOOK (RAW BODY ONLY)
// --------------------
app.post(
  '/razorpay-webhook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);

app.use(express.json());
// --------------------
// Connect to MongoDB
// --------------------
app.use("/api/orders", orderRoutes); // ✅ Use order routes

// --------------------
// Routes
// --------------------
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);

// Base route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));

