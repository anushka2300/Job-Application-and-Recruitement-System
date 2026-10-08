const jobsService = require("./jobs.service");

const respondToError = (res, error, fallbackMessage) => {
  if (error.code === "INVALID_INPUT") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === "JOB_NOT_FOUND" || error.code === "COMPANY_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.code === "COMPANY_REQUIRED") {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error.code === "USER_NOT_FOUND") {
    return res.status(404).json({ success: false, message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const createJob = async (req, res) => {
  try {
    const job = await jobsService.createJob(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: job,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to create job");
  }
};

const listJobs = async (req, res) => {
  try {
    const result = await jobsService.listJobs(req.user, req.query);
    return res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to fetch jobs");
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await jobsService.getJobById(req.params.id, req.user);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    return respondToError(res, error, "Failed to fetch job");
  }
};

const updateJob = async (req, res) => {
  try {
    const job = await jobsService.updateJob(
      req.params.id,
      req.user,
      req.body,
    );
    return res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: job,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to update job");
  }
};

const deleteJob = async (req, res) => {
  try {
    await jobsService.deleteJob(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    return respondToError(res, error, "Failed to delete job");
  }
};

const setJobPublished = async (req, res) => {
  try {
    const job = await jobsService.setJobPublished(
      req.params.id,
      req.user,
      req.body?.published,
    );
    return res.status(200).json({
      success: true,
      message: job.status === "PUBLISHED" ? "Job published" : "Job unpublished",
      data: job,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to update job publication");
  }
};

module.exports = {
  createJob,
  deleteJob,
  getJobById,
  listJobs,
  setJobPublished,
  updateJob,
};