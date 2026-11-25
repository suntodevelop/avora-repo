import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
async function http(path, cookie, options = {}) {
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
}
async function login(email, password) {
  const response = await http("/api/auth", null, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.get("set-cookie").split(";")[0];
}
async function data(cookie) {
  const response = await http("/api/data", cookie);
  assert.equal(response.status, 200);
  return response.json();
}
async function mutate(cookie, body, status = 200) {
  const response = await http("/api/data", cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
async function assertWorkspaceRedirect(path, cookie) {
  const response = await http(path, cookie, { redirect: "manual" });
  if (response.status === 307) {
    assert.equal(response.headers.get("location"), "/");
    await response.body?.cancel();
    return;
  }
  // With loading.tsx, Next can flush the shared shell before a page guard resolves.
  // In that streaming case it sends the documented client redirect, never page content.
  assert.equal(response.status, 200);
  const html = await response.text();
  const meta = html.match(/<meta[^>]*http-equiv="refresh"[^>]*>/i)?.[0] || "";
  assert.ok(meta.includes('url=/"'), "Expected redirect to company summary");
  assert.ok(html.includes("NEXT_REDIRECT"));
  assert.ok(
    !html.includes("data-banner-theme="),
    "Unauthorized page content must not render",
  );
}

assert.equal((await http("/api/data")).status, 401);
const admin = await login("admin@media.local", "Demo@12345");
const staff = await login("thanh.tam@avora.local", "Avora@12345");
const reader = await login("viewer@avora.local", "Demo@12345");
const all = await data(admin),
  own = await data(staff);
for (const stale of all.users.filter(
  (user) => /^qa-\d+@avora\.local$/.test(user.email) && /^QA /.test(user.name),
))
  await mutate(admin, { action: "deleteUser", id: stale.id });
assert.equal(all.viewer.role, "admin");
assert.equal(own.viewer.role, "staff");
assert.equal(all.fanpages.length, 145);
assert.equal(all.manualChecks.length, 145);
assert.equal(all.posts.length, 0);
assert.equal(
  all.manualChecks.reduce((sum, row) => sum + (row.postCount ?? 0), 0),
  293,
);
assert.ok(
  own.fanpages.every((page) => page.employeeIds.includes(own.viewer.id)),
);
assert.ok(
  own.manualChecks.every((check) =>
    own.fanpages.some((page) => page.id === check.fanpageId),
  ),
);
assert.ok(!JSON.stringify(all).includes("passwordHash"));
assert.ok(!JSON.stringify(all).includes("tokenEncrypted"));
assert.equal((await http("/api/data", reader)).status, 403);
assert.equal((await http("/api/export", reader)).status, 403);
const summary = await (
  await http("/api/summary?from=2026-11-23&to=2026-11-23", reader)
).json();
assert.equal(summary.totalPosts, 293);
assert.equal(summary.rows.length, 14);
assert.equal(summary.missingCounts, 23);
for (const forbidden of [
  "fanpages",
  "facebookUrl",
  "facebookName",
  "email",
  "message",
  "likes",
  "sourceFile",
  "postsDetail",
])
  assert.ok(!JSON.stringify(summary).includes(`"${forbidden}"`));
assert.equal(
  summary.rows.find((row) => row.name === "NGỌC THỊNH").hasCounts,
  false,
);
for (const path of ["/posts", "/admin", "/staff", "/users"]) {
  await assertWorkspaceRedirect(path, reader);
}
await mutate(reader, { action: "savePage", name: "Forbidden" }, 403);
for (const action of ["saveUser", "deleteUser", "settings", "review", "sync"])
  await mutate(staff, { action }, 403);
const other = all.fanpages.find(
  (page) => !page.employeeIds.includes(own.viewer.id),
);
await mutate(staff, { action: "savePage", ...other, token: "" }, 403);
await mutate(staff, { action: "deletePage", id: other.id }, 403);
await mutate(
  staff,
  {
    action: "savePage",
    name: "Forbidden owner",
    url: "",
    source: "manual",
    employeeIds: other.employeeIds,
  },
  403,
);
const stamp = Date.now();
const created = await mutate(staff, {
  action: "savePage",
  name: `QA Page ${stamp}`,
  source: "manual",
  url: `https://facebook.com/profile.php?id=${stamp}`,
  managerFacebookName: "QA Facebook holder",
  managerFacebookUrl: "https://facebook.com/qa.profile",
});
let current = await data(staff);
const page = current.fanpages.find((page) => page.id === created.id);
assert.deepEqual(page.employeeIds, [own.viewer.id]);
assert.equal(page.managerFacebookName, "QA Facebook holder");
await mutate(staff, {
  action: "savePage",
  ...page,
  name: "QA Updated",
  token: "",
});
const assignee = all.users.find(
  (user) => user.email === "minh.nhat@avora.local",
);
await mutate(admin, {
  action: "savePage",
  ...page,
  name: "QA Reassigned",
  employeeIds: [assignee.id],
  token: "",
});
await mutate(staff, { action: "savePage", ...page, token: "" }, 403);
await mutate(staff, { action: "deletePage", id: page.id }, 403);
const secondStaff = await login(assignee.email, "Avora@12345");
await mutate(secondStaff, { action: "deletePage", id: page.id });
const email = `qa-${stamp}@avora.local`;
await mutate(admin, {
  action: "saveUser",
  name: "QA Staff",
  email,
  role: "staff",
  password: "QaPassword@12345",
  facebookName: "QA Profile",
  facebookUrl: "https://facebook.com/qa.profile",
});
current = await data(admin);
const createdUser = current.users.find((user) => user.email === email);
await mutate(admin, {
  action: "saveUser",
  ...createdUser,
  name: "QA User",
  role: "user",
});

// Account management and profile endpoint must not allow privilege escalation.
await mutate(admin, { action: "saveUser", ...all.viewer, role: "staff" }, 400);
await mutate(admin, { action: "deleteUser", id: all.viewer.id }, 400);
assert.equal((await http("/api/profile")).status, 401);
const qaCookie = await login(email, "QaPassword@12345");
const form = new FormData();
form.set("name", "QA Profile Updated");
form.set("phone", "0901234567");
form.set("address", "QA local test address");
form.set("role", "admin");
form.set("id", all.viewer.id);
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
form.set("avatar", new Blob([image], { type: "image/png" }), "avatar.png");
const profileResponse = await http("/api/profile", qaCookie, {
  method: "POST",
  body: form,
  headers: { Origin: base },
});
assert.equal(profileResponse.status, 200, await profileResponse.clone().text());
const savedProfile = await profileResponse.json();
assert.equal(savedProfile.name, "QA Profile Updated");
assert.equal(savedProfile.id, createdUser.id);
assert.equal(savedProfile.role, "user");
assert.equal(savedProfile.phone, "0901234567");
assert.ok(savedProfile.avatarUrl.startsWith("data:image/png;base64,"));
assert.ok(!("passwordHash" in savedProfile));
assert.equal(
  (await (await http("/api/profile", qaCookie)).json()).address,
  "QA local test address",
);
assert.equal(
  (await (await http("/api/profile", admin)).json()).name,
  all.viewer.name,
);
const invalidForm = new FormData();
invalidForm.set("name", "QA Profile Updated");
invalidForm.set(
  "avatar",
  new Blob(["<svg/>"], { type: "image/svg+xml" }),
  "bad.svg",
);
assert.equal(
  (
    await http("/api/profile", qaCookie, {
      method: "POST",
      body: invalidForm,
      headers: { Origin: base },
    })
  ).status,
  400,
);
console.log(
  "PASS: Admin deletion/demotion blocked; self profile and avatar persist; role/target injection and SVG uploads rejected.",
);

await mutate(admin, { action: "deleteUser", id: createdUser.id });
for (const cookie of [admin, staff]) {
  const response = await http(
    "/api/export?from=2026-11-23&to=2026-11-23",
    cookie,
  );
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const manual = workbook.getWorksheet("Check thủ công");
  assert.ok(manual);
  assert.equal(
    manual.rowCount - 1,
    cookie === admin ? all.manualChecks.length : own.manualChecks.length,
  );
}
for (let index = 0; index < 2; index++) await mutate(admin, { action: "sync" });
current = await data(admin);
assert.equal(current.posts.length, 0);
assert.equal(current.manualChecks.length, 145);
assert.equal(current.fanpages.length, 145);
console.log(
  "PASS: 14 employees, 145 Pages, 293 known posts, 23 missing counts; safe import and source isolation.",
);
console.log(
  "PASS: Admin CRUD users/Pages; Staff CRUD assigned Pages and holder Facebook; cross-owner writes denied after reassignment.",
);
console.log(
  "PASS: User receives counts only; details/export/mutations denied; scoped XLSX; manual sync does not fabricate posts.",
);

for (const [cookie, role] of [
  [admin, "Admin"],
  [staff, "Staff"],
  [reader, "User"],
]) {
  const html = await (await http("/", cookie)).text();
  assert.ok(
    html.includes("AVORA MEDIA - " + role),
    "Expected role title: " + role,
  );
}
await assertWorkspaceRedirect("/users", staff);
console.log(
  "PASS: role-specific titles render for Admin/Staff/User; Staff cannot enter User management.",
);
