const pool = require("../../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const createCompany = async ({
  name,
  description,
  website,
  location,
  created_by: createdBy,
}) => {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("Company name is required");
  }

  const [result] = await pool.query(
    `INSERT INTO companies
        (name, description, website, location, created_by)
        VALUES (?, ?, ?, ?, ?)`,
    [
      name.trim(),
      description || null,
      website || null,
      location || null,
      createdBy,
    ],
  );

  return {
    id: result.insertId,
    name: name.trim(),
    description: description || null,
    website: website || null,
    location: location || null,
  };
};

const getCompanies = async () => {
  const [companies] = await pool.execute(
    `SELECT id, name, location, status
     FROM companies
     ORDER BY name ASC, id ASC`,
  );

  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    location: company.location,
    status: company.status,
  }));
};

const getCompanyById = async (companyId) => {
  const parsedCompanyId = Number(companyId);
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
    throw createError("INVALID_COMPANY_ID", "A valid company ID is required");
  }

  const [companies] = await pool.execute(
    `SELECT id, name, description, website, location
     FROM companies
     WHERE id = ?
     LIMIT 1`,
    [parsedCompanyId],
  );
  const company = companies[0];
  if (!company) {
    throw createError("COMPANY_NOT_FOUND", "Company not found");
  }

  const [admins] = await pool.execute(
    `SELECT id, name, email
     FROM users
     WHERE company_id = ? AND role = 'ADMIN'
     ORDER BY name ASC, id ASC`,
    [parsedCompanyId],
  );

  return {
    id: company.id,
    name: company.name,
    description: company.description,
    website: company.website,
    location: company.location,
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    })),
  };
};

const getCompanyInvitations = async () => {
  const [invitations] = await pool.execute(
    `SELECT invitation.id,
            invitation.company_id AS companyId,
            company.name AS companyName,
            invitation.name AS adminName,
            invitation.email AS adminEmail,
            invitation.role,
            CASE
              WHEN invitation.status = 'PENDING'
                AND invitation.expires_at <= CURRENT_TIMESTAMP
              THEN 'EXPIRED'
              ELSE invitation.status
            END AS status,
            invitation.created_at AS createdAt
     FROM company_invitations invitation
     JOIN companies company ON company.id = invitation.company_id
     ORDER BY invitation.created_at DESC, invitation.id DESC`,
  );

  return invitations;
};

const inviteAdminToCompany = async (
  companyId,
  adminEmail,
  adminName,
  invitedBy,
  role = "ADMIN",
) => {
  if (!Number.isInteger(Number(companyId)) || Number(companyId) <= 0) {
    const error = new Error("A valid company ID is required");
    error.code = "INVALID_INVITATION";
    throw error;
  }
  if (typeof adminEmail !== "string" || adminEmail.trim() === "") {
    const error = new Error("Admin email is required");
    error.code = "INVALID_INVITATION";
    throw error;
  }
  if (typeof adminName !== "string" || adminName.trim() === "") {
    const error = new Error("Admin name is required");
    error.code = "INVALID_INVITATION";
    throw error;
  }
  if (!["ADMIN", "RECRUITER"].includes(role)) {
    const error = new Error("Invitation role must be ADMIN or RECRUITER");
    error.code = "INVALID_INVITATION";
    throw error;
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();
  const [existingUsers] = await pool.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [normalizedEmail],
  );
  if (existingUsers.length > 0) {
    const error = new Error("An account already exists for this email");
    error.code = "EMAIL_ALREADY_REGISTERED";
    throw error;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [result] = await pool.execute(
    `INSERT INTO company_invitations
        (company_id, email, name, role, token, expires_at, invited_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(companyId),
      normalizedEmail,
      adminName.trim(),
      role,
      token,
      expiresAt,
      invitedBy,
    ],
  );

  return {
    id: result.insertId,
    email: normalizedEmail,
    name: adminName.trim(),
    role,
    token,
    expiresAt,
  };
};

const acceptCompanyInvitation = async (token, password) => {
  if (typeof token !== "string" || token.trim() === "") {
    const error = new Error("Invitation token is required");
    error.code = "INVALID_INVITATION";
    throw error;
  }
  if (typeof password !== "string" || password.length < 8) {
    const error = new Error("Password must be at least 8 characters");
    error.code = "INVALID_PASSWORD";
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [invitations] = await connection.execute(
      `SELECT id, company_id, email, name, role, status, expires_at
       FROM company_invitations
       WHERE token = ?
       LIMIT 1
       FOR UPDATE`,
      [token.trim()],
    );
    const invitation = invitations[0];
    if (!invitation || invitation.status !== "PENDING") {
      const error = new Error("Invitation is invalid or has already been used");
      error.code = "INVALID_INVITATION";
      throw error;
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      await connection.execute(
        "UPDATE company_invitations SET status = 'EXPIRED' WHERE id = ?",
        [invitation.id],
      );
      await connection.commit();
      transactionStarted = false;
      const error = new Error("Invitation has expired");
      error.code = "INVITATION_EXPIRED";
      throw error;
    } else {
      const [userResult] = await connection.execute(
        `INSERT INTO users
          (name, email, password, role, company_id, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          invitation.name,
          invitation.email,
          hashedPassword,
          invitation.role,
          invitation.company_id,
        ],
      );

      await connection.execute(
        "UPDATE company_invitations SET status = 'ACCEPTED' WHERE id = ?",
        [invitation.id],
      );
      await connection.commit();
      transactionStarted = false;

      return {
        id: userResult.insertId,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        company_id: invitation.company_id,
      };
    }
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY") {
      const registrationError = new Error(
        "An account already exists for this email",
      );
      registrationError.code = "EMAIL_ALREADY_REGISTERED";
      throw registrationError;
    }
    throw error;
  } finally {
    connection.release();
  }

};

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  getCompanyInvitations,
  inviteAdminToCompany,
  acceptCompanyInvitation,
};
