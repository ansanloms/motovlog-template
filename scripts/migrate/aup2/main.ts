// AviUtl ExEdit2 の project ファイル (.aup2) を projects/<slug>/timeline.ts に
// 写す一回限りの変換スクリプト (#5)。
//
//   tsx scripts/migrate/aup2/main.ts <movie.aup2> <slug> [オプション]
//
// 素材の変換 (npm run convert) と発話の音声生成 (tsx scripts/voice.ts) は
// 既存のスクリプトが行う。ここは timeline.ts を書くだけで、終了時に残りの
// 手順を案内する。詳細は scripts/migrate/README.md。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bandTiming,
  chapterTitleDurationSec,
  endingTiming,
  fps,
  openingTiming,
} from "../../../src/theme/timing.ts";
import { emitTimeline, formatTimeline } from "./emit.ts";
import { parseAup2 } from "./parse.ts";
import { planTimeline } from "./plan.ts";
import type { ProjectMeta } from "./plan.ts";

const USAGE = [
  "usage: tsx scripts/migrate/aup2/main.ts <movie.aup2> <slug> [オプション]",
  "",
  "  --out <path>         出力先 (既定 projects/<slug>/timeline.ts)",
  "  --meta <path>        project ごとの値 (既定 scripts/migrate/aup2/<slug の名前部分>.json)",
  "  --expressions <path> 表情の対応表 (既定 scripts/migrate/aup2/expressions.json)",
  "  --character <name>   立ち絵のキャラクター (既定 ryusei、characters/<name>.ts)",
].join("\n");

/** ADR-0002 の slug 形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case)。 */
const PROJECT_SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** main.ts の CLI 引数。 */
type Args = {
  readonly input: string;
  readonly slug: string;
  readonly out?: string;
  readonly meta?: string;
  readonly expressions?: string;
  readonly character?: string;
};

/** 引数を解釈する。--help なら null を返す (呼び出し側が usage を出す)。 */
export const parseArgs = (argv: readonly string[]): Args | null => {
  if (argv.some((arg) => arg === "--help" || arg === "-h")) {
    return null;
  }

  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const name = arg.slice(2);

    if (!["out", "meta", "expressions", "character"].includes(name)) {
      throw new Error(`不明なオプションです: ${arg}`);
    }

    const value = argv[i + 1];

    if (value === undefined) {
      throw new Error(`${arg} に値がありません`);
    }

    options[name] = value;
    i++;
  }

  const [input, slug] = positional;

  if (!input || !slug) {
    throw new Error(USAGE);
  }

  if (!PROJECT_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: ${slug}`,
    );
  }

  return { input, slug, ...options };
};

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const readJson = (file: string): unknown =>
  JSON.parse(fs.readFileSync(file, "utf8")) as unknown;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `<name>.json` が ProjectMeta の形かを検査する。値が欠けたまま流すと生成物
 * が `title: undefined` のような型エラーになり、原因が分かりにくいため、
 * 読み込んだ時点でファイル名付きで throw する。
 */
export const assertProjectMeta: (
  value: unknown,
  file: string,
) => asserts value is ProjectMeta = (value, file) => {
  const fail = (what: string): never => {
    throw new Error(`${file}: ${what}`);
  };

  if (!isRecord(value)) {
    fail("JSON のオブジェクトではありません");
    return;
  }

  for (const key of ["title", "subtitle"]) {
    if (typeof value[key] !== "string") {
      fail(`${key} が文字列ではありません`);
    }
  }

  const date = value.date;

  if (
    !isRecord(date) ||
    typeof date.from !== "string" ||
    typeof date.to !== "string"
  ) {
    fail("date が { from, to } (文字列) ではありません");
  }

  if (typeof value.distance !== "number") {
    fail("distance が数値ではありません");
  }

  const ridingTime = value.ridingTime;

  if (
    !isRecord(ridingTime) ||
    typeof ridingTime.hours !== "number" ||
    typeof ridingTime.minutes !== "number"
  ) {
    fail("ridingTime が { hours, minutes } (数値) ではありません");
  }

  if (
    !Array.isArray(value.routes) ||
    value.routes.some((route) => typeof route !== "string")
  ) {
    fail("routes が文字列の配列ではありません");
  }

  if (
    !Array.isArray(value.chapters) ||
    value.chapters.some(
      (chapter) =>
        !isRecord(chapter) ||
        typeof chapter.title !== "string" ||
        typeof chapter.subtitle !== "string",
    )
  ) {
    fail("chapters が { title, subtitle } の配列ではありません");
  }

  const thumbnail = value.thumbnail;

  if (
    !isRecord(thumbnail) ||
    typeof thumbnail.photo !== "string" ||
    typeof thumbnail.badge !== "string"
  ) {
    fail("thumbnail が { photo, badge } (文字列) ではありません");
  }
};

/** `expressions.json` が「文字列 → 文字列」の表かを検査する。 */
export const assertExpressions: (
  value: unknown,
  file: string,
) => asserts value is Record<string, string> = (value, file) => {
  if (
    !isRecord(value) ||
    Object.values(value).some((v) => typeof v !== "string")
  ) {
    throw new Error(
      `${file}: 文字列を値に持つ JSON のオブジェクトではありません`,
    );
  }
};

/** 読み込み → 計画 → 書き出し。argv は実行ファイル以降の引数。 */
export const run = async (argv: readonly string[]): Promise<void> => {
  const args = parseArgs(argv);

  if (args === null) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const character = args.character ?? "ryusei";
  const metaFile =
    args.meta ?? path.join(here, `${args.slug.replace(/^[0-9]{8}-/, "")}.json`);
  const expressionsFile =
    args.expressions ?? path.join(here, "expressions.json");
  const outFile =
    args.out ?? path.join(repoRoot, "projects", args.slug, "timeline.ts");

  const project = readJson(metaFile);
  const expressions = readJson(expressionsFile);

  assertProjectMeta(project, metaFile);
  assertExpressions(expressions, expressionsFile);

  const plan = planTimeline(parseAup2(fs.readFileSync(args.input, "utf8")), {
    slug: args.slug,
    character,
    project,
    expressions,
    timing: {
      fps,
      openingDurationSec: openingTiming.duration,
      openingFadeInSec: openingTiming.fadeIn,
      chapterTitleDurationSec,
      endingDurationSec: endingTiming.duration,
      narrationRunGapSec: bandTiming.silenceGap,
    },
  });

  for (const warning of plan.warnings) {
    process.stderr.write(`warn: ${warning}\n`);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    await formatTimeline(emitTimeline(plan), outFile),
    "utf8",
  );

  const relative = path.relative(repoRoot, outFile);

  process.stdout.write(`write: ${relative}\n`);
  process.stdout.write(
    [
      `走行映像 ${plan.videos.length} 本、写真紹介 ${
        plan.scenes.filter((scene) => scene.kind === "photo").length
      } 件、`,
      `章 ${plan.scenes.filter((scene) => scene.kind === "chapter").length} 本、`,
      `立ち絵 ${plan.figures.length} 区間、発話 ${
        plan.narration.filter((item) => item.kind === "line").length
      } 本\n`,
    ].join(""),
  );

  if (plan.skipped.length > 0) {
    // 同じ理由で落としたオブジェクトは 1 行にまとめる (PSDToolKit の配線の
    // ように 50 件並ぶものがあるため)。
    const byReason = new Map<string, number[]>();

    for (const item of plan.skipped) {
      byReason.set(item.reason, [
        ...(byReason.get(item.reason) ?? []),
        item.id,
      ]);
    }

    process.stdout.write("写さなかったオブジェクト:\n");

    for (const [reason, ids] of byReason) {
      const list = ids.length > 6 ? `${ids.length} 件` : ids.join("・");

      process.stdout.write(`  [${list}] ${reason}\n`);
    }
  }

  process.stdout.write(
    [
      "",
      "次の手順 (素材の変換と音声生成は既存のスクリプトが行う):",
      `  npm run convert -- ${args.slug} <走行映像のファイル>...`,
      `  cp <写真> public/projects/${args.slug}/photos/`,
      `  tsx scripts/voice.ts ${args.slug}`,
      `  .env の REMOTION_PROJECT を ${args.slug} にする (Remotion CLI は .env をシェルの環境変数より優先する)`,
      "  npx remotion render Motovlog",
      "",
    ].join("\n"),
  );
};

// tsx で直接実行されたときだけ CLI として動く (テストからの import では動かない)。
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(`error: ${message}\n`);
    process.exitCode = 1;
  });
}
