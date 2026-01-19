const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer");
const { protect } = require("../middleware/auth.middleware");
const { adminProtect } = require("../middleware/admin.middleware");
const { getHomepage, updateHomepage } = require("../controllers/homepage.controller");

// Public
router.get("/homepage", getHomepage);

// Admin (multipart)
router.put(
  "/admin/homepage",
  protect,
  adminProtect,
  upload.fields([
    { name: "hero1", maxCount: 1 },
    { name: "hero2", maxCount: 1 },
    { name: "hero3", maxCount: 1 },
  ]),
  updateHomepage
);

module.exports = router;

