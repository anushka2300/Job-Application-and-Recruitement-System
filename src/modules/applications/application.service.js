const pool = require("../../config/db");
const { deleteResume, uploadResume } = require("../../services/resumeService");

const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const parseApplicationId = (id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError("INVALID_INPUT", "A valid application ID is required");
  }
  return parsed;
};

const parseJobId = (id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError("INVALID_INPUT", "A valid job ID is required");
  }
  return parsed;
};

const getUserCompanyId = async (userId) => {
  const [rows] = await pool.execute(
    "SELECT company_id FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  if (!rows[0]) {
    throw createError("USER_NOT_FOUND", "User not found");
  }
  return rows[0].company_id;
};

const validateApplicationStatus = (status) => {
  if (typeof status !== "string" || !APPLICATION_STATUSES.includes(status)) {
    throw createError("INVALID_INPUT", "Invalid application status");
  }
  return status;
};

const mapApplication = (row) => ({
  id: row.id,
  jobId: row.job_id,
  candidateId: row.candidate_id,
  resumeUrl: row.resume_url,
  coverLetter: row.cover_letter,
  status: row.status,
  appliedAt: row.applied_at,
  updatedAt: row.updated_at,
  jobTitle: row.job_title || null,
  candidateName: row.candidate_name || null,
  candidateEmail: row.candidate_email || null,
});

const canAccessJobApplications = async (user, jobId) => {
  const [jobs] = await pool.execute(
    `SELECT j.id, j.company_id, j.created_by
     FROM jobs j
     WHERE j.id = ?
     LIMIT 1`,
    [jobId],
  );

  if (!jobs[0]) {
    throw createError("JOB_NOT_FOUND", "Job not found");
  }

  const job = jobs[0];
  const userCompanyId = user.role !== "SUPER_ADMIN" ? await getUserCompanyId(user.userId) : null;

  if (user.role === "SUPER_ADMIN") {
    return job;
  }

  if (user.role === "ADMIN") {
    if (job.company_id !== userCompanyId) {
      throw createError("FORBIDDEN", "You can only view applications for your company");
    }
    return job;
  }

  if (user.role === "RECRUITER") {
    if (job.created_by !== user.userId) {
      throw createError("FORBIDDEN", "You can only view applications for jobs you created");
    }
    return job;
  }

  throw createError("FORBIDDEN", "You are not allowed to view job applications");
};

const canAccessApplication = async (user, applicationId) => {
  const [rows] = await pool.execute(
    `SELECT a.id, a.job_id, a.candidate_id, a.status,
            j.company_id, j.created_by,
            u.company_id AS user_company_id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = ?
     WHERE a.id = ?
     LIMIT 1`,
    [user.userId, applicationId],
  );

  if (!rows[0]) {
    throw createError("APPLICATION_NOT_FOUND", "Application not found");
  }

  const application = rows[0];

  if (user.role === "CANDIDATE") {
    if (application.candidate_id !== user.userId) {
      throw createError("FORBIDDEN", "You can only access your own applications");
    }
    return application;
  }

  if (user.role === "SUPER_ADMIN") {
    return application;
  }

  if (user.role === "ADMIN") {
    if (application.company_id !== application.user_company_id) {
      throw createError("FORBIDDEN", "You can only access applications from your company");
    }
    return application;
  }

  if (user.role === "RECRUITER") {
    if (application.created_by !== user.userId) {
      throw createError("FORBIDDEN", "You can only access applications for jobs you created");
    }
    return application;
  }

  throw createError("FORBIDDEN", "You are not allowed to access this application");
};

const createApplication = async (user, input = {}) => {
  if (!user || user.role !== "CANDIDATE") {
    throw createError("FORBIDDEN", "Only candidates can apply for jobs");
  }

  const resumeFile = input.resumeFile;
  if (!resumeFile || !Buffer.isBuffer(resumeFile.buffer)) {
    throw createError("INVALID_INPUT", "A PDF resume is required");
  }
  if (!resumeFile.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw createError("INVALID_INPUT", "Uploaded resume is not a valid PDF");
  }

  const jobId = parseJobId(input.jobId ?? input.job_id);

  const [jobs] = await pool.execute(
    "SELECT id, status FROM jobs WHERE id = ? LIMIT 1",
    [jobId],
  );

  if (!jobs[0]) {
    throw createError("JOB_NOT_FOUND", "Job not found");
  }

  if (jobs[0].status !== "PUBLISHED") {
    throw createError("INVALID_INPUT", "Applications are only allowed for published jobs");
  }

  const [existing] = await pool.execute(
    "SELECT id FROM applications WHERE candidate_id = ? AND job_id = ? LIMIT 1",
    [user.userId, jobId],
  );

  if (existing[0]) {
    throw createError("ALREADY_APPLIED", "You have already applied for this job");
  }

  const coverLetter = typeof (input.coverLetter ?? input.cover_letter) === "string"
    ? (input.coverLetter ?? input.cover_letter).trim() || null
    : null;

  const uploadedResume = await uploadResume(resumeFile.buffer);

  let result;
  try {
    [result] = await pool.execute(
      `INSERT INTO applications (job_id, candidate_id, resume_url, cover_letter, status)
       VALUES (?, ?, ?, ?, 'APPLIED')`,
      [jobId, user.userId, uploadedResume.publicId, coverLetter],
    );
  } catch (error) {
    try {
      await deleteResume(uploadedResume.publicId);
    } catch (cleanupError) {
      console.error("Failed to remove resume from Cloudinary after application insert failed", cleanupError);
    }
    throw error;
  }

  const [rows] = await pool.execute(
    `SELECT a.*, j.title AS job_title
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?
     LIMIT 1`,
    [result.insertId],
  );

  return mapApplication(rows[0]);
};

const listMyApplications = async (user, filters = {}) => {
  if (!user || user.role !== "CANDIDATE") {
    throw createError("FORBIDDEN", "Only candidates can view their own applications");
  }

  const page = Number(filters.page ?? 1);
  const limit = Math.min(Number(filters.limit ?? 10), 100);
  if (!Number.isInteger(page) || page <= 0) {
    throw createError("INVALID_INPUT", "Page must be a positive integer");
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw createError("INVALID_INPUT", "Limit must be a positive integer");
  }

  const offset = (page - 1) * limit;

  const [applications] = await pool.execute(
    `SELECT a.*, j.title AS job_title
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.candidate_id = ?
     ORDER BY a.applied_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [user.userId, limit, offset],
  );

  const [[countRow]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM applications WHERE candidate_id = ?",
    [user.userId],
  );

  return {
    applications: applications.map(mapApplication),
    pagination: {
      page,
      limit,
      total: Number(countRow.total),
    },
  };
};

const listApplicationsByJob = async (user, jobId, filters = {}) => {
  const parsedJobId = parseJobId(jobId);
  await canAccessJobApplications(user, parsedJobId);

  const page = Number(filters.page ?? 1);
  const limit = Math.min(Number(filters.limit ?? 10), 100);
  if (!Number.isInteger(page) || page <= 0) {
    throw createError("INVALID_INPUT", "Page must be a positive integer");
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw createError("INVALID_INPUT", "Limit must be a positive integer");
  }

  const offset = (page - 1) * limit;

  const [applications] = await pool.execute(
    `SELECT a.*, u.name AS candidate_name, u.email AS candidate_email, j.title AS job_title
     FROM applications a
     JOIN users u ON u.id = a.candidate_id
     JOIN jobs j ON j.id = a.job_id
     WHERE a.job_id = ?
     ORDER BY a.applied_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [parsedJobId, limit, offset],
  );

  const [[countRow]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM applications WHERE job_id = ?",
    [parsedJobId],
  );

  return {
    applications: applications.map(mapApplication),
    pagination: {
      page,
      limit,
      total: Number(countRow.total),
    },
  };
};

const getApplicationById = async (user, applicationId) => {
  const parsedId = parseApplicationId(applicationId);
  const [rows] = await pool.execute(
    `SELECT a.*, j.title AS job_title, u.name AS candidate_name, u.email AS candidate_email
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.candidate_id
     WHERE a.id = ?
     LIMIT 1`,
    [parsedId],
  );

  if (!rows[0]) {
    throw createError("APPLICATION_NOT_FOUND", "Application not found");
  }

  await canAccessApplication(user, parsedId);
  return mapApplication(rows[0]);
};

const updateApplicationStatus = async (user, applicationId, statusInput) => {
  const parsedId = parseApplicationId(applicationId);
  const status = validateApplicationStatus(statusInput);

  if (status === "WITHDRAWN") {
    throw createError("INVALID_INPUT", "Use DELETE to withdraw an application");
  }

  const [rows] = await pool.execute(
    `SELECT a.id, a.status, a.candidate_id, a.job_id, j.company_id, j.created_by
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?
     LIMIT 1`,
    [parsedId],
  );

  if (!rows[0]) {
    throw createError("APPLICATION_NOT_FOUND", "Application not found");
  }

  const application = rows[0];
  const userCompanyId = await getUserCompanyId(user.userId);

  if (user.role === "SUPER_ADMIN") {
    // allowed
  } else if (user.role === "ADMIN") {
    if (application.company_id !== userCompanyId) {
      throw createError("FORBIDDEN", "You can only update applications from your company");
    }
  } else if (user.role === "RECRUITER") {
    if (application.created_by !== user.userId) {
      throw createError("FORBIDDEN", "You can only update applications for jobs you created");
    }
  } else {
    throw createError("FORBIDDEN", "Only recruiters, admins, and super admins can update application status");
  }

  await pool.execute(
    "UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, parsedId],
  );

  const [updatedRows] = await pool.execute(
    `SELECT a.*, j.title AS job_title
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?
     LIMIT 1`,
    [parsedId],
  );

  return mapApplication(updatedRows[0]);
};

const deleteApplication = async (user, applicationId) => {
  if (!user || user.role !== "CANDIDATE") {
    throw createError("FORBIDDEN", "Only candidates can withdraw their applications");
  }

  const parsedId = parseApplicationId(applicationId);
  const [rows] = await pool.execute(
    `SELECT id, candidate_id, status
     FROM applications
     WHERE id = ?
     LIMIT 1`,
    [parsedId],
  );

  if (!rows[0]) {
    throw createError("APPLICATION_NOT_FOUND", "Application not found");
  }

  if (rows[0].candidate_id !== user.userId) {
    throw createError("FORBIDDEN", "You can only withdraw your own applications");
  }

  if (rows[0].status === "WITHDRAWN") {
    throw createError("INVALID_INPUT", "Application is already withdrawn");
  }

  if (["SELECTED", "REJECTED"].includes(rows[0].status)) {
    throw createError("INVALID_INPUT", "You cannot withdraw an application after a final decision has been made");
  }

  await pool.execute(
    "UPDATE applications SET status = 'WITHDRAWN', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [parsedId],
  );

  return {
    id: parsedId,
    status: "WITHDRAWN",
  };
};

module.exports = {
  createApplication,
  deleteApplication,
  getApplicationById,
  listApplicationsByJob,
  listMyApplications,
  updateApplicationStatus,
};
