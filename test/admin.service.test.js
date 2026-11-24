const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const adminService = require("../src/modules/admin/admin.service");

test("admin stats returns numeric counts", async () => {
  const originalExecute = pool.execute;
  let query;
  pool.execute = async (sql) => {
    query = sql;
    return [[{
      companiesCount: "12",
      adminsCount: "35",
      pendingInvitationsCount: "3",
    }], []];
  };

  try {
    assert.deepEqual(await adminService.getAdminStats(), {
      companiesCount: 12,
      adminsCount: 35,
      pendingInvitationsCount: 3,
    });
    assert.match(query, /expires_at > CURRENT_TIMESTAMP/);
  } finally {
    pool.execute = originalExecute;
  }
});
