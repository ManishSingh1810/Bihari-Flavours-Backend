// routes/coupon.routes.js
const express = require("express");
const router = express.Router();
const { adminProtect } = require("../middleware/admin.middleware");
const {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons
} = require("../controllers/coupon.controller");

// All routes are admin-only
router.use(adminProtect);

router.post("/", createCoupon);
router.put("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);
router.get("/", getAllCoupons);

module.exports = router;
