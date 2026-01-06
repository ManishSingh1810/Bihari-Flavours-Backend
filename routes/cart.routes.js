const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { addToCart, updateCart, deleteCart, getCart } = require("../controllers/cart.controller");

router.use(protect); // All routes need authentication

router.get("/", getCart);               // Get user's cart
router.post("/", addToCart);           // Add product to cart
router.put("/", updateCart);           // Update product quantity or remove product
router.delete("/", deleteCart);        // Delete entire cart

module.exports = router;
