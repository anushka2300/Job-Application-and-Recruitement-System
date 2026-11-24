const express = require("express");

const adminController = require("./admin.controller");
const authenticate = require("../../middleware/authentication");
const authorizeRoles = require("../../middleware/authorizeRoles");

const router = express.Router();

router.get(
  "/stats",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  adminController.getAdminStats,
);

module.exports = router;
