import type { Store, Fanpage, Post } from "./types";
import { hashPassword } from "./crypto";
import { shiftDay, todayVN, vietnamTime } from "./time";
export function mockPosts(page: Fanpage): Post[] {
  const titles = [
    "Một chút cảm hứng cho ngày mới. Bạn đã sẵn sàng bắt đầu hành trình của mình? ✨",
    "Khám phá những góc phố quen mà lạ, cùng chúng mình lưu lại những khoảnh khắc đẹp.",
    "Chuyện hôm nay: những ý tưởng nhỏ tạo nên thay đổi lớn. Chia sẻ câu chuyện của bạn nhé!",
    "Cuối ngày cùng nhìn lại những điều thật đáng nhớ. Cảm ơn bạn đã luôn đồng hành 💚",
    "Bộ sưu tập mới đã có mặt! Điều gì khiến bạn ấn tượng nhất?",
    "Có hẹn với những trải nghiệm mới. Tag ngay người bạn muốn đi cùng!",
  ];
  return Array.from({ length: 42 }, (_, i) => {
    const n = Number(page.id.replace(/\D/g, "")) || 1;
    const date = shiftDay(todayVN(), -Math.floor(i / 3));
    const hour = [8, 12, 19][i % 3];
    const createdTime = new Date(
      `${date}T${String(hour).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00+07:00`,
    ).toISOString();
    return {
      id: `${page.pageId}_mock_${date}_${i % 3}`,
      fanpageId: page.id,
      employeeId: page.employeeIds[i % page.employeeIds.length] || null,
      message: titles[(i + n) % titles.length],
      createdTime,
      ...vietnamTime(createdTime),
      permalinkUrl: page.url,
      likes: 80 + ((i * 37 + n * 61) % 900),
      comments: 8 + ((i * 13 + n * 7) % 130),
      shares: 3 + ((i * 7 + n * 3) % 70),
      attribution: "mock",
      status: i % 9 === 0 ? "pending" : "approved",
      note: "",
    };
  });
}
export function createMockData(): Store {
  const users: Store["users"] = [
    {
      id: "admin",
      name: "Minh Anh",
      email: "admin@media.local",
      role: "admin",
      passwordHash: hashPassword("Demo@12345"),
    },
    ...["Nguyễn Minh Anh", "Trần Hoàng Nam", "Lê Thu Hà", "Phạm Đức Huy"].map(
      (name, i) => ({
        id: `user-${i + 1}`,
        name,
        email: `nv${i + 1}@media.local`,
        role: "staff" as const,
        passwordHash: hashPassword("Demo@12345"),
      }),
    ),
  ];
  const fanpages: Fanpage[] = [
    "Sài Gòn Có Gì Vui?",
    "Ăn Sập Sài Gòn",
    "Chuyện Của Phố",
    "Đi Đâu Cũng Được",
    "Nhà Mình Có Gì",
    "The Daily Studio",
  ].map((name, i) => ({
    id: `page-${i + 1}`,
    name,
    pageId: `10000000000${i + 1}`,
    url: `https://www.facebook.com/10000000000${i + 1}`,
    source: "mock",
    tokenEncrypted: "",
    lastSync: new Date().toISOString(),
    employeeIds: [`user-${(i % 4) + 1}`, ...(i === 0 ? ["user-2"] : [])],
  }));
  return {
    users,
    fanpages,
    posts: fanpages.flatMap(mockPosts),
    manualChecks: [],
    settings: { companyWide: false, cronEnabled: false },
  };
}
