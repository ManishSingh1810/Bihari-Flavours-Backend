const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer");
const { adminProtect } = require("../middleware/admin.middleware");
const { protect } = require("../middleware/auth.middleware");

const {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductReviews,
  addProductReview,
  bulkUpdateDisplayOrder

} = require("../controllers/product.controller");

/* =====================
   PUBLIC ROUTES
===================== */
router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/reviews", protect, addProductReview);

/* =====================
   ADMIN ROUTES
===================== */
// Bulk reorder (drag/drop save)
router.put("/admin/display-order", adminProtect, bulkUpdateDisplayOrder);

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



