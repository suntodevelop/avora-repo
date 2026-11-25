import type { Fanpage, Store, User } from "./types";

export function canManagePage(actor: User, page: Fanpage) {
  return (
    actor.role === "admin" ||
    (actor.role === "staff" && page.employeeIds.includes(actor.id))
  );
}
export function companyStore(store: Store): Store {
  const hasRealPages = store.fanpages.some((page) => page.source !== "mock");
  if (!hasRealPages) return store;
  const fanpages = store.fanpages.filter((page) => page.source !== "mock");
  const ids = new Set(fanpages.map((page) => page.id));
  return {
    ...store,
    fanpages,
    posts: store.posts.filter((post) => ids.has(post.fanpageId)),
    manualChecks: (store.manualChecks || []).filter((check) =>
      ids.has(check.fanpageId),
    ),
  };
}
export function scopedStore(store: Store, actor: User): Store {
  const company = companyStore(store);
  if (actor.role === "admin") return company;
  if (actor.role === "user")
    return { ...company, users: [], fanpages: [], posts: [], manualChecks: [] };
  const fanpages = company.fanpages.filter((page) =>
    page.employeeIds.includes(actor.id),
  );
  const ids = new Set(fanpages.map((page) => page.id));
  const posts = company.posts.filter((post) => ids.has(post.fanpageId));
  const manualChecks = company.manualChecks.filter((check) =>
    ids.has(check.fanpageId),
  );
  const people = new Set([
    actor.id,
    ...fanpages.flatMap((page) => page.employeeIds),
    ...posts.map((post) => post.employeeId),
    ...manualChecks.map((check) => check.employeeId),
  ]);
  return {
    ...company,
    fanpages,
    posts,
    manualChecks,
    users: company.users.filter((user) => people.has(user.id)),
  };
}
export function userProtectionError(
  target: Pick<User, "role"> | undefined,
  operation: "save" | "delete",
  nextRole?: User["role"],
) {
  if (target?.role !== "admin") return null;
  if (operation === "delete") return "Không thể xóa tài khoản Admin";
  if (nextRole !== "admin") return "Không thể hạ quyền tài khoản Admin";
  return null;
}
