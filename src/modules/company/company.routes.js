const express = require("express");

const companyController = require("./company.controller");

const authenticate = require("../../middleware/authentication");
const authorizeRoles = require("../../middleware/authorizeRoles");

const router = express.Router();

router.get(
    "/invitations",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.getCompanyInvitations
);

router.post(
    "/invitations/accept",
    companyController.acceptCompanyInvitation
);

router.get(
    "/",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.getCompanies
);

router.post(
    "/",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.createCompany
);

router.get(
    "/:id",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.getCompanyById
);

router.post(
    "/invite_admin",
    authenticate,
    authorizeRoles("SUPER_ADMIN"),
    companyController.inviteAdminToCompany
);
module.exports = router;