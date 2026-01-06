const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({

  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    unique: true
  },

  desc: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },

  /* ----------------------------
     🔁 CHANGED: photo → photos[]
  ---------------------------- */
  photos: {
    type: [String],
    required: [true, 'At least one product image is required'],
    validate: {
      validator: function (arr) {
        return Array.isArray(arr) && arr.length > 0;
      },
      message: 'Product must have at least one image'
    },
    match: [
      /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/,
      'Invalid image URL format'
    ]
  },

  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price must be a positive number']
  },

  quantity: {
    type: String,
    enum: ['instock', 'outofstock'],
    default: 'instock'
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
