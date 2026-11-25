import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createMockData } from "./mock";
import type { Store } from "./types";
export const isMock = () => (process.env.DATA_MODE || "mock") === "mock";
const globalDb = globalThis as unknown as {
  prisma?: PrismaClient;
  queue?: Promise<unknown>;
  initializing?: Promise<Store>;
};
export function prisma() {
  return (globalDb.prisma ||= new PrismaClient());
}
const file = path.join(process.cwd(), "data", "mock.json");
export async function readStore(): Promise<Store> {
  if (isMock()) {
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      return { ...data, manualChecks: data.manualChecks || [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!globalDb.initializing) {
        globalDb.initializing = (async () => {
          const data = createMockData();
          await saveStore(data);
          return data;
        })().finally(() => {
          globalDb.initializing = undefined;
        });
      }
      return globalDb.initializing;
    }
  }
  const [users, pages, posts, setting, manualChecks] = await Promise.all([
    prisma().user.findMany(),
    prisma().fanpage.findMany({ include: { employees: true } }),
    prisma().post.findMany(),
    prisma().setting.findUnique({ where: { id: "main" } }),
    prisma().manualCheck.findMany(),
  ]);
  return {
    users,
    manualChecks,
    fanpages: pages.map(({ employees, ...p }) => ({
      ...p,
      employeeIds: employees.map((e) => e.userId),
    })),
    posts: posts.map((p) => ({
      ...p,
      createdTime: p.createdTime.toISOString(),
    })),
    settings: {
      companyWide: setting?.companyWide ?? false,
      cronEnabled: setting?.cronEnabled ?? false,
    },
  } as Store;
}
async function saveStore(data: Store) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2));
  await rename(temp, file);
}
// Serialize local writes; PostgreSQL uses a transaction and an advisory lock across instances.
export async function mutateStore<T>(
  fn: (store: Store) => T | Promise<T>,
): Promise<T> {
  const operation = async () => {
    if (isMock()) {
      const store = await readStore();
      const result = await fn(store);
      await saveStore(store);
      return result;
    }
    return prisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(78219201)`;
        const [users, pages, posts, settings, manualChecks] = await Promise.all(
          [
            tx.user.findMany(),
            tx.fanpage.findMany({ include: { employees: true } }),
            tx.post.findMany(),
            tx.setting.findUnique({ where: { id: "main" } }),
            tx.manualCheck.findMany(),
          ],
        );
        const store = {
          users,
          manualChecks,
          fanpages: pages.map(({ employees, ...p }) => ({
            ...p,
            employeeIds: employees.map((e) => e.userId),
          })),
          posts: posts.map((p) => ({
            ...p,
            createdTime: p.createdTime.toISOString(),
          })),
          settings: {
            companyWide: settings?.companyWide ?? false,
            cronEnabled: settings?.cronEnabled ?? false,
          },
        } as Store;
        const result = await fn(store);
        await tx.manualCheck.deleteMany({
          where: { id: { notIn: store.manualChecks.map((check) => check.id) } },
        });
        await tx.post.deleteMany({
          where: { id: { notIn: store.posts.map((x) => x.id) } },
        });
        await tx.employeeFanpage.deleteMany();
        await tx.fanpage.deleteMany({
          where: { id: { notIn: store.fanpages.map((x) => x.id) } },
        });
        await tx.user.deleteMany({
          where: { id: { notIn: store.users.map((x) => x.id) } },
        });
        for (const user of store.users)
          await tx.user.upsert({
            where: { id: user.id },
            create: user,
            update: user,
          });
        for (const { employeeIds, ...page } of store.fanpages) {
          await tx.fanpage.upsert({
            where: { id: page.id },
            create: page,
            update: page,
          });
          for (const userId of employeeIds)
            await tx.employeeFanpage.create({
              data: { userId, fanpageId: page.id },
            });
        }
        for (const post of store.posts) {
          const data = { ...post, createdTime: new Date(post.createdTime) };
          await tx.post.upsert({
            where: { id: post.id },
            create: data,
            update: data,
          });
        }
        for (const check of store.manualChecks) {
          await tx.manualCheck.upsert({
            where: { id: check.id },
            create: check,
            update: check,
          });
        }
        await tx.setting.upsert({
          where: { id: "main" },
          create: { id: "main", ...store.settings },
          update: store.settings,
        });
        return result;
      },
      { timeout: 60000 },
    );
  };
  const promise = (globalDb.queue || Promise.resolve()).then(operation);
  globalDb.queue = promise.catch(() => undefined);
  return promise;
}
