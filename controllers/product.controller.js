const Product = require("../models/product.model");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/* ======================================================
   ADD PRODUCT (MULTIPLE IMAGES)
====================================================== */
exports.addProduct = async (req, res) => {
  try {
    const { name, desc, price, quantity } = req.body;

    /* ----------------------------
       VALIDATION
    ---------------------------- */
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });
    }

    const existingProduct = await Product.findOne({ name: name.trim() });
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
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: products.length,
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
    const { name, desc, price, quantity } = req.body;

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
