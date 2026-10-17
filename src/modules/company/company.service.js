const pool = require("../../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

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
  inviteAdminToCompany,
  acceptCompanyInvitation,
};
