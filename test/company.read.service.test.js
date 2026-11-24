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

test("company list includes status", async () => {
  await withExecuteMock(
    [[[
      { id: 8, name: "Example Co", location: "London", status: "ACTIVE" },
    ], []]],
    async () => {
      assert.deepEqual(await companyService.getCompanies(), [
        { id: 8, name: "Example Co", location: "London", status: "ACTIVE" },
      ]);
    },
  );
});

test("company details include associated admins", async () => {
  await withExecuteMock(
    [
      [[{
        id: 8,
        name: "Example Co",
        description: "A company",
        website: "https://example.com",
        location: "London",
      }], []],
      [[{ id: 21, name: "A. Admin", email: "admin@example.com" }], []],
    ],
    async (calls) => {
      assert.deepEqual(await companyService.getCompanyById("8"), {
        id: 8,
        name: "Example Co",
        description: "A company",
        website: "https://example.com",
        location: "London",
        admins: [{ id: 21, name: "A. Admin", email: "admin@example.com" }],
      });
      assert.deepEqual(calls[1][1], [8]);
    },
  );
});

test("invalid and missing company IDs are handled explicitly", async () => {
  await withExecuteMock([[[], []]], async (calls) => {
    await assert.rejects(companyService.getCompanyById("invalid"), {
      code: "INVALID_COMPANY_ID",
    });
    await assert.rejects(companyService.getCompanyById("99"), {
      code: "COMPANY_NOT_FOUND",
    });
    assert.equal(calls.length, 1);
  });
});

test("invitation list maps company and invitee fields and reports expired invites", async () => {
  await withExecuteMock(
    [[[
      {
        id: 4,
        companyId: 8,
        companyName: "Example Co",
        adminName: "A. Admin",
        adminEmail: "admin@example.com",
        role: "ADMIN",
        status: "EXPIRED",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ], []]],
    async (calls) => {
      const invitations = await companyService.getCompanyInvitations();
      assert.equal(invitations[0].companyId, 8);
      assert.equal(invitations[0].adminEmail, "admin@example.com");
      assert.equal(invitations[0].status, "EXPIRED");
      assert.match(calls[0][0], /CURRENT_TIMESTAMP/);
    },
  );
});
