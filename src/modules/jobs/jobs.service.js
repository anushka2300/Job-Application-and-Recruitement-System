const pool = require("../../config/db");

const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
];
const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"];
const JOB_FIELDS = [
  "title",
  "description",
  "location",
  "employment_type",
  "experience_min",
  "experience_max",
  "salary_min",
  "salary_max",
  "skills",
];

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const parseJobId = (id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError("INVALID_INPUT", "A valid job ID is required");
  }
  return parsed;
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const validateJobFields = (input, { partial = false } = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("INVALID_INPUT", "A job object is required");
  }

  const allowedFields = [...JOB_FIELDS];
  if (!partial) {
    allowedFields.push("company_id");
  }
  const unknownFields = Object.keys(input).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unknownFields.length > 0) {
    throw createError(
      "INVALID_INPUT",
      `Unsupported job field: ${unknownFields[0]}`,
    );
  }

  if (
    !partial &&
    (typeof input.title !== "string" ||
      !input.title.trim() ||
      typeof input.description !== "string" ||
      !input.description.trim())
  ) {
    throw createError(
      "INVALID_INPUT",
      "Title and description are required",
    );
  }
  if (partial && Object.keys(input).length === 0) {
    throw createError("INVALID_INPUT", "At least one job field is required");
  }

  const fields = {};
  for (const field of JOB_FIELDS) {
    if (!hasOwn(input, field)) {
      continue;
    }
    const value = input[field];

    if (field === "title" || field === "description") {
      if (typeof value !== "string" || !value.trim()) {
        throw createError("INVALID_INPUT", `${field} cannot be empty`);
      }
      fields[field] = value.trim();
    } else if (field === "location") {
      if (value !== null && typeof value !== "string") {
        throw createError("INVALID_INPUT", "Location must be a string or null");
      }
      fields[field] = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "employment_type") {
      if (!EMPLOYMENT_TYPES.includes(value)) {
        throw createError("INVALID_INPUT", "Invalid employment type");
      }
      fields[field] = value;
    } else if (field.startsWith("experience_")) {
      if (
        value !== null &&
        (!Number.isInteger(value) || value < 0)
      ) {
        throw createError(
          "INVALID_INPUT",
          `${field} must be a non-negative integer or null`,
        );
      }
      fields[field] = value;
    } else if (field.startsWith("salary_")) {
      if (
        value !== null &&
        (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      ) {
        throw createError(
          "INVALID_INPUT",
          `${field} must be a non-negative number or null`,
        );
      }
      fields[field] = value;
    } else if (field === "skills") {
      if (
        value !== null &&
        (!Array.isArray(value) ||
          !value.every((skill) => typeof skill === "string"))
      ) {
        throw createError(
          "INVALID_INPUT",
          "Skills must be an array of strings or null",
        );
      }
      fields[field] = value === null ? null : JSON.stringify(value);
    }
  }

  if (!partial && !hasOwn(fields, "employment_type")) {
    fields.employment_type = "FULL_TIME";
  }
  return fields;
};

const validateRanges = (job) => {
  if (
    job.experience_min != null &&
    job.experience_max != null &&
    job.experience_min > job.experience_max
  ) {
    throw createError(
      "INVALID_INPUT",
      "Minimum experience cannot exceed maximum experience",
    );
  }
  if (
    job.salary_min != null &&
    job.salary_max != null &&
    Number(job.salary_min) > Number(job.salary_max)
  ) {
    throw createError(
      "INVALID_INPUT",
      "Minimum salary cannot exceed maximum salary",
    );
  }
};

const getCompanyId = async (userId) => {
  const [users] = await pool.execute(
    "SELECT company_id FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  if (!users[0]) {
    throw createError("USER_NOT_FOUND", "User not found");
  }
  if (users[0].company_id == null) {
    throw createError(
      "COMPANY_REQUIRED",
      "Your account must belong to a company to manage jobs",
    );
  }
  return users[0].company_id;
};

const addListFilters = (filters, user) => {
  const conditions = [];
  const values = [];

  if (user.role === "CANDIDATE") {
    conditions.push("status = 'PUBLISHED'");
  } else if (user.role !== "SUPER_ADMIN") {
    conditions.push(
      "(status = 'PUBLISHED' OR company_id = (SELECT company_id FROM users WHERE id = ?))",
    );
    values.push(user.userId);
  }

  for (const filterName of ["q", "location"]) {
    if (
      filters[filterName] !== undefined &&
      typeof filters[filterName] !== "string"
    ) {
      throw createError("INVALID_INPUT", `${filterName} must be a string`);
    }
  }
  if (filters.q?.trim()) {
    conditions.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
    const search = `%${filters.q.trim()}%`;
    values.push(search, search, search);
  }
  if (filters.location?.trim()) {
    conditions.push("location LIKE ?");
    values.push(`%${filters.location.trim()}%`);
  }
  if (
    filters.employment_type !== undefined &&
    typeof filters.employment_type !== "string"
  ) {
    throw createError("INVALID_INPUT", "employment_type must be a string");
  }
  if (filters.employment_type) {
    if (!EMPLOYMENT_TYPES.includes(filters.employment_type)) {
      throw createError("INVALID_INPUT", "Invalid employment type");
    }
    conditions.push("employment_type = ?");
    values.push(filters.employment_type);
  }
  if (
    filters.status !== undefined &&
    typeof filters.status !== "string"
  ) {
    throw createError("INVALID_INPUT", "status must be a string");
  }
  if (filters.status && user.role !== "CANDIDATE") {
    if (!JOB_STATUSES.includes(filters.status)) {
      throw createError("INVALID_INPUT", "Invalid job status");
    }
    conditions.push("status = ?");
    values.push(filters.status);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const parsePositiveInteger = (value, fallback, name) => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError("INVALID_INPUT", `${name} must be a positive integer`);
  }
  return parsed;
};

const listJobs = async (user, filters) => {
  const { where, values } = addListFilters(filters, user);
  const page = parsePositiveInteger(filters.page, 1, "Page");
  const requestedLimit = parsePositiveInteger(filters.limit, 20, "Limit");
  const limit = Math.min(requestedLimit, 100);
  const offset = (page - 1) * limit;

  const [[jobs], [countRows]] = await Promise.all([
    pool.execute(
      `SELECT id, company_id, created_by, title, description, location,
              employment_type, experience_min, experience_max, salary_min,
              salary_max, skills, status, created_at, updated_at
       FROM jobs ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    ),
    pool.execute(`SELECT COUNT(*) AS total FROM jobs ${where}`, values),
  ]);
  return {
    jobs,
    pagination: {
      page,
      limit,
      total: countRows[0].total,
    },
  };
};

const getJobById = async (id, user) => {
  id = parseJobId(id);
  const conditions = ["id = ?"];
  const values = [id];

  if (user.role === "CANDIDATE") {
    conditions.push("status = 'PUBLISHED'");
  } else if (user.role !== "SUPER_ADMIN") {
    conditions.push(
      "(status = 'PUBLISHED' OR company_id = (SELECT company_id FROM users WHERE id = ?))",
    );
    values.push(user.userId);
  }

  const [jobs] = await pool.execute(
    `SELECT id, company_id, created_by, title, description, location,
            employment_type, experience_min, experience_max, salary_min,
            salary_max, skills, status, created_at, updated_at
     FROM jobs WHERE ${conditions.join(" AND ")} LIMIT 1`,
    values,
  );
  return jobs[0] || null;
};

const getManageableJob = async (id, user) => {
  id = parseJobId(id);
  let scope = "";
  const values = [id];
  if (user.role === "RECRUITER") {
    scope = "AND created_by = ?";
    values.push(user.userId);
  } else if (user.role === "ADMIN") {
    scope = "AND company_id = (SELECT company_id FROM users WHERE id = ?)";
    values.push(user.userId);
  }

  const [jobs] = await pool.execute(
    `SELECT * FROM jobs WHERE id = ? ${scope} LIMIT 1`,
    values,
  );
  return jobs[0] || null;
};

const createJob = async (user, input) => {
  const fields = validateJobFields(input);
  validateRanges(fields);

  let companyId;
  if (user.role === "SUPER_ADMIN") {
    companyId = input.company_id;
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw createError(
        "INVALID_INPUT",
        "A valid company_id is required for super admins",
      );
    }
  } else {
    if (hasOwn(input, "company_id")) {
      throw createError(
        "INVALID_INPUT",
        "Only super admins can choose a company",
      );
    }
    companyId = await getCompanyId(user.userId);
  }

  const [companies] = await pool.execute(
    "SELECT id FROM companies WHERE id = ? LIMIT 1",
    [companyId],
  );
  if (!companies[0]) {
    throw createError("COMPANY_NOT_FOUND", "Company not found");
  }

  const columns = Object.keys(fields);
  const values = Object.values(fields);
  const [result] = await pool.execute(
    `INSERT INTO jobs (company_id, created_by, ${columns.join(", ")})
     VALUES (?, ?, ${columns.map(() => "?").join(", ")})`,
    [companyId, user.userId, ...values],
  );
  return getJobById(result.insertId, { ...user, role: "SUPER_ADMIN" });
};

const updateJob = async (id, user, input) => {
  id = parseJobId(id);
  const job = await getManageableJob(id, user);
  if (!job) {
    throw createError("JOB_NOT_FOUND", "Job not found");
  }

  const fields = validateJobFields(input, { partial: true });
  validateRanges({ ...job, ...fields });

  const columns = Object.keys(fields);
  await pool.execute(
    `UPDATE jobs SET ${columns.map((column) => `${column} = ?`).join(", ")}
     WHERE id = ?`,
    [...Object.values(fields), id],
  );
  return getJobById(id, { ...user, role: "SUPER_ADMIN" });
};

const deleteJob = async (id, user) => {
  id = parseJobId(id);
  const job = await getManageableJob(id, user);
  if (!job) {
    throw createError("JOB_NOT_FOUND", "Job not found");
  }
  await pool.execute("DELETE FROM jobs WHERE id = ?", [id]);
};

const setJobPublished = async (id, user, published) => {
  id = parseJobId(id);
  if (typeof published !== "boolean") {
    throw createError(
      "INVALID_INPUT",
      "The published field must be a boolean",
    );
  }

  const job = await getManageableJob(id, user);
  if (!job) {
    throw createError("JOB_NOT_FOUND", "Job not found");
  }
  await pool.execute("UPDATE jobs SET status = ? WHERE id = ?", [
    published ? "PUBLISHED" : "DRAFT",
    id,
  ]);
  return getJobById(id, { ...user, role: "SUPER_ADMIN" });
};

module.exports = {
  createJob,
  deleteJob,
  getJobById,
  listJobs,
  setJobPublished,
  updateJob,
};