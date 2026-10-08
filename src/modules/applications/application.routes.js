const express = require("express");

const authenticate = require("../../middleware/authentication");
const authorizeRoles = require("../../middleware/authorizeRoles");
const applicationController = require("./application.controller");

const router = express.Router();

router.use(authenticate);

router.post(
  "/applications",
  authorizeRoles("CANDIDATE"),
  applicationController.createApplication,
);

router.get(
  "/applications/me",
  authorizeRoles("CANDIDATE"),
  applicationController.getMyApplications,
);

router.get(
  "/jobs/:jobId/applications",
  authorizeRoles("RECRUITER", "ADMIN", "SUPER_ADMIN"),
  applicationController.getApplicationsByJob,
);

router.get(
  "/applications/:id",
  authorizeRoles("CANDIDATE", "RECRUITER", "ADMIN", "SUPER_ADMIN"),
  applicationController.getApplicationById,
);

router.patch(
  "/applications/:id/status",
  authorizeRoles("RECRUITER", "ADMIN", "SUPER_ADMIN"),
  applicationController.updateApplicationStatus,
);

router.delete(
  "/applications/:id",
  authorizeRoles("CANDIDATE", "RECRUITER", "ADMIN", "SUPER_ADMIN"),
  applicationController.deleteApplication,
);

module.exports = router;