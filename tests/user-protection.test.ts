import { test } from "node:test";
import assert from "node:assert/strict";
import { userProtectionError } from "../src/lib/permissions";
test("Every Admin is protected, including an Admin different from the current actor", () => {
  const otherAdmin = { id: "another-admin", role: "admin" as const };
  assert.ok(userProtectionError(otherAdmin, "delete"));
  assert.ok(userProtectionError(otherAdmin, "save", "staff"));
  assert.ok(userProtectionError(otherAdmin, "save", "user"));
  assert.equal(userProtectionError(otherAdmin, "save", "admin"), null);
  assert.equal(userProtectionError({ role: "staff" }, "delete"), null);
  assert.equal(userProtectionError({ role: "user" }, "save", "staff"), null);
});
