const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const cloudinary = require("../src/config/cloudinary");
const applicationService = require("../src/modules/applications/application.service");

const candidate = { userId: 7, role: "CANDIDATE" };
const recruiter = { userId: 11, role: "RECRUITER" };
const validResume = { buffer: Buffer.from("%PDF-1.7") };

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

const applicationRow = (overrides = {}) => ({
  id: 35,
  job_id: 21,
  candidate_id: 7,
  status: "APPLIED",
  company_id: 90,
  created_by: recruiter.userId,
  ...overrides,
});

test("candidate cannot apply twice to the same job", async () => {
  await withExecuteMock(
    [
      [[{ id: 21, status: "PUBLISHED" }], []],
      [[{ id: 35 }], []],
    ],
    async (calls) => {
      await assert.rejects(
        applicationService.createApplication(candidate, {
          jobId: 21,
          resumeFile: validResume,
        }),
        { code: "ALREADY_APPLIED" },
      );
      assert.equal(calls.length, 2);
    },
  );
});

test("candidate can get a short-lived URL for their own resume", async () => {
  const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
  const urls = [];
  cloudinary.utils.private_download_url = (...args) => {
    urls.push(args);
    return "https://cloudinary.example/resume.pdf";
  };

  try {
    await withExecuteMock(
      [[[
        applicationRow({
          candidate_id: candidate.userId,
          resume_url: "resumes/candidate-resume.pdf",
        }),
      ], []]],
      async (calls) => {
        const url = await applicationService.getApplicationResumeUrl(candidate, 35);

        assert.equal(url, "https://cloudinary.example/resume.pdf");
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0][1], [candidate.userId, 35]);
        assert.equal(urls[0][0], "resumes/candidate-resume.pdf");
        assert.equal(urls[0][1], "pdf");
        assert.equal(urls[0][2].resource_type, "raw");
        assert.equal(urls[0][2].type, "authenticated");
        assert.equal(urls[0][2].attachment, false);
        assert.ok(urls[0][2].expires_at > Math.floor(Date.now() / 1000));
      },
    );
  } finally {
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
  }
});

test("candidate cannot get another candidate's resume URL", async () => {
  const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
  cloudinary.utils.private_download_url = () => {
    throw new Error("Resume URL must not be generated for unauthorized users");
  };

  try {
    await withExecuteMock(
      [[[
        applicationRow({
          candidate_id: candidate.userId + 1,
          resume_url: "resumes/another-candidate.pdf",
        }),
      ], []]],
      async () => {
        await assert.rejects(
          applicationService.getApplicationResumeUrl(candidate, 35),
          { code: "FORBIDDEN" },
        );
      },
    );
  } finally {
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
  }
});

test("candidate cannot apply to a draft job", async () => {
  await withExecuteMock([[[{ id: 21, status: "DRAFT" }], []]], async (calls) => {
    await assert.rejects(
      applicationService.createApplication(candidate, {
        jobId: 21,
        resumeFile: validResume,
      }),
      { code: "INVALID_INPUT" },
    );
    assert.equal(calls.length, 1);
  });
});

test("candidate cannot apply to a job that does not exist", async () => {
  await withExecuteMock([[[], []]], async (calls) => {
    await assert.rejects(
      applicationService.createApplication(candidate, {
        jobId: 999,
        resumeFile: validResume,
      }),
      { code: "JOB_NOT_FOUND" },
    );
    assert.equal(calls.length, 1);
  });
});

test("application requires a PDF resume", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      applicationService.createApplication(candidate, { jobId: 21 }),
      { code: "INVALID_INPUT" },
    );
    await assert.rejects(
      applicationService.createApplication(candidate, {
        jobId: 21,
        resumeFile: { buffer: Buffer.from("not a PDF") },
      }),
      { code: "INVALID_INPUT" },
    );
    assert.equal(calls.length, 0);
  });
});

test("only candidates can submit applications", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      applicationService.createApplication(recruiter, {
        jobId: 21,
        resumeFile: validResume,
      }),
      { code: "FORBIDDEN" },
    );
    assert.equal(calls.length, 0);
  });
});

test("application status cannot be set to an invalid value", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      applicationService.updateApplicationStatus(recruiter, 35, "HIRED"),
      { code: "INVALID_INPUT" },
    );
    assert.equal(calls.length, 0);
  });
});

test("withdrawn status must use the application withdrawal endpoint", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      applicationService.updateApplicationStatus(recruiter, 35, "WITHDRAWN"),
      { code: "INVALID_INPUT" },
    );
    assert.equal(calls.length, 0);
  });
});

test("recruiter cannot update an application belonging to another company", async () => {
  await withExecuteMock(
    [
      [[applicationRow({ company_id: 90 })], []],
      [[{ company_id: 50 }], []],
    ],
    async (calls) => {
      await assert.rejects(
        applicationService.updateApplicationStatus(recruiter, 35, "SHORTLISTED"),
        { code: "FORBIDDEN" },
      );
      assert.equal(calls.length, 2);
    },
  );
});

test("recruiter cannot update another recruiter's application in their company", async () => {
  await withExecuteMock(
    [
      [[applicationRow({ company_id: 50, created_by: 12 })], []],
      [[{ company_id: 50 }], []],
    ],
    async (calls) => {
      await assert.rejects(
        applicationService.updateApplicationStatus(recruiter, 35, "SHORTLISTED"),
        { code: "FORBIDDEN" },
      );
      assert.equal(calls.length, 2);
    },
  );
});

test("recruiter can update an application for their own job and company", async () => {
  const updatedApplication = applicationRow({
    company_id: 50,
    status: "SHORTLISTED",
    job_title: "Software Engineer",
  });
  await withExecuteMock(
    [
      [[applicationRow({ company_id: 50 })], []],
      [[{ company_id: 50 }], []],
      [{ affectedRows: 1 }, undefined],
      [[updatedApplication], []],
    ],
    async (calls) => {
      const result = await applicationService.updateApplicationStatus(
        recruiter,
        35,
        "SHORTLISTED",
      );
      assert.equal(result.status, "SHORTLISTED");
      assert.equal(calls.length, 4);
    },
  );
});

test("candidate cannot change an application's review status", async () => {
  await withExecuteMock(
    [
      [[applicationRow()], []],
      [[{ company_id: null }], []],
    ],
    async (calls) => {
      await assert.rejects(
        applicationService.updateApplicationStatus(candidate, 35, "REJECTED"),
        { code: "FORBIDDEN" },
      );
      assert.equal(calls.length, 2);
    },
  );
});

test("candidate cannot withdraw another candidate's application", async () => {
  await withExecuteMock(
    [[[{ id: 35, candidate_id: 8, status: "APPLIED" }], []]],
    async (calls) => {
      await assert.rejects(
        applicationService.deleteApplication(candidate, 35),
        { code: "FORBIDDEN" },
      );
      assert.equal(calls.length, 1);
    },
  );
});

test("candidate cannot withdraw an application after a final decision", async () => {
  await withExecuteMock(
    [[[{ id: 35, candidate_id: candidate.userId, status: "SELECTED" }], []]],
    async (calls) => {
      await assert.rejects(
        applicationService.deleteApplication(candidate, 35),
        { code: "INVALID_INPUT" },
      );
      assert.equal(calls.length, 1);
    },
  );
});

test("invalid application IDs are rejected before querying the database", async () => {
  await withExecuteMock([], async (calls) => {
    await assert.rejects(
      applicationService.updateApplicationStatus(recruiter, "invalid", "REJECTED"),
      { code: "INVALID_INPUT" },
    );
    assert.equal(calls.length, 0);
  });
});
