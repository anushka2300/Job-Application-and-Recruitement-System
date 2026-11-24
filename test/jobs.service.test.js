const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const jobsService = require("../src/modules/jobs/jobs.service");

const admin = { userId: 21, role: "ADMIN" };

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

test("admin job list is limited to the admin's company", async () => {
  const ownCompanyJob = { id: 8, company_id: 50, status: "DRAFT" };
  await withExecuteMock(
    [
      [[ownCompanyJob], []],
      [[{ total: 1 }], []],
    ],
    async (calls) => {
      const result = await jobsService.listJobs(admin, {});

      assert.deepEqual(result.jobs, [ownCompanyJob]);
      assert.equal(result.pagination.total, 1);
      assert.match(calls[0][0], /company_id = \(SELECT company_id FROM users WHERE id = \?\)/);
      assert.doesNotMatch(calls[0][0], /status = 'PUBLISHED' OR/);
      assert.deepEqual(calls[0][1], [admin.userId, 20, 0]);
      assert.deepEqual(calls[1][1], [admin.userId]);
    },
  );
});

test("admin cannot fetch a job from another company by ID", async () => {
  await withExecuteMock([[[], []]], async (calls) => {
    assert.equal(await jobsService.getJobById(8, admin), null);
    assert.match(calls[0][0], /company_id = \(SELECT company_id FROM users WHERE id = \?\)/);
    assert.doesNotMatch(calls[0][0], /status = 'PUBLISHED' OR/);
    assert.deepEqual(calls[0][1], [8, admin.userId]);
  });
});
