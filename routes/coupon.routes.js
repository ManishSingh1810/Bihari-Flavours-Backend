// // routes/coupon.routes.js
// const express = require("express");
// const router = express.Router();
// const { adminProtect } = require("../middleware/admin.middleware");
// const {
//   createCoupon,
//   updateCoupon,
//   deleteCoupon,
//   getAllCoupons,
//   applyCoupon
// } = require("../controllers/coupon.controller");

// // All routes are admin-only
// router.use(adminProtect);

// router.post("/", createCoupon);
// router.put("/:id", updateCoupon);
// router.delete("/:id", deleteCoupon);
// router.get("/", getAllCoupons);

// module.exports = router;

// routes/coupon.routes.js
const express = require("express");
const router = express.Router();

const { adminProtect } = require("../middleware/admin.middleware");
const { protect } = require("../middleware/auth.middleware"); // user auth middleware

const {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons,
  applyCoupon,          // NEW
} = require("../controllers/coupon.controller");

// ✅ USER: Apply coupon (any logged-in user)
router.post("/apply", protect, applyCoupon);

// ✅ ADMIN: CRUD
router.post("/", adminProtect, createCoupon);
router.put("/:id", adminProtect, updateCoupon);
router.delete("/:id", adminProtect, deleteCoupon);
router.get("/", adminProtect, getAllCoupons);

module.exports = router;
