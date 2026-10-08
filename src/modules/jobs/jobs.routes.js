const express = require("express");

const authenticate = require("../../middleware/authentication");
const authorizeRoles = require("../../middleware/authorizeRoles");
const jobsController = require("./jobs.controller");

const router = express.Router();
const jobReaders = ["CANDIDATE", "RECRUITER", "ADMIN", "SUPER_ADMIN"];
const jobWriters = ["RECRUITER", "ADMIN", "SUPER_ADMIN"];

router.use(authenticate);

router.post("/", authorizeRoles(...jobWriters), jobsController.createJob);
router.get("/", authorizeRoles(...jobReaders), jobsController.listJobs);
router.get("/:id", authorizeRoles(...jobReaders), jobsController.getJobById);
router.put("/:id", authorizeRoles(...jobWriters), jobsController.updateJob);
router.delete("/:id", authorizeRoles(...jobWriters), jobsController.deleteJob);
router.patch(
  "/:id/publish",
  authorizeRoles(...jobWriters),
  jobsController.setJobPublished,
);

module.exports = router;