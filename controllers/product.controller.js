const Review = require("../models/review.model");
const Product = require("../models/product.model");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/* =====================
   VARIANTS HELPERS
===================== */
const parseVariants = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    return JSON.parse(raw);
  }
  return null;
};

const normalizeVariants = (variantsRaw) => {
  if (!Array.isArray(variantsRaw)) return [];

  const out = variantsRaw.map((v) => ({
    label: String(v?.label || "").trim(),
    price: Number(v?.price),
    stock: v?.stock == null ? 0 : Number(v.stock),
    isDefault: Boolean(v?.isDefault),
    sku: String(v?.sku || "").trim(),
  }));

  for (const v of out) {
    if (!v.label) throw new Error("Variant label is required");
    if (!Number.isFinite(v.price) || v.price < 0) throw new Error("Variant price must be >= 0");
    if (!Number.isFinite(v.stock) || v.stock < 0) throw new Error("Variant stock must be >= 0");
  }

  // Unique labels
  const labels = out.map((v) => v.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    throw new Error("Variant labels must be unique");
  }

  // Ensure exactly one default
  const defaultIdx = out.findIndex((v) => v.isDefault);
  if (defaultIdx === -1 && out.length > 0) out[0].isDefault = true;
  if (defaultIdx !== -1) {
    out.forEach((v, i) => {
      if (i !== defaultIdx) v.isDefault = false;
    });
  }

  return out;
};

const getDefaultVariant = (variants) => {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.find((v) => v.isDefault) || variants[0];
};

/* =====================
   COMBOS HELPERS
===================== */
const parseComboItems = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return JSON.parse(raw);
  return null;
};

const normalizeCombo = ({ productId, productType, comboItemsRaw, comboPriceMode, comboDiscount, showInCombosSection }) => {
  const pt = productType === "combo" ? "combo" : "single";
  const mode = comboPriceMode === "sumMinusDiscount" ? "sumMinusDiscount" : "fixed";
  const discount = comboDiscount == null ? 0 : Number(comboDiscount);
  const show = Boolean(showInCombosSection);

  let comboItems = [];
  if (pt === "combo") {
    if (!Array.isArray(comboItemsRaw) || comboItemsRaw.length === 0) {
      throw new Error("comboItems must be a non-empty array for combo products");
    }
    comboItems = comboItemsRaw.map((ci) => ({
      product: String(ci?.product || "").trim(),
      variantLabel: typeof ci?.variantLabel === "string" ? ci.variantLabel.trim() : "",
      quantity: Number(ci?.quantity),
    }));

    for (const ci of comboItems) {
      if (!ci.product) throw new Error("comboItems.product is required");
      if (!Number.isFinite(ci.quantity) || ci.quantity < 1) throw new Error("comboItems.quantity must be >= 1");
      if (productId && String(ci.product) === String(productId)) throw new Error("Combo cannot include itself");
    }
  }

  if (!Number.isFinite(discount) || discount < 0) throw new Error("comboDiscount must be >= 0");

  return { productType: pt, comboItems, comboPriceMode: mode, comboDiscount: discount, showInCombosSection: show };
};

const computeComboMeta = async (productDoc) => {
  const obj = productDoc.toObject ? productDoc.toObject() : productDoc;

  const hasVariants = Array.isArray(obj.variants) && obj.variants.length > 0;
  const defaultVariant = hasVariants ? (obj.variants.find((v) => v.isDefault) || obj.variants[0]) : null;

  // Base price when comboPriceMode=fixed OR for single products
  const basePrice = defaultVariant ? Number(defaultVariant.price) : Number(obj.price);

  // Single product: computedComboPrice is just its effective display price
  if (obj.productType !== "combo") {
    return {
      ...obj,
      computedComboPrice: Number.isFinite(basePrice) ? basePrice : Number(obj.price) || 0,
      computedComboInStock: obj.quantity === "instock",
    };
  }

  // Combo: compute in-stock and computed price
  const comboItems = Array.isArray(obj.comboItems) ? obj.comboItems : [];
  let sum = 0;
  let inStock = true;

  for (const ci of comboItems) {
    const p = ci.product && ci.product._id ? ci.product : null; // populated
    if (!p) {
      inStock = false;
      continue;
    }

    const pHasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    const pDef = pHasVariants ? (p.variants.find((v) => v.isDefault) || p.variants[0]) : null;
    const chosen =
      pHasVariants
        ? (p.variants.find((v) => v.label === (ci.variantLabel || "")) || (ci.variantLabel ? null : pDef))
        : null;

    if (pHasVariants) {
      if (!chosen) {
        inStock = false;
        continue;
      }
      const needed = Number(ci.quantity) || 0;
      const avail = Number(chosen.stock) || 0;
      if (avail < needed) inStock = false;
      sum += (Number(chosen.price) || 0) * needed;
    } else {
      if (p.quantity !== "instock") inStock = false;
      sum += (Number(p.price) || 0) * (Number(ci.quantity) || 0);
    }
  }

  const computedComboPrice =
    obj.comboPriceMode === "sumMinusDiscount"
      ? Math.max(sum - (Number(obj.comboDiscount) || 0), 0)
      : (Number.isFinite(basePrice) ? basePrice : Number(obj.price) || 0);

  // ✅ Backward-compatible response shape:
  // If comboItems.product was populated into an object, convert it back to just the id.
  // (Some frontends accidentally render comboItems.product directly and crash if it's an object.)
  const safeComboItems = comboItems.map((ci) => {
    const p = ci?.product;
    const id = p && typeof p === "object" ? (p._id || p) : p;
    return {
      ...ci,
      product: id,
    };
  });

  return {
    ...obj,
    comboItems: safeComboItems,
    computedComboPrice,
    computedComboInStock: inStock,
  };
};

/* ======================================================
   ADD PRODUCT (MULTIPLE IMAGES)
====================================================== */
exports.addProduct = async (req, res) => {
  try {
    const { name, desc, price, quantity, netQuantity, shelfLife, ingredients, storage, country } = req.body;
    const displayOrder = req.body?.displayOrder == null ? undefined : Number(req.body.displayOrder);

    // Combos
    let comboNormalized = { productType: "single", comboItems: [], comboPriceMode: "fixed", comboDiscount: 0, showInCombosSection: false };
    try {
      const comboItemsParsed = parseComboItems(req.body?.comboItems);
      comboNormalized = normalizeCombo({
        productId: null,
        productType: req.body?.productType,
        comboItemsRaw: comboItemsParsed,
        comboPriceMode: req.body?.comboPriceMode,
        comboDiscount: req.body?.comboDiscount,
        showInCombosSection: req.body?.showInCombosSection,
      });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message || "Invalid combo config" });
    }

    let variants = [];
    try {
      const parsed = parseVariants(req.body?.variants);
      if (parsed) variants = normalizeVariants(parsed);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message || "Invalid variants" });
    }

    /* ----------------------------
       VALIDATION
    ---------------------------- */
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });
    }

  const existingProduct = await Product.findOne({ name: name.trim() }).collation({ locale: "en", strength: 2 });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this name already exists"
      });
    }

    /* ----------------------------
       UPLOAD IMAGES TO CLOUDINARY
    ---------------------------- */
    const imageUrls = [];

    for (const file of req.files) {
      const upload = await cloudinary.uploader.upload(file.path, {
        folder: "products"
      });

      imageUrls.push(upload.secure_url);

      // delete temp file
      fs.unlinkSync(file.path);
    }

    /* ----------------------------
       CREATE PRODUCT
    ---------------------------- */
    const defaultVariant = getDefaultVariant(variants);
    const fallbackPrice = defaultVariant ? defaultVariant.price : price;
    const fallbackQuantity =
      defaultVariant && variants.some((v) => (Number(v.stock) || 0) > 0)
        ? "instock"
        : defaultVariant
          ? "outofstock"
          : quantity;

    const newProduct = await Product.create({
      name: name.trim(),
      desc,
      price: fallbackPrice,
      quantity: fallbackQuantity,
      variants,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : undefined,
      ...comboNormalized,
      netQuantity,
      shelfLife,
      ingredients,
      storage,
      country: country || "India",
      photos: imageUrls
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: newProduct
    });

  } catch (error) {
    console.error("Add product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: error.message
    });
  }
};

/* ======================================================
   GET ALL PRODUCTS
====================================================== */
exports.getProducts = async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || "").trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const sortRaw = String(req.query.sort || "newest");
    const inStockOnly = String(req.query.inStock || req.query.instock || "").toLowerCase() === "true";
    const productType = String(req.query.productType || "").trim();
    const showInCombosSection =
      String(req.query.showInCombosSection || "").toLowerCase() === "true";
    const onlyCombos = String(req.query.onlyCombos || "").toLowerCase() === "true";

    const filter = {};
    if (inStockOnly) filter.quantity = "instock";
    if (productType === "combo" || productType === "single") filter.productType = productType;
    if (showInCombosSection) filter.showInCombosSection = true;
    if (onlyCombos) filter.productType = "combo";
    if (q) {
      // For small catalogs this is fine; if you grow, add text indexes / Atlas Search later.
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { desc: rx }];
    }

    const sort = (() => {
      // Default: manual ordering
      if (!req.query.sort) return { displayOrder: 1, createdAt: -1 };
      if (sortRaw === "price_asc") return { price: 1 };
      if (sortRaw === "price_desc") return { price: -1 };
      if (sortRaw === "oldest") return { createdAt: 1 };
      if (sortRaw === "displayOrder_asc") return { displayOrder: 1, createdAt: -1 };
      return { createdAt: -1 }; // newest
    })();

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("comboItems.product")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      products: await Promise.all(products.map(computeComboMeta))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch products"
    });
  }
};

/* ======================================================
   GET SINGLE PRODUCT
====================================================== */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("comboItems.product");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      product: await computeComboMeta(product)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch product"
    });
  }
};

/* ======================================================
   UPDATE PRODUCT
====================================================== */
exports.updateProduct = async (req, res) => {
  try {
    const { name, desc, price, quantity, netQuantity, shelfLife, ingredients, storage, country } = req.body;
    const displayOrder = req.body?.displayOrder == null ? undefined : Number(req.body.displayOrder);

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    /* ----------------------------
       IF NEW IMAGES UPLOADED
    ---------------------------- */
    if (req.files && req.files.length > 0) {

      const newImages = [];

      for (const file of req.files) {
        const upload = await cloudinary.uploader.upload(file.path, {
          folder: "products"
        });

        newImages.push(upload.secure_url);
        fs.unlinkSync(file.path);
      }

      // Append new images (not replace)
      product.photos.push(...newImages);
    }

    // Variants (optional)
    if (req.body?.variants != null) {
      try {
        const parsed = parseVariants(req.body.variants);
        product.variants = normalizeVariants(parsed || []);

        // Backward-compatible fallback fields
        const def = getDefaultVariant(product.variants);
        if (def) {
          product.price = def.price;
          product.quantity = product.variants.some((v) => (Number(v.stock) || 0) > 0) ? "instock" : "outofstock";
        }
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message || "Invalid variants" });
      }
    } else {
      // Legacy fields
      product.price = price ?? product.price;
      product.quantity = quantity ?? product.quantity;
    }

    // Combo fields (optional)
    if (
      req.body?.productType != null ||
      req.body?.comboItems != null ||
      req.body?.comboPriceMode != null ||
      req.body?.comboDiscount != null ||
      req.body?.showInCombosSection != null
    ) {
      try {
        const comboItemsParsed = parseComboItems(req.body?.comboItems);
        const normalized = normalizeCombo({
          productId: product._id,
          productType: req.body?.productType ?? product.productType,
          comboItemsRaw: comboItemsParsed ?? product.comboItems,
          comboPriceMode: req.body?.comboPriceMode ?? product.comboPriceMode,
          comboDiscount: req.body?.comboDiscount ?? product.comboDiscount,
          showInCombosSection: req.body?.showInCombosSection ?? product.showInCombosSection,
        });

        product.productType = normalized.productType;
        product.comboItems = normalized.comboItems;
        product.comboPriceMode = normalized.comboPriceMode;
        product.comboDiscount = normalized.comboDiscount;
        product.showInCombosSection = normalized.showInCombosSection;
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message || "Invalid combo config" });
      }
    }

    if (Number.isFinite(displayOrder)) product.displayOrder = displayOrder;

    product.name = name ?? product.name;
    product.desc = desc ?? product.desc;
    product.netQuantity = netQuantity ?? product.netQuantity;
    product.shelfLife = shelfLife ?? product.shelfLife;
    product.ingredients = ingredients ?? product.ingredients;
    product.storage = storage ?? product.storage;
    product.country = country ?? product.country;


    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: await computeComboMeta(product)
    });

  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product"
    });
  }
};

/* ======================================================
   DELETE PRODUCT
====================================================== */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    /* ----------------------------
       DELETE CLOUDINARY IMAGES
    ---------------------------- */
    for (const imageUrl of product.photos) {
      const publicId = imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`products/${publicId}`);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product"
    });
  }
};
exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, reviews });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

exports.addProductReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { rating, comment } = req.body;
    const cityRaw = req.body?.city;
    const city = typeof cityRaw === "string" ? cityRaw.trim() : "";

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1 to 5" });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Review comment is required" });
    }
    if (city && city.length > 60) {
      return res.status(400).json({ success: false, message: "City must be 60 characters or less" });
    }

    const review = await Review.create({
      productId: req.params.id,
      userId,
      userName: req.user.name || "Customer",
      city,
      rating,
      comment: comment.trim(),
    });

    res.status(201).json({ success: true, review });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product. (One review per product)",
      });
    }
    res.status(500).json({ success: false, message: "Failed to submit review" });
  }
};

/* ======================================================
   BULK UPDATE DISPLAY ORDER (ADMIN)
   PUT /api/products/admin/display-order
   body: { orders: [{ productId, displayOrder }] }
====================================================== */
exports.bulkUpdateDisplayOrder = async (req, res) => {
  try {
    const orders = Array.isArray(req.body?.orders) ? req.body.orders : null;
    if (!orders || orders.length === 0) {
      return res.status(400).json({ success: false, message: "orders[] is required" });
    }

    const ops = [];
    for (const row of orders) {
      const productId = String(row?.productId || "").trim();
      const displayOrder = Number(row?.displayOrder);
      if (!productId) {
        return res.status(400).json({ success: false, message: "productId is required for each order row" });
      }
      if (!Number.isFinite(displayOrder)) {
        return res.status(400).json({ success: false, message: "displayOrder must be a number for each order row" });
      }
      ops.push({
        updateOne: {
          filter: { _id: productId },
          update: { $set: { displayOrder } },
        },
      });
    }

    const result = await Product.bulkWrite(ops, { ordered: false });

    return res.status(200).json({
      success: true,
      message: "Display order updated",
      result,
    });
  } catch (e) {
    console.error("bulkUpdateDisplayOrder error:", e);
    return res.status(500).json({ success: false, message: "Failed to update display order" });
  }
};




