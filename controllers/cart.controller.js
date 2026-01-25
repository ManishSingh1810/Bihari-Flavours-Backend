const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

const summarizeCart = (cart, userId) => {
  const safe = cart || { userId, cartItems: [], totalAmount: 0 };
  const cartItems = safe.cartItems || [];
  const cartItemCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const distinctItemCount = cartItems.length;

  return {
    cart: safe,
    cartItemCount,
    distinctItemCount,
  };
};

// Add to Cart
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;
    const variantLabelRaw = req.body?.variantLabel;
    const variantLabel = typeof variantLabelRaw === "string" ? variantLabelRaw.trim() : "";

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (!product.photos || product.photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product has no images"
      });
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const defaultVariant = hasVariants
      ? (product.variants.find((v) => v.isDefault) || product.variants[0])
      : null;

    const selectedVariant = hasVariants
      ? (product.variants.find((v) => v.label === variantLabel) || (variantLabel ? null : defaultVariant))
      : null;

    if (hasVariants && !selectedVariant) {
      return res.status(400).json({
        success: false,
        message: "Invalid variantLabel",
      });
    }

    const effectiveVariantLabel = hasVariants ? String(selectedVariant.label) : "";
    const unitPrice = hasVariants ? Number(selectedVariant.price) : Number(product.price);
    const variantStock = hasVariants ? Number(selectedVariant.stock) : null;

    if (!hasVariants && product.quantity !== "instock") {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock"
      });
    }

    if (hasVariants && (!Number.isFinite(variantStock) || variantStock <= 0)) {
      return res.status(400).json({
        success: false,
        message: `Selected variant is out of stock`,
      });
    }

    const mainImage = product.photos[0]; // ✅ MAIN IMAGE

    let cart = await Cart.findOne({ userId });

    if (cart) {
      const index = cart.cartItems.findIndex(
        item => item.productId.toString() === productId && String(item.variantLabel || "") === effectiveVariantLabel
      );

      if (index >= 0) {
        // Stock check for variants
        if (hasVariants) {
          const nextQty = Number(cart.cartItems[index].quantity || 0) + 1;
          if (nextQty > variantStock) {
            return res.status(400).json({
              success: false,
              message: "Not enough stock for selected variant",
            });
          }
        }
        cart.cartItems[index].quantity += 1;
      } else {
        cart.cartItems.push({
          productId,
          variantLabel: effectiveVariantLabel,
          photo: mainImage,
          name: product.name,
          quantity: 1,
          priceAtAdd: unitPrice,
          price: unitPrice
        });
      }
    } else {
      cart = new Cart({
        userId,
        cartItems: [{
          productId,
          variantLabel: effectiveVariantLabel,
          photo: mainImage,
          name: product.name,
          quantity: 1,
          priceAtAdd: unitPrice,
          price: unitPrice
        }]
      });
    }

    cart.totalAmount = cart.cartItems.reduce(
      (sum, item) => sum + (Number(item.priceAtAdd ?? item.price) || 0) * (Number(item.quantity) || 0),
      0
    );

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      ...summarizeCart(cart, userId)
    });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add to cart"
    });
  }
};


// Update Cart (update quantity or remove product)
exports.updateCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body; // Single product update
    const variantLabelRaw = req.body?.variantLabel;
    const variantLabel = typeof variantLabelRaw === "string" ? variantLabelRaw.trim() : "";

    if (!productId || quantity == null || quantity < 0) {
      return res.status(400).json({ success: false, message: "Invalid product or quantity" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const productIndex = cart.cartItems.findIndex(
      (item) => item.productId.toString() === productId && String(item.variantLabel || "") === variantLabel
    );

    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not in cart" });
    }

    if (quantity === 0) {
      // Remove product from cart
      cart.cartItems.splice(productIndex, 1);
    } else {
      // Update quantity
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      if (hasVariants) {
        if (!variantLabel) {
          return res.status(400).json({ success: false, message: "variantLabel is required for variant products" });
        }
        const v = product.variants.find((x) => x.label === variantLabel);
        if (!v) return res.status(400).json({ success: false, message: "Invalid variantLabel" });
        if (Number(quantity) > Number(v.stock)) {
          return res.status(400).json({ success: false, message: "Not enough stock for selected variant" });
        }
      } else if (product.quantity !== "instock") {
        return res.status(400).json({ success: false, message: `Product ${product.name} is out of stock` });
      }

      cart.cartItems[productIndex].quantity = quantity;
      // Keep priceAtAdd stable (do not overwrite with current product price)
    }

    if (cart.cartItems.length === 0) {
      await Cart.findOneAndDelete({ userId });
      return res.status(200).json({
        success: true,
        message: "Cart is now empty",
        ...summarizeCart(null, userId)
      });
    }

    cart.totalAmount = cart.cartItems.reduce(
      (acc, item) => acc + (Number(item.priceAtAdd ?? item.price) || 0) * (Number(item.quantity) || 0),
      0
    );
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      ...summarizeCart(cart, userId)
    });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ success: false, message: "Failed to update cart", error: error.message });
  }
};

// Delete Cart completely
exports.deleteCart = async (req, res) => {
  try {
    const userId = req.user._id;
    await Cart.findOneAndDelete({ userId });

    res.status(200).json({
      success: true,
      message: "Cart deleted successfully",
      ...summarizeCart(null, userId)
    });
  } catch (error) {
    console.error("Delete cart error:", error);
    res.status(500).json({ success: false, message: "Failed to delete cart", error: error.message });
  }
};

// Get Cart
exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId });

    res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      ...summarizeCart(cart, userId)
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cart",
      error: error.message
    });
  }
};
