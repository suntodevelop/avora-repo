import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockData } from "../src/lib/mock";
import { canManagePage, scopedStore } from "../src/lib/permissions";
import { employeeReport } from "../src/lib/report";
import { importAvora, type SourceWorkbook } from "../src/lib/import-avora";
import { parsePageInput } from "../src/lib/facebook";

const source: SourceWorkbook = {
  source: "fixture.xlsx",
  sheets: [
    {
      name: "CHECK LIST",
      merged: ["A5:A7", "I5:I7", "J5:J7"],
      rows: [
        { row: 2, cells: [{ cell: "K2", value: "46349" }] },
        {
          row: 5,
          cells: [
            { cell: "A5", value: "THÀNH TÂM" },
            { cell: "B5", value: "Page A" },
            { cell: "C5", value: "https://facebook.com/profile.php?id=12345" },
            { cell: "F5", value: "4.0" },
            { cell: "I5", value: "46349" },
            { cell: "J5", value: "0" },
          ],
        },
        {
          row: 6,
          cells: [
            { cell: "B6", value: "Page B" },
            { cell: "C6", value: "https://facebook.com/settings?tab=profile" },
            { cell: "F6", value: "SOS!!" },
          ],
        },
        { row: 7, cells: [{ cell: "B7", value: "Page C" }] },
        {
          row: 8,
          cells: [
            { cell: "C8", value: "https://facebook.com/profile.php?id=12345" },
          ],
        },
      ],
    },
  ],
};

test("Staff cannot manage another employee Page even with companyWide enabled", () => {
  const store = createMockData();
  store.settings.companyWide = true;
  const staff = store.users.find((user) => user.id === "user-1")!;
  const scope = scopedStore(store, staff);
  assert.ok(
    scope.fanpages.every((page) => page.employeeIds.includes(staff.id)),
  );
  assert.equal(canManagePage(staff, store.fanpages[1]), false);
  assert.equal(canManagePage(staff, store.fanpages[0]), true);
  assert.equal(canManagePage(store.users[0], store.fanpages[1]), true);
  assert.equal(scopedStore(store, { ...staff, role: "user" }).posts.length, 0);
  assert.equal(
    scopedStore(store, { ...staff, role: "user" }).fanpages.length,
    0,
  );
});
test("Excel import handles merged ownership, unknown counts, missing links and orphan rows without inventing posts", () => {
  const store = createMockData();
  const before = store.posts.length;
  const result = importAvora(store, source);
  assert.deepEqual(
    [
      result.employees,
      result.pages,
      result.validLinks,
      result.missingLinks,
      result.invalidLinks,
      result.totalPosts,
      result.unknownCounts,
    ],
    [1, 3, 1, 1, 1, 4, 2],
  );
  assert.equal(store.posts.length, before);
  assert.equal(store.manualChecks.length, 3);
  assert.equal(store.manualChecks[1].postCount, null);
  assert.equal(store.manualChecks[1].postCountRaw, "SOS!!");
  assert.equal(store.manualChecks[0].checked, false);
  assert.equal(store.manualChecks[0].date, "2026-11-23");
  assert.ok(
    store.manualChecks.every(
      (check) => check.employeeId === "avora:staff:thanh.tam",
    ),
  );
  assert.ok(result.issues.some((issue) => issue.row === 8));
  const originalCount = store.users.length;
  importAvora(store, source);
  assert.equal(store.users.length, originalCount);
  assert.equal(store.manualChecks.length, 3);
  const scoped = scopedStore(store, store.users[0]);
  assert.equal(scoped.fanpages.length, 3); // Seeded demo Pages do not contaminate company totals.
  assert.equal(employeeReport(scoped, new URLSearchParams())[0].posts, 4);
});
test("Missing is distinct from a real zero and Facebook sync supersedes the imported count", () => {
  const store = createMockData();
  importAvora(store, source);
  const data = scopedStore(store, store.users[0]);
  const onlyUnknown = employeeReport(
    data,
    new URLSearchParams({ page: "avora:page:6" }),
  )[0];
  assert.equal(onlyUnknown.hasCounts, false);
  data.manualChecks.find(
    (check) => check.fanpageId === "avora:page:6",
  )!.postCount = 0;
  assert.equal(
    employeeReport(data, new URLSearchParams({ page: "avora:page:6" }))[0]
      .hasCounts,
    true,
  );
  const page = data.fanpages.find((page) => page.id === "avora:page:5")!;
  page.source = "facebook";
  page.lastSync = new Date().toISOString();
  data.posts.push({
    ...store.posts[0],
    id: "real-post",
    fanpageId: page.id,
    employeeId: page.employeeIds[0],
    postDate: "2026-11-23",
  });
  assert.equal(
    employeeReport(data, new URLSearchParams({ page: page.id }))[0].posts,
    1,
  );
  assert.throws(() =>
    parsePageInput("https://facebook.com/settings?tab=profile"),
  );
});
