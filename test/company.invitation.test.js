const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const companyService = require("../src/modules/company/company.service");

const withExecuteMock = async (responses, callback) => {
  const originalExecute = pool.execute;
  const calls = [];
  pool.execute = async (...args) => {
    calls.push(args);
    if (responses.length === 0) {
      throw new Error(`Unexpected database query: ${args[0]}`);
    }
    return responses.shift();
  };

  try {
    await callback(calls);
  } finally {
    pool.execute = originalExecute;
  }
};

test("admin invitation rejects malformed email before querying the database", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      companyService.inviteAdminToCompany(
        5,
        "Gama@123",
        "Gama Singh",
        1,
        "ADMIN",
      ),
      {
        code: "INVALID_INVITATION",
        message: "A valid admin email address is required",
      },
    );
    assert.equal(calls.length, 0);
  });
});

test("admin invitation accepts and normalizes a valid email", async () => {
  await withExecuteMock(
    [
      [[], []],
      [{ insertId: 9 }, undefined],
    ],
    async (calls) => {
      const invitation = await companyService.inviteAdminToCompany(
        5,
        "  Gama.Singh@Example.COM  ",
        "Gama Singh",
        1,
        "ADMIN",
      );

      assert.equal(invitation.email, "gama.singh@example.com");
      assert.equal(calls[0][1][0], "gama.singh@example.com");
      assert.equal(calls[1][1][1], "gama.singh@example.com");
    },
  );
});
