const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer");
const { adminProtect } = require("../middleware/admin.middleware");
const { getHomepage, updateHomepage } = require("../controllers/homepage.controller");

// Public
router.get("/homepage", getHomepage);

// Admin (multipart)
// Accept both PUT and POST because some clients struggle with multipart PUT.
router.put(
  "/admin/homepage",
  adminProtect,
  upload.any(),
  updateHomepage
);

router.post(
  "/admin/homepage",
  adminProtect,
  upload.any(),
  updateHomepage
);

module.exports = router;

