const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer");
const { adminProtect } = require("../middleware/admin.middleware");

const {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

/* =====================
   PUBLIC ROUTES
===================== */
router.get("/", getProducts);
router.get("/:id", getProductById);

/* =====================
   ADMIN ROUTES
===================== */
router.post(
  "/",
  adminProtect,
  upload.array("photos", 6), // 🔁 CHANGED
  addProduct
);

router.put(
  "/:id",
  adminProtect,
  upload.array("photos", 6), // 🔁 CHANGED
  updateProduct
);

router.delete(
  "/:id",
  adminProtect,
  deleteProduct
);

module.exports = router;
