export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  passwordHash: string;
  facebookUserId?: string | null;
};
export type Fanpage = {
  id: string;
  name: string;
  pageId: string;
  url: string;
  tokenEncrypted: string;
  source: "mock" | "facebook";
  lastSync: string | null;
  employeeIds: string[];
};
export type Post = {
  id: string;
  fanpageId: string;
  employeeId: string | null;
  message: string;
  createdTime: string;
  postDate: string;
  postHour: number;
  permalinkUrl: string;
  likes: number;
  comments: number;
  shares: number;
  attribution: string;
  status: "pending" | "approved" | "flagged";
  note: string;
};
export type Store = {
  users: User[];
  fanpages: Fanpage[];
  posts: Post[];
  settings: { companyWide: boolean; cronEnabled: boolean };
};
export type PublicUser = Omit<User, "passwordHash">;
export type Snapshot = {
  viewer: PublicUser;
  users: PublicUser[];
  fanpages: Omit<Fanpage, "tokenEncrypted">[];
  posts: Post[];
  settings: Store["settings"];
  mode: string;
};
