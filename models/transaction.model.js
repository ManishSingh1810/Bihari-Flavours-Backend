const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  }
});

const transactionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ✅ Prevent empty transaction
  items: {
    type: [transactionItemSchema],
    required: true,
    validate: {
      validator: arr => Array.isArray(arr) && arr.length > 0,
      message: 'Transaction must contain at least one item'
    }
  },

  amount: {
    type: Number,
    required: true
  },

  // UNCHANGED enum
  paymentMethod: {
    type: String,
    enum: ['UPI','COD','Credit Card','Debit Card','Net Banking','ONLINE'],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ['Pending','Success','Failed'],
    default: 'Pending'
  },

  // Must always be generated
  transactionId: {
    type: String,
    unique: true,
    required: true
  }

}, { timestamps: true });

// ✅ IMPORTANT: name must match Order.ref
module.exports = mongoose.model('TransactionModel', transactionSchema);
