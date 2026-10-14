const applicationsService = require("./application.service");

const respondToError = (res, error, fallbackMessage) => {
  if (error.code === "INVALID_INPUT") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (
    error.code === "APPLICATION_NOT_FOUND" ||
    error.code === "JOB_NOT_FOUND" ||
    error.code === "USER_NOT_FOUND"
  ) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.code === "FORBIDDEN" || error.code === "NOT_ALLOWED") {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error.code === "ALREADY_APPLIED") {
    return res.status(409).json({ success: false, message: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const createApplication = async (req, res) => {
  try {
    const application = await applicationsService.createApplication(req.user, {
      ...(req.body || {}),
      resumeFile: req.file,
    });
    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to submit application");
  }
};

const getMyApplications = async (req, res) => {
  try {
    const result = await applicationsService.listMyApplications(req.user, req.query || {});
    return res.status(200).json({
      success: true,
      data: result.applications,
      pagination: result.pagination,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to fetch your applications");
  }
};

const getApplicationsByJob = async (req, res) => {
  try {
    const result = await applicationsService.listApplicationsByJob(
      req.user,
      req.params.jobId,
      req.query || {},
    );
    return res.status(200).json({
      success: true,
      data: result.applications,
      pagination: result.pagination,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to fetch job applications");
  }
};

const getApplicationById = async (req, res) => {
  try {
    const application = await applicationsService.getApplicationById(req.user, req.params.id);
    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to fetch application");
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    const application = await applicationsService.updateApplicationStatus(
      req.user,
      req.params.id,
      status,
    );
    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      data: application,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to update application status");
  }
};

const deleteApplication = async (req, res) => {
  try {
    const result = await applicationsService.deleteApplication(req.user, req.params.id);
    return res.status(200).json({
      success: true,
      message: "Application withdrawn successfully",
      data: result,
    });
  } catch (error) {
    return respondToError(res, error, "Failed to withdraw application");
  }
};

module.exports = {
  createApplication,
  deleteApplication,
  getApplicationById,
  getApplicationsByJob,
  getMyApplications,
  updateApplicationStatus,
};
