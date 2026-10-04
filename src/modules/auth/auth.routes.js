const express = require("express");

const authController = require("./auth.controller");
const authenticate  = require("../../middleware/authentication");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

//protected route
router.get(
    "/profile",
    authenticate,
    authController.profile
);

module.exports = router;