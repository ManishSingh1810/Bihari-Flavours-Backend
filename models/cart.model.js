const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', // links to Product model
    required: true
  },
  photo: {
    type: String,
    required: [true, 'Product image URL is required'],
    match: [/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/, 'Invalid image URL format']
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // links to User model
    required: true
  },
  cartItems: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0 // total price of all cart items
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
