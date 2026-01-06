const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: [true, 'Discount percentage is required'],
    min: [0, 'Discount must be positive'],
    max: [100, 'Discount cannot exceed 100%']
  },
  minPurchase: {
    type: Number,
    default: 0
  },
  maxPurchase: {
    type: Number,
    default: Number.MAX_SAFE_INTEGER // maximum cart value for applicability
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  usageLimit: {
    type: Number,
    default: 1, // how many times the coupon can be used
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0, // how many times the coupon has been used
    min: 0
  }
}, {
  timestamps: true
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
