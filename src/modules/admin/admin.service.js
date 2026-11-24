const pool = require("../../config/db");

const getAdminStats = async () => {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM companies) AS companiesCount,
       (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') AS adminsCount,
       (SELECT COUNT(*)
        FROM company_invitations
        WHERE status = 'PENDING'
          AND expires_at > CURRENT_TIMESTAMP) AS pendingInvitationsCount`,
  );

  const stats = rows[0];
  return {
    companiesCount: Number(stats.companiesCount),
    adminsCount: Number(stats.adminsCount),
    pendingInvitationsCount: Number(stats.pendingInvitationsCount),
  };
};

module.exports = {
  getAdminStats,
};
