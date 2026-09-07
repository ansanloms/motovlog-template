// projects/<slug>/timeline.ts の meta.fps を stdout に数値だけ出力する。
// make-proxy.sh がプロキシの fps を composition に合わせるために使う
// (ADR-0003)。npx tsx scripts/timeline-fps.ts <slug> の形で呼ぶ。

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { timelineSchema } from "../src/timeline/schema";

// ADR-0002 の slug 形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case)。
const SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

const main = async () => {
  const slug = process.argv[2];

  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: ${slug ?? "(未指定)"}`,
    );
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const timelinePath = path.join(
    scriptDir,
    "..",
    "projects",
    slug,
    "timeline.ts",
  );

  const timelineModule = await import(pathToFileURL(timelinePath).href);
  const timeline = timelineSchema.parse(timelineModule.default);

  process.stdout.write(`${timeline.meta.fps}\n`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exit(1);
});
