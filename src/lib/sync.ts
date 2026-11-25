import { mutateStore, readStore } from "./db";
import { decryptToken } from "./crypto";
import { fetchPosts } from "./facebook";
import { mockPosts } from "./mock";
import { todayVN, syncWindow } from "./time";
import type { Store, Fanpage, Post } from "./types";
export async function syncPages(
  pageId?: string,
  date = todayVN(),
  employeeId?: string,
) {
  syncWindow(date);
  const initial = await readStore();
  const hasReal = initial.fanpages.some((p) => p.source !== "mock");
  const pages = initial.fanpages.filter(
    (p) =>
      (!pageId || p.id === pageId) &&
      (!employeeId || p.employeeIds.includes(employeeId)) &&
      (pageId || !hasReal || p.source !== "mock"),
  );
  if (pageId && !pages.length) throw new Error("Không tìm thấy Fanpage");
  const results: {
    page: string;
    pageId: string;
    date: string;
    status: "success" | "skipped" | "error";
    count: number;
    success: boolean;
    error?: string;
  }[] = [];
  for (const page of pages) {
    try {
      if (page.source === "manual") {
        results.push({
          page: page.name,
          pageId: page.id,
          date,
          count: 0,
          success: false,
          status: "skipped",
          error: "Đang theo dõi thủ công; thêm token để đồng bộ Facebook.",
        });
        continue;
      }
      const incoming =
        page.source === "mock"
          ? mockPosts(page).filter((p) => p.postDate === date)
          : await fetchPosts(
              page,
              decryptToken(page.tokenEncrypted),
              initial.users,
              date,
            );
      await mutateStore((store) => applyDailySync(store, page, incoming, date));
      results.push({
        page: page.name,
        pageId: page.id,
        date,
        count: incoming.length,
        success: true,
        status: "success",
      });
    } catch (error) {
      results.push({
        page: page.name,
        pageId: page.id,
        date,
        count: 0,
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Đồng bộ thất bại",
      });
    }
  }
  return results;
}

// Commit only after all Facebook pagination has completed successfully.
export function applyDailySync(
  store: Store,
  page: Fanpage,
  incoming: Post[],
  date: string,
) {
  const current = store.fanpages.find((p) => p.id === page.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(page))
    throw new Error("Cấu hình Page đã thay đổi, hãy đồng bộ lại");
  if (incoming.some((p) => p.fanpageId !== page.id || p.postDate !== date))
    throw new Error("Dữ liệu ngoài ngày đồng bộ");
  const oldPosts = new Map(store.posts.map((p) => [p.id, p]));
  const incomingIds = new Set(incoming.map((p) => p.id));
  const map = new Map(
    store.posts
      .filter(
        (p) =>
          p.fanpageId !== page.id ||
          p.postDate !== date ||
          incomingIds.has(p.id),
      )
      .map((p) => [p.id, p]),
  );
  for (const post of incoming) {
    const old = oldPosts.get(post.id);
    map.set(post.id, {
      ...post,
      status: old?.status || post.status,
      note: old?.note || "",
      ...(old?.attribution === "manual"
        ? { employeeId: old.employeeId, attribution: "manual" }
        : {}),
    });
  }
  store.posts = [...map.values()];
  current.fullSync =
    current.fullSync ??
    (!!current.lastSync && current.syncedDates === undefined);
  current.syncedDates = [
    ...new Set([...(current.syncedDates || []), date]),
  ].sort();
  current.lastSync = new Date().toISOString();
}
