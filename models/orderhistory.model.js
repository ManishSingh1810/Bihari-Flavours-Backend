const mongoose = require('mongoose');
const { orderItemSchema } = require('./order.model');

const orderHistorySchema = new mongoose.Schema({
  // ✅ Same 4-digit id as the original order (kept forever in history)
  // sparse: true to avoid breaking existing docs after deployment
  orderCode: { type: String, unique: true, sparse: true, index: true },

  originalOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Items copied from order
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: arr => Array.isArray(arr) && arr.length > 0,
      message: 'Order history must contain at least one item'
    }
  },

  totalAmount: {
    type: Number,
    required: true
  },

  // Shipping address snapshot
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'India' }
  },

  orderStatus: {
    type: String,
    required: true
  },

  paymentStatus: {
    type: String,
    required: true
  },

  paymentMethod: {
    type: String,
    required: true
  },

  // Transaction link
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionModel',
    default: null
  },

  // TTL anchor field
  completedAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

/**
 * ✅ TTL INDEX
 * Auto-delete history after 14 days
 */
orderHistorySchema.index(
  { completedAt: 1 },
  { expireAfterSeconds: 14 * 24 * 60 * 60 }
);

module.exports =
  mongoose.models.OrderHistory ||
  mongoose.model('OrderHistory', orderHistorySchema);
