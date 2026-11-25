import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { mutateStore, isMock } from "../src/lib/db";
import { importAvora, type SourceWorkbook } from "../src/lib/import-avora";
async function main() {
  const input = process.argv[2] || "data/import/avora-workbook.json";
  const source: SourceWorkbook = JSON.parse(await readFile(input, "utf8"));
  if (isMock()) {
    await mkdir("data/backups", { recursive: true });
    try {
      await copyFile(
        "data/mock.json",
        `data/backups/before-avora-${Date.now()}.json`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const result = await mutateStore((store) => importAvora(store, source));
  await writeFile(
    "data/import/avora-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
