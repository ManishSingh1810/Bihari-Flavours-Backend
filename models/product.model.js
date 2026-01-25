const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    sku: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const comboItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantLabel: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

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

  // Manual ordering (lower comes first)
  displayOrder: { type: Number, default: 9999 },

  // Combos/Packs
  productType: { type: String, enum: ["single", "combo"], default: "single" },
  comboItems: { type: [comboItemSchema], default: [] },
  comboPriceMode: { type: String, enum: ["fixed", "sumMinusDiscount"], default: "fixed" },
  comboDiscount: { type: Number, default: 0, min: 0 },
  showInCombosSection: { type: Boolean, default: false },

  // ✅ Size variants (optional)
  // Backward compatible: if missing/empty, use product.price + product.quantity (instock/outofstock)
  variants: {
    type: [variantSchema],
    default: [],
  },

  quantity: {
    type: String,
    enum: ['instock', 'outofstock'],
    default: 'instock'
  },
  netQuantity: { type: String, default: "" },
shelfLife: { type: String, default: "" },
ingredients: { type: String, default: "" },
storage: { type: String, default: "" },
country: { type: String, default: "India" },


}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);

