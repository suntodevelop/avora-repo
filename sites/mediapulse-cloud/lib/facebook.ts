import { vietnamTime } from "./time";
import type { Fanpage, Post, User } from "./types";
export function parsePageInput(input: string): string {
  const value = input.trim();
  if (/^[a-zA-Z0-9.]+$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("Link Fanpage không hợp lệ");
  }
  if (
    ![
      "facebook.com",
      "www.facebook.com",
      "m.facebook.com",
      "web.facebook.com",
    ].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error("Chỉ chấp nhận link facebook.com");
  const segments = url.pathname.split("/").filter(Boolean);
  const id =
    segments[0] === "profile.php"
      ? url.searchParams.get("id")
      : segments[0] === "pages"
        ? segments.at(-1)
        : segments[0];
  if (
    !id ||
    !/^[a-zA-Z0-9.]+$/.test(id) ||
    ["posts", "reel", "watch", "share", "groups"].includes(id)
  )
    throw new Error(
      "Nhập Page ID hoặc link trang cụ thể, không dùng link trang chủ/bài viết",
    );
  return id;
}
export class GraphError extends Error {
  constructor(
    message: string,
    public code?: number,
    public transient = false,
  ) {
    super(message);
  }
}
export async function graph<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const version = process.env.FACEBOOK_GRAPH_VERSION || "v27.0";
  if (!/^v\d+\.0$/.test(version))
    throw new Error("FACEBOOK_GRAPH_VERSION không hợp lệ");
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const json = (await response.json()) as {
      error?: { code?: number; is_transient?: boolean };
    };
    if (!response.ok || json.error) {
      const code = json.error?.code;
      if (
        (response.status === 429 ||
          response.status >= 500 ||
          json.error?.is_transient) &&
        attempt < 2
      ) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      throw new GraphError(
        `Facebook không cho phép truy cập (mã ${code || response.status}). Kiểm tra token, quyền Page và phiên bản API.`,
        code,
        json.error?.is_transient,
      );
    }
    return json as T;
  }
  throw new Error("Không thể kết nối Facebook");
}
export async function resolvePage(input: string, token: string) {
  return graph<{ id: string; name: string }>(parsePageInput(input), token, {
    fields: "id,name",
  });
}
type GraphPost = {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  admin_creator?: { id: string };
};
export function normalizePost(
  item: GraphPost,
  page: Fanpage,
  users: User[],
): Post {
  const creator = item.admin_creator?.id
    ? users.find((u) => u.facebookUserId === item.admin_creator?.id)
    : undefined;
  // Multiple assignees are ambiguous: leave unassigned rather than double-counting a post.
  const employeeId =
    creator?.id || (page.employeeIds.length === 1 ? page.employeeIds[0] : null);
  return {
    id: item.id,
    fanpageId: page.id,
    employeeId,
    message: item.message || "(Bài viết không có văn bản)",
    createdTime: new Date(item.created_time).toISOString(),
    ...vietnamTime(item.created_time),
    permalinkUrl: item.permalink_url || `https://www.facebook.com/${item.id}`,
    likes: item.likes?.summary?.total_count || 0,
    comments: item.comments?.summary?.total_count || 0,
    shares: item.shares?.count || 0,
    attribution: creator
      ? "admin_creator"
      : employeeId
        ? "page_assignment"
        : "unassigned",
    status: "pending",
    note: "",
  };
}
export async function fetchPosts(page: Fanpage, token: string, users: User[]) {
  let withCreator = true;
  let after = "";
  const posts: Post[] = [];
  const cursors = new Set<string>();
  for (let batch = 0; batch < 200; batch++) {
    const fields = `id,message,created_time,permalink_url,likes.limit(0).summary(true),comments.limit(0).summary(true),shares${withCreator ? ",admin_creator" : ""}`;
    let result: {
      data: GraphPost[];
      paging?: { next?: string; cursors?: { after?: string } };
    };
    try {
      result = await graph(`${page.pageId}/posts`, token, {
        fields,
        limit: "100",
        ...(after ? { after } : {}),
      });
    } catch (error) {
      if (
        withCreator &&
        error instanceof GraphError &&
        [100, 10, 200].includes(error.code || 0)
      ) {
        withCreator = false;
        batch--;
        continue;
      }
      throw error;
    }
    posts.push(...result.data.map((p) => normalizePost(p, page, users)));
    if (!result.paging?.next) return posts;
    after = result.paging.cursors?.after || "";
    if (!after || cursors.has(after))
      throw new Error("Con trỏ phân trang Facebook không hợp lệ");
    cursors.add(after);
  }
  throw new Error(
    "Page có trên 20.000 bài: cần bổ sung đồng bộ theo khoảng ngày",
  );
}
