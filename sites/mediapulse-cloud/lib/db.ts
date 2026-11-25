import { env } from "cloudflare:workers";
import { createMockData } from "./mock";
import type { Store } from "./types";
// Hosted data lives in D1. Revision checks prevent lost writes across instances.
export const isMock = () => true;
function database() {
  if (!env.DB) throw new Error("D1 database is not configured");
  return env.DB;
}
type Row = { payload: string; revision: number };
async function row(): Promise<Row> {
  const db = database();
  let current = await db
    .prepare("SELECT payload, revision FROM workspace_state WHERE id = 'main'")
    .first<Row>();
  if (!current) {
    const data = createMockData();
    await db
      .prepare(
        "INSERT OR IGNORE INTO workspace_state (id, payload, revision) VALUES ('main', ?, 0)",
      )
      .bind(JSON.stringify(data))
      .run();
    current = await db
      .prepare(
        "SELECT payload, revision FROM workspace_state WHERE id = 'main'",
      )
      .first<Row>();
  }
  if (!current) throw new Error("Workspace initialization failed");
  return current;
}
export async function readStore(): Promise<Store> {
  return JSON.parse((await row()).payload);
}
export async function mutateStore<T>(
  fn: (store: Store) => T | Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await row();
    const data: Store = JSON.parse(current.payload);
    const result = await fn(data);
    const update = await database()
      .prepare(
        "UPDATE workspace_state SET payload = ?, revision = revision + 1 WHERE id = 'main' AND revision = ?",
      )
      .bind(JSON.stringify(data), current.revision)
      .run();
    if (update.meta.changes === 1) return result;
  }
  throw new Error(
    "Dữ liệu vừa được cập nhật bởi người khác. Vui lòng thử lại.",
  );
}
