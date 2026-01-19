// routes/user.routes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

router.post("/signup", userController.signup);
router.post("/signin", userController.signin);
router.post("/logout", userController.logout);
// Some clients (admin panels) call logout with GET or under an /admin prefix.
// Support both without breaking existing integrations.
router.get("/logout", userController.logout);
router.post("/admin/logout", userController.logout);
router.get("/admin/logout", userController.logout);

module.exports = router;
