import { test } from "node:test";
import assert from "node:assert/strict";
import { vietnamTime, shiftDay } from "../lib/time";
import { parsePageInput, normalizePost } from "../lib/facebook";
import { createMockData, mockPosts } from "../lib/mock";
import { checkPassword, hashPassword } from "../lib/crypto";
import { employeeReport, filteredPosts } from "../lib/report";
test("UTC+7 date boundary including previous UTC date", () => {
  assert.deepEqual(vietnamTime("2026-11-22T18:30:00Z"), {
    postDate: "2026-11-23",
    postHour: 1,
  });
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
});
test("Facebook input parsing rejects foreign hosts and homepage", () => {
  assert.equal(
    parsePageInput("https://www.facebook.com/profile.php?id=123"),
    "123",
  );
  assert.equal(parsePageInput("https://facebook.com/pages/Studio/123"), "123");
  assert.equal(parsePageInput("facebook.com/studio.media/"), "studio.media");
  assert.throws(() => parsePageInput("https://evil.com/studio"));
  assert.throws(() => parsePageInput("https://facebook.com"));
});
test("ambiguous attribution stays unassigned; creator mapping wins", () => {
  const store = createMockData();
  const page = store.fanpages[0];
  const input = { id: "post", created_time: "2026-11-22T18:30:00Z" };
  assert.equal(normalizePost(input, page, store.users).employeeId, null);
  store.users[1].facebookUserId = "987";
  assert.equal(
    normalizePost({ ...input, admin_creator: { id: "987" } }, page, store.users)
      .employeeId,
    store.users[1].id,
  );
  assert.equal(
    normalizePost(input, { ...page, employeeIds: ["user-1"] }, store.users)
      .employeeId,
    "user-1",
  );
});
test("mock IDs stable across repeated syncs and unique across pages", () => {
  const store = createMockData();
  assert.equal(new Set(store.posts.map((p) => p.id)).size, store.posts.length);
  assert.deepEqual(
    mockPosts(store.fanpages[0]).map((p) => p.id),
    mockPosts(store.fanpages[0]).map((p) => p.id),
  );
});
test("password hashes salted and verify safely", () => {
  const a = hashPassword("Demo@12345");
  assert.notEqual(a, hashPassword("Demo@12345"));
  assert.ok(checkPassword("Demo@12345", a));
  assert.equal(checkPassword("wrong", a), false);
});
test("filtered report matches posts without double counting", () => {
  const store = createMockData();
  const params = new URLSearchParams({
    page: store.fanpages[0].id,
    from: store.posts[0].postDate,
    to: store.posts[0].postDate,
  });
  const posts = filteredPosts(store, params);
  const report = employeeReport(store, params);
  assert.equal(posts.length, 3);
  assert.equal(
    report.reduce((s, r) => s + r.posts, 0),
    posts.length,
  );
  assert.equal(
    report.reduce((s, r) => s + r.total, 0),
    posts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0),
  );
});

