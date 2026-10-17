
const test = require("node:test");
const assert = require("node:assert/strict");

test("application status values are strings", () => {
  const status = "APPLIED";

  assert.equal(typeof status, "string");
  assert.equal(status, "APPLIED");
});
