const express = require("express");

const companyController = require("./company.controller");

const authenticate = require("../../middleware/authentication");
const authorizeRoles = require("../../middleware/authorizeRoles");

const router = express.Router();

router.post(
    "/invitations/accept",
    companyController.acceptCompanyInvitation
);

router.post(
    "/",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.createCompany
);

router.post(
    "/invite_admin",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.inviteAdminToCompany
);
module.exports = router;