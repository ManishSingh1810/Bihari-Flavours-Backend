// routes/user.routes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

router.post("/signup", userController.signup);
router.post("/signin", userController.signin);

// Logout can be called in many ways from different clients (GET/POST/DELETE etc).
// Make it robust: accept any method and both user/admin paths.
router.all("/logout", userController.logout);
router.all("/admin/logout", userController.logout);

module.exports = router;
