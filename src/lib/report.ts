import { engagement, dateSynced } from "./time";
import type { Store, Snapshot, ManualCheck } from "./types";
import { matchesSearch } from "./ui-data";

type ReportData = Pick<Snapshot, "posts" | "users" | "fanpages"> & {
  manualChecks?: ManualCheck[];
};
export function filteredPosts(
  store: Pick<Store, "posts"> & Partial<Pick<Snapshot, "fanpages" | "users">>,
  params: URLSearchParams,
) {
  return store.posts.filter((post) => {
    const page = store.fanpages?.find((page) => page.id === post.fanpageId);
    const user = store.users?.find((user) => user.id === post.employeeId);
    return (
      matches(post.postDate, post.employeeId, post.fanpageId, params) &&
      matchesSearch(
        [
          post.message,
          post.note,
          page?.name,
          page?.managerFacebookName,
          page?.topic,
          user?.name,
        ]
          .filter(Boolean)
          .join(" "),
        params.get("q") || "",
      )
    );
  });
}
function matches(
  date: string,
  employeeId: string | null,
  pageId: string,
  params: URLSearchParams,
) {
  const from = params.get("from"),
    to = params.get("to");
  return (
    (!from || date >= from) &&
    (!to || date <= to) &&
    (!params.get("employee") || employeeId === params.get("employee")) &&
    (!params.get("page") || pageId === params.get("page"))
  );
}
export function filteredChecks(
  store: Pick<Snapshot, "fanpages"> &
    Partial<Pick<Snapshot, "users">> & { manualChecks?: ManualCheck[] },
  params: URLSearchParams,
) {
  return (store.manualChecks || []).filter((check) => {
    const page = store.fanpages.find((page) => page.id === check.fanpageId);
    // A complete Facebook sync supersedes the imported Page totals. Keep the
    // source checks for provenance, but do not count them a second time.
    return (
      page &&
      !(page.source === "facebook" && dateSynced(page, check.date)) &&
      matches(check.date, check.employeeId, check.fanpageId, params) &&
      matchesSearch(
        [
          page.name,
          page.managerFacebookName,
          page.topic,
          page.trackingStatus,
          check.note,
          store.users?.find((user) => user.id === check.employeeId)?.name,
        ]
          .filter(Boolean)
          .join(" "),
        params.get("q") || "",
      )
    );
  });
}
export function employeeReport(store: ReportData, params: URLSearchParams) {
  const posts = filteredPosts(store, params),
    checks = filteredChecks(store, params);
  const employees = store.users.filter(
    (user) =>
      store.fanpages.some((page) => page.employeeIds.includes(user.id)) ||
      posts.some((post) => post.employeeId === user.id) ||
      checks.some((check) => check.employeeId === user.id),
  );
  const people = employees.map((user) => ({ id: user.id, name: user.name }));
  if (
    posts.some((post) => !post.employeeId) ||
    checks.some((check) => !check.employeeId)
  )
    people.push({ id: "__unassigned__", name: "Chưa phân công" });
  return people
    .filter(
      (user) => !params.get("employee") || user.id === params.get("employee"),
    )
    .map((user) => {
      const own = posts.filter(
        (post) => (post.employeeId || "__unassigned__") === user.id,
      );
      const manual = checks.filter(
        (check) => (check.employeeId || "__unassigned__") === user.id,
      );
      const manualPosts = manual.reduce(
        (sum, check) => sum + (check.postCount ?? 0),
        0,
      );
      return {
        id: user.id,
        name: user.name,
        pages: store.fanpages
          .filter((page) => page.employeeIds.includes(user.id))
          .map((page) => page.name)
          .join(", "),
        posts: own.length + manualPosts,
        manualPosts,
        detailedPosts: own.length,
        missingCounts: manual.filter((check) => check.postCount === null)
          .length,
        likes: own.reduce((sum, post) => sum + post.likes, 0),
        comments: own.reduce((sum, post) => sum + post.comments, 0),
        shares: own.reduce((sum, post) => sum + post.shares, 0),
        total: own.reduce((sum, post) => sum + engagement(post), 0),
        metricsKnown: own.length > 0,
        likesKnown:
          own.length > 0 && own.every((p) => p.likesAvailable !== false),
        commentsKnown:
          own.length > 0 && own.every((p) => p.commentsAvailable !== false),
        hasCounts:
          own.length > 0 ||
          manual.some((check) => check.postCount !== null) ||
          store.fanpages.some(
            (page) =>
              page.employeeIds.includes(user.id) &&
              (!params.get("page") || params.get("page") === page.id) &&
              page.source === "facebook" &&
              !!params.get("from") &&
              params.get("from") === params.get("to") &&
              dateSynced(page, params.get("from")!),
          ),
      };
    })
    .sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name, "vi"));
}
