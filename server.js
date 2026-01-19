require("dotenv").config();
// server.js
const express = require("express");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const cors = require("cors");



// Routes
const otpRoutes = require("./routes/otp.routes");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const couponRoutes = require("./routes/coupon.routes");
const orderRoutes = require("./routes/order.routes"); 
const homepageRoutes = require("./routes/homepage.routes");
const {razorpayWebhook} = require("./controllers/order.controller");
const { logout } = require("./controllers/user.controller");

const app = express();
app.set("trust proxy", 1);

// 🔥 START CRON JOBS
require('./jobs/tempOrderCleanup');
// --------------------
// Middlewares
// --------------------

// Restrict CORS to allowed frontend origins
const allowedOrigins = [
  "https://www.bihariflavours.in",
  "https://bihariflavours.in",
  "https://bihari-flavours-frontend.vercel.app",
  process.env.FRONTEND_URL, // keep env-based one too
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);


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
// LOGOUT (extra aliases for admin/frontends)
// --------------------
app.all("/api/logout", logout);
app.all("/api/admin/logout", logout);

// --------------------
// Routes
// --------------------
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api", homepageRoutes);

// Base route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: err.message });
  }
  next(err);
});

app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));


