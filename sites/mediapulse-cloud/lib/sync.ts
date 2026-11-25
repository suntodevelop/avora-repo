import { mutateStore, readStore } from "./db";
import { decryptToken } from "./crypto";
import { fetchPosts } from "./facebook";
import { mockPosts } from "./mock";
export async function syncPages(pageId?: string) {
  const initial = await readStore();
  const pages = initial.fanpages.filter((p) => !pageId || p.id === pageId);
  if (pageId && !pages.length) throw new Error("Không tìm thấy Fanpage");
  const results: {
    page: string;
    count: number;
    success: boolean;
    error?: string;
  }[] = [];
  for (const page of pages) {
    try {
      const incoming =
        page.source === "mock"
          ? mockPosts(page)
          : await fetchPosts(
              page,
              decryptToken(page.tokenEncrypted),
              initial.users,
            );
      await mutateStore((store) => {
        const current = store.fanpages.find((p) => p.id === page.id);
        if (!current) throw new Error("Fanpage đã bị xóa");
        if (JSON.stringify(current) !== JSON.stringify(page))
          throw new Error("Cấu hình Page đã thay đổi, hãy đồng bộ lại");
        const map = new Map(store.posts.map((p) => [p.id, p]));
        for (const post of incoming) {
          const old = map.get(post.id);
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
        current.lastSync = new Date().toISOString();
      });
      results.push({ page: page.name, count: incoming.length, success: true });
    } catch (error) {
      results.push({
        page: page.name,
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : "Đồng bộ thất bại",
      });
    }
  }
  return results;
}
