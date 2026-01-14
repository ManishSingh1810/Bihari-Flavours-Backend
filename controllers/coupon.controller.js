// controllers/coupon.controller.js
const Coupon = require("../models/coupon.model");

// =====================
// CREATE COUPON
// =====================
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountPercentage, minPurchase, maxPurchase, usageLimit } = req.body;

    if (!code || discountPercentage == null) {
      return res.status(400).json({ success: false, message: "Code and discount percentage are required" });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountPercentage,
      minPurchase: minPurchase || 0,
      maxPurchase: maxPurchase || Number.MAX_SAFE_INTEGER,
      usageLimit: usageLimit || 1,
      status: "active" // always active on creation
    });

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(500).json({ success: false, message: "Failed to create coupon", error: error.message });
  }
};

// =====================
// UPDATE COUPON STATUS
// =====================
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // active or inactive

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'active' or 'inactive'" });
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      coupon
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({ success: false, message: "Failed to update coupon", error: error.message });
  }
};

// =====================
// DELETE COUPON
// =====================
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({ success: false, message: "Failed to delete coupon", error: error.message });
  }
};

// =====================
// GET ALL COUPONS
// =====================
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Coupons retrieved successfully",
      coupons
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    res.status(500).json({ success: false, message: "Failed to get coupons", error: error.message });
  }
};

// =====================
// APPLY COUPON (USER)
// =====================
exports.applyCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), status: "active" });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon" });
    }

const total = Number(req.body.cartTotal || req.body.cartAmount || 0);


    if (total < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase is ₹${coupon.minPurchase}`,
      });
    }

    if (total > coupon.maxPurchase) {
      return res.status(400).json({
        success: false,
        message: `Maximum purchase for this coupon is ₹${coupon.maxPurchase}`,
      });
    }

    // Basic discount calculation
    const discount = Math.round((total * coupon.discountPercentage) / 100);
    const finalTotal = Math.max(total - discount, 0);

    return res.status(200).json({
      success: true,
      message: "Coupon applied",
      coupon: {
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
      },
      discount,
      finalTotal,
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    return res.status(500).json({ success: false, message: "Failed to apply coupon" });
  }
};

