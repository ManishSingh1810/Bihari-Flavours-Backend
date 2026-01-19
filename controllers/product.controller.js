const Review = require("../models/review.model");
const Product = require("../models/product.model");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/* ======================================================
   ADD PRODUCT (MULTIPLE IMAGES)
====================================================== */
exports.addProduct = async (req, res) => {
  try {
    const { name, desc, price, quantity, netQuantity, shelfLife, ingredients, storage, country } = req.body;

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
    const newProduct = await Product.create({
      name: name.trim(),
      desc,
      price,
      quantity,
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

    const filter = {};
    if (inStockOnly) filter.quantity = "instock";
    if (q) {
      // For small catalogs this is fine; if you grow, add text indexes / Atlas Search later.
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { desc: rx }];
    }

    const sort = (() => {
      if (sortRaw === "price_asc") return { price: 1 };
      if (sortRaw === "price_desc") return { price: -1 };
      if (sortRaw === "oldest") return { createdAt: 1 };
      return { createdAt: -1 }; // newest
    })();

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
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
      products
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
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      product
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

    product.name = name ?? product.name;
    product.desc = desc ?? product.desc;
    product.price = price ?? product.price;
    product.quantity = quantity ?? product.quantity;
    product.netQuantity = netQuantity ?? product.netQuantity;
    product.shelfLife = shelfLife ?? product.shelfLife;
    product.ingredients = ingredients ?? product.ingredients;
    product.storage = storage ?? product.storage;
    product.country = country ?? product.country;


    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
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

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1 to 5" });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Review comment is required" });
    }

    const review = await Review.create({
      productId: req.params.id,
      userId,
      userName: req.user.name || "Customer",
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




