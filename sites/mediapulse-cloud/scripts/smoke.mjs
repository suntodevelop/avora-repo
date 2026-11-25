import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const networkFetch = globalThis.fetch;
async function fetch(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Connection", "close");
  const response = await networkFetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(20000),
  });
  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
async function login(email) {
  const response = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password: "Demo@12345" }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.get("set-cookie").split(";")[0];
}
async function call(cookie, body) {
  return fetch(`${base}/api/data`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
assert.equal((await fetch(`${base}/api/data`)).status, 401);
const admin = await login("admin@media.local");
const snapshot = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
assert.equal(snapshot.viewer.role, "admin");
assert.equal(snapshot.fanpages.length, 6);
assert.ok(snapshot.posts.length >= 252);
assert.ok(!JSON.stringify(snapshot).includes("passwordHash"));
assert.ok(!JSON.stringify(snapshot).includes("tokenEncrypted"));
const before = snapshot.posts.length;
for (let i = 0; i < 2; i++) {
  const sync = await call(admin, { action: "sync" });
  assert.equal(sync.status, 200);
  const result = await sync.json();
  assert.ok(result.results.every((r) => r.success));
}
const after = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
assert.equal(after.posts.length, before);
const employee = await login("nv1@media.local");
const own = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: employee } })
).json();
assert.ok(own.fanpages.every((p) => p.employeeIds.includes("user-1")));
assert.ok(
  own.posts.every((p) => own.fanpages.some((f) => f.id === p.fanpageId)),
);
assert.equal(
  (await call(employee, { action: "deletePage", id: snapshot.fanpages[0].id }))
    .status,
  403,
);
assert.equal(
  (
    await fetch(`${base}/admin`, {
      headers: { Cookie: employee },
      redirect: "manual",
    })
  ).status,
  307,
);
assert.equal((await fetch(`${base}/api/cron`)).status, 401);
const page = own.fanpages[0];
const response = await fetch(`${base}/api/export?page=${page.id}`, {
  headers: { Cookie: employee },
});
assert.equal(response.status, 200);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
assert.equal(workbook.worksheets.length, 2);
assert.equal(
  workbook.worksheets[1].rowCount - 1,
  own.posts.filter((p) => p.fanpageId === page.id).length,
);
assert.equal(
  (
    await fetch(`${base}/api/data`, {
      method: "POST",
      headers: {
        Cookie: admin,
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync" }),
    })
  ).status,
  403,
);
console.log(
  "PASS: authentication, server RBAC, scoped data/export, valid XLSX, repeated sync idempotency, origin guard, cron authorization.",
);
const email = `smoke-${Date.now()}@media.local`;
const createdUserResponse = await call(admin, {
  action: "saveUser",
  name: "Smoke Test",
  email,
  role: "user",
  password: "SmokeTest@12345",
});
assert.equal(createdUserResponse.status, 200, await createdUserResponse.text());
let fresh = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
const created = fresh.users.find((u) => u.email === email);
assert.ok(created);
assert.equal(
  (
    await call(admin, {
      action: "saveUser",
      id: created.id,
      name: "Smoke Updated",
      email,
      role: "user",
    })
  ).status,
  200,
);
assert.equal(
  (await call(admin, { action: "deleteUser", id: created.id })).status,
  200,
);
const post = after.posts[0];
assert.equal(
  (
    await call(admin, {
      action: "review",
      id: post.id,
      status: "flagged",
      note: "Smoke review",
      employeeId: post.employeeId,
    })
  ).status,
  200,
);
assert.equal(
  (await call(admin, { action: "sync", id: post.fanpageId })).status,
  200,
);
fresh = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
const reviewed = fresh.posts.find((p) => p.id === post.id);
assert.equal(reviewed.note, "Smoke review");
assert.equal(reviewed.status, "flagged");
assert.equal(reviewed.attribution, "manual");
assert.equal(
  (
    await call(admin, {
      action: "review",
      id: post.id,
      status: post.status,
      note: post.note,
      employeeId: post.employeeId,
    })
  ).status,
  200,
);
console.log(
  "PASS: employee create/update/delete and manual review preserved through sync.",
);
const pageId = String(Date.now());
const createdPageResponse = await call(admin, {
  action: "savePage",
  name: "Smoke Page",
  url: pageId,
  source: "mock",
  employeeIds: ["user-1"],
  token: "",
});
assert.equal(createdPageResponse.status, 200);
assert.ok((await createdPageResponse.json()).results.every((r) => r.success));
fresh = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
const createdPage = fresh.fanpages.find((p) => p.pageId === pageId);
assert.ok(createdPage);
assert.equal(
  fresh.posts.filter((p) => p.fanpageId === createdPage.id).length,
  42,
);
assert.equal(
  (
    await call(admin, {
      action: "savePage",
      id: createdPage.id,
      name: "Smoke Updated Page",
      url: pageId,
      source: "mock",
      employeeIds: ["user-2"],
      token: "",
    })
  ).status,
  200,
);
assert.equal(
  (await call(admin, { action: "deletePage", id: createdPage.id })).status,
  200,
);
fresh = await (
  await fetch(`${base}/api/data`, { headers: { Cookie: admin } })
).json();
assert.ok(!fresh.posts.some((p) => p.fanpageId === createdPage.id));
console.log(
  "PASS: Fanpage create/update/delete, immediate sync, cascaded post cleanup.",
);
