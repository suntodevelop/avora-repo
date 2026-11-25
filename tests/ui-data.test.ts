import { test } from "node:test";
import assert from "node:assert/strict";
import { groupFanpages, matchesSearch } from "../src/lib/ui-data";
import { createMockData } from "../src/lib/mock";
import {
  filteredPosts,
  filteredChecks,
  employeeReport,
} from "../src/lib/report";

test("Grouping keeps shared Pages in a single group independent of assignee order", () => {
  const pages = [
    { id: "1", name: "One", employeeIds: ["b", "a"] },
    { id: "2", name: "Two", employeeIds: ["a", "b", "a"] },
    { id: "3", name: "Three", employeeIds: [] },
  ];
  const groups = groupFanpages(pages, [
    { id: "a", name: "An" },
    { id: "b", name: "Bình" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "An · Bình");
  assert.deepEqual(
    groups.flatMap((group) => group.pages.map((page) => page.id)),
    ["1", "2", "3"],
  );
  assert.equal(groups.at(-1)?.name, "Chưa phân công");
});

test("Search combines date, employee, content and accented Vietnamese consistently for report totals", () => {
  const data = createMockData();
  const user = data.users[1],
    page = data.fanpages[0];
  user.name = "Đặng Thành Tâm";
  page.employeeIds = [user.id];
  page.source = "manual";
  const post = data.posts[0];
  post.employeeId = user.id;
  post.fanpageId = page.id;
  post.postDate = "2026-11-23";
  post.message = "Nội dung đặc biệt";
  data.posts = [post];
  data.manualChecks = [
    {
      id: "check",
      date: "2026-11-23",
      fanpageId: page.id,
      employeeId: user.id,
      postCount: 5,
      postCountRaw: "5",
      commentCount: null,
      commentCountRaw: "",
      checked: false,
      note: "Ghi chú đặc biệt",
      sourceFile: "test.xlsx",
      sourceSheet: "Test",
      sourceRow: 1,
    },
  ];
  const params = new URLSearchParams({
    from: "2026-11-23",
    to: "2026-11-23",
    q: "thanh tam dac biet",
  });
  assert.equal(filteredPosts(data, params).length, 1);
  assert.equal(filteredChecks(data, params).length, 1);
  assert.equal(
    employeeReport(data, params).reduce((sum, row) => sum + row.posts, 0),
    6,
  );
  params.set("from", "2026-11-24");
  assert.equal(filteredPosts(data, params).length, 0);
  assert.equal(filteredChecks(data, params).length, 0);
  assert.equal(matchesSearch("Đặng Thành Tâm", "dang tam"), true);
});
