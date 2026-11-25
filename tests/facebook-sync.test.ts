import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPosts, normalizePost } from "../src/lib/facebook";
import { applyDailySync } from "../src/lib/sync";
import { syncWindow, dateSynced } from "../src/lib/time";
import { employeeReport, filteredChecks } from "../src/lib/report";
import type { Fanpage, Store } from "../src/lib/types";
const page: Fanpage = {
  id: "page",
  name: "Test Page",
  pageId: "123",
  url: "https://facebook.com/123",
  tokenEncrypted: "",
  source: "facebook",
  lastSync: null,
  employeeIds: ["staff"],
};
const item = (id: string, time = "2026-11-23T10:15:42Z") => ({
  id,
  created_time: time,
  message: "Bài thử",
  likes: { summary: { total_count: 12 } },
  comments: { summary: { total_count: 4 } },
  shares: { count: 3 },
});
const fixture = (): Store => ({
  users: [
    {
      id: "staff",
      name: "Nhân viên",
      email: "test@example.com",
      role: "staff",
      passwordHash: "",
    },
  ],
  fanpages: [structuredClone(page)],
  posts: [],
  manualChecks: ["2026-11-22", "2026-11-23"].map((date) => ({
    id: date,
    date,
    fanpageId: page.id,
    employeeId: "staff",
    postCount: 7,
    commentCount: null,
    postCountRaw: "7",
    commentCountRaw: "",
    checked: true,
    note: "",
    sourceFile: "file",
    sourceSheet: "sheet",
    sourceRow: 1,
  })),
  settings: { companyWide: false, cronEnabled: false },
});

test("Vietnam daily window is midnight to next midnight, validates calendar dates", () => {
  const window = syncWindow("2026-11-23");
  assert.equal(
    new Date(Number(window.since) * 1000).toISOString(),
    "2026-11-22T17:00:00.000Z",
  );
  assert.equal(
    new Date(Number(window.until) * 1000).toISOString(),
    "2026-11-23T17:00:00.000Z",
  );
  for (const date of ["2026-02-30", "wrong", "2026-13-01"])
    assert.throws(() => syncWindow(date));
});
test("Graph pagination keeps UTC+7 bounds, bearer token private, deduplicates and filters midnight edges", async (t) => {
  const requests: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(
      (init.headers as Record<string, string>).Authorization,
      "Bearer secret-test-token",
    );
    const data =
      requests.length === 1
        ? [
            item("before", "2026-11-22T16:59:59Z"),
            item("start", "2026-11-22T17:00:00Z"),
            item("same"),
          ]
        : [
            item("same"),
            item("end", "2026-11-23T16:59:59Z"),
            item("after", "2026-11-23T17:00:00Z"),
          ];
    return Response.json({
      data,
      ...(requests.length === 1
        ? {
            paging: {
              next: "https://graph.facebook.com/ignored?access_token=never-follow",
              cursors: { after: "cursor2" },
            },
          }
        : {}),
    });
  });
  const posts = await fetchPosts(page, "secret-test-token", [], "2026-11-23");
  assert.deepEqual(
    posts.map((p) => p.id),
    ["start", "same", "end"],
  );
  assert.equal(posts[0].postHour, 0);
  assert.deepEqual(
    [posts[1].likes, posts[1].comments, posts[1].shares],
    [12, 4, 3],
  );
  assert.equal(requests[1].searchParams.get("after"), "cursor2");
  for (const request of requests)
    assert.equal(
      request.searchParams.get("since"),
      syncWindow("2026-11-23").since,
    );
});
test("admin_creator permission fallback retries the same window without inventing creator", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: URL) => {
    const url = new URL(String(input));
    calls++;
    if (calls === 1)
      return Response.json({ error: { code: 100 } }, { status: 400 });
    assert.equal(
      url.searchParams.get("fields")!.includes("admin_creator"),
      false,
    );
    return Response.json({ data: [item("one")] });
  });
  const posts = await fetchPosts(page, "token", [], "2026-11-23");
  assert.equal(posts[0].employeeId, "staff");
  assert.equal(calls, 2);
});
test("pagination failure rejects the entire fetch; expired token is not replaced by mock posts", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++calls === 1
      ? Response.json({
          data: [item("one")],
          paging: { next: "next", cursors: { after: "two" } },
        })
      : Response.json({ error: { code: 190 } }, { status: 400 }),
  );
  await assert.rejects(fetchPosts(page, "token", [], "2026-11-23"), /190/);
});
test("daily sync updates metrics without duplicates, preserves review and other dates, replaces only that day's manual count", () => {
  const store = fixture();
  store.posts = [
    normalizePost(item("outside", "2026-11-21T18:00:00Z"), page, store.users),
  ];
  const incoming = normalizePost(item("one"), page, store.users);
  applyDailySync(
    store,
    structuredClone(store.fanpages[0]),
    [incoming],
    "2026-11-23",
  );
  store.posts.find((p) => p.id === "one")!.note = "Giữ ghi chú";
  store.posts.find((p) => p.id === "one")!.status = "approved";
  applyDailySync(
    store,
    structuredClone(store.fanpages[0]),
    [{ ...incoming, likes: 25 }],
    "2026-11-23",
  );
  assert.equal(store.posts.length, 2);
  assert.equal(store.posts.find((p) => p.id === "one")!.likes, 25);
  assert.equal(store.posts.find((p) => p.id === "one")!.note, "Giữ ghi chú");
  assert.equal(store.posts.find((p) => p.id === "one")!.status, "approved");
  assert.deepEqual(
    filteredChecks(store, new URLSearchParams()).map((c) => c.date),
    ["2026-11-22"],
  );
  assert.equal(store.manualChecks.length, 2);
  assert.equal(dateSynced(store.fanpages[0], "2026-11-22"), false);
});
test("successful empty day reconciles stale posts and records a known zero; configuration changes reject commit", () => {
  const store = fixture();
  const stale = structuredClone(store.fanpages[0]);
  store.posts = [normalizePost(item("one"), page, store.users)];
  applyDailySync(store, structuredClone(store.fanpages[0]), [], "2026-11-23");
  assert.equal(store.posts.length, 0);
  const row = employeeReport(
    store,
    new URLSearchParams({ from: "2026-11-23", to: "2026-11-23" }),
  )[0];
  assert.equal(row.posts, 0);
  assert.equal(row.hasCounts, true);
  assert.equal(filteredChecks(store, new URLSearchParams()).length, 1);
  assert.throws(
    () => applyDailySync(store, stale, [], "2026-11-23"),
    /thay đổi/,
  );
});
