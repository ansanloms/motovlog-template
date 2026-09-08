import type { Video } from "../effects/index.ts";

/** 環境変数未設定・空のときに読む project (ADR-0004)。 */
export const DEFAULT_PROJECT = "00000000-sample";

/** ADR-0002 の slug 形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case)。 */
export const PROJECT_SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** slug (未設定・空なら DEFAULT_PROJECT) を検証して返す。値は REMOTION_PROJECT か composition の props から来る。 */
export const resolveProjectSlug = (env: string | undefined): string => {
  if (!env) {
    return DEFAULT_PROJECT;
  }

  if (!PROJECT_SLUG_PATTERN.test(env)) {
    throw new Error(
      `project の slug の形式が不正です (YYYYMMDD-<name> の形にしてください): ${env}`,
    );
  }

  return env;
};

// default export が Video の形 (fps・width・height・durationSec が number、
// items が配列) かどうかだけを検査する (ADR-0010: zod schema は持たない)。
export const isVideo = (value: unknown): value is Video => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Video>;

  return (
    typeof candidate.fps === "number" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.durationSec === "number" &&
    Array.isArray(candidate.items)
  );
};

// projects/<slug>/timeline.ts を動的 import で読み、video() の戻り値
// (Video) を返す。ディレクトリ部分をリテラルで書いた import() でないと
// Rspack が解決できないため、テンプレートリテラルの形は変えないこと。
export const loadVideo = async (slug: string): Promise<Video> => {
  const resolved = resolveProjectSlug(slug);

  const timelineModule: { default: unknown } = await import(
    `../../projects/${resolved}/timeline.ts`
  );

  if (!isVideo(timelineModule.default)) {
    throw new Error(
      `project \`${resolved}\` の timeline.ts の default export が Video の形ではありません: projects/${resolved}/timeline.ts`,
    );
  }

  return timelineModule.default;
};
