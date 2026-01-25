const mongoose = require('mongoose');

/* ----------------------------
   SUBSCHEMA: ORDER ITEM
---------------------------- */
const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  priceAtAdd: {
    type: Number,
    required: true
  },
  variantLabel: {
    type: String,
    default: ""
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  }
});

/* ----------------------------
   TEMP ORDER SCHEMA
   (100% SAME AS ORDER)
---------------------------- */
const orderSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function (arr) {
        return Array.isArray(arr) && arr.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },

  totalAmount: {
    type: Number,
    required: true
  },

  shippingAddress: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    street: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    postalCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },

  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },

  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },

  paymentMethod: {
    type: String,
    enum: ['UPI', 'COD', 'Credit Card', 'Debit Card', 'Net Banking','ONLINE'],
    required: true
  },

  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },

  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionModel'
  },

  razorpayOrderId: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },

  /* ----------------------------
     🟢 ONLY EXTRA FIELD
     Auto delete after 24 hours
  ---------------------------- */
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 } // TTL Index
  }

}, { timestamps: true });

module.exports = mongoose.model('TempOrder', orderSchema);
