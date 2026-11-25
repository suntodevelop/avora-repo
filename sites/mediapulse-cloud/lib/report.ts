import { engagement } from "./time";
import type { Store, Snapshot } from "./types";
export function filteredPosts(
  store: Pick<Store, "posts">,
  params: URLSearchParams,
) {
  const from = params.get("from");
  const to = params.get("to");
  const employee = params.get("employee");
  const page = params.get("page");
  return store.posts.filter(
    (p) =>
      (!from || p.postDate >= from) &&
      (!to || p.postDate <= to) &&
      (!employee || p.employeeId === employee) &&
      (!page || p.fanpageId === page),
  );
}
export function employeeReport(
  store: Pick<Snapshot, "posts" | "users" | "fanpages">,
  params: URLSearchParams,
) {
  const posts = filteredPosts(store, params);
  return store.users
    .filter(
      (u) => u.role === "user" || posts.some((p) => p.employeeId === u.id),
    )
    .filter((u) => !params.get("employee") || u.id === params.get("employee"))
    .map((u) => {
      const own = posts.filter((p) => p.employeeId === u.id);
      return {
        id: u.id,
        name: u.name,
        pages: store.fanpages
          .filter((p) => p.employeeIds.includes(u.id))
          .map((p) => p.name)
          .join(", "),
        posts: own.length,
        likes: own.reduce((s, p) => s + p.likes, 0),
        comments: own.reduce((s, p) => s + p.comments, 0),
        shares: own.reduce((s, p) => s + p.shares, 0),
        total: own.reduce((s, p) => s + engagement(p), 0),
      };
    })
    .sort((a, b) => b.posts - a.posts || b.total - a.total);
}
