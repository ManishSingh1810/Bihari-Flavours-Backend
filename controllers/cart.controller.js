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

    if (product.quantity !== "instock") {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock"
      });
    }

    const mainImage = product.photos[0]; // ✅ MAIN IMAGE

    let cart = await Cart.findOne({ userId });

    if (cart) {
      const index = cart.cartItems.findIndex(
        item => item.productId.toString() === productId
      );

      if (index >= 0) {
        cart.cartItems[index].quantity += 1;
      } else {
        cart.cartItems.push({
          productId,
          photo: mainImage,
          name: product.name,
          quantity: 1,
          price: product.price
        });
      }
    } else {
      cart = new Cart({
        userId,
        cartItems: [{
          productId,
          photo: mainImage,
          name: product.name,
          quantity: 1,
          price: product.price
        }]
      });
    }

    cart.totalAmount = cart.cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
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

    if (!productId || quantity == null || quantity < 0) {
      return res.status(400).json({ success: false, message: "Invalid product or quantity" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const productIndex = cart.cartItems.findIndex(item => item.productId.toString() === productId);

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

      if (product.quantity !== "instock") {
        return res.status(400).json({ success: false, message: `Product ${product.name} is out of stock` });
      }

      cart.cartItems[productIndex].quantity = quantity;
      cart.cartItems[productIndex].price = product.price;
    }

    if (cart.cartItems.length === 0) {
      await Cart.findOneAndDelete({ userId });
      return res.status(200).json({
        success: true,
        message: "Cart is now empty",
        ...summarizeCart(null, userId)
      });
    }

    cart.totalAmount = cart.cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
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
