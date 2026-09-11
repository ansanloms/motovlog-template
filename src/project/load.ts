import { getSetup } from "../setup.ts";
import type { Timeline } from "../effects/index.ts";

/** ADR-0002 の slug 形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case)。 */
export const PROJECT_SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * slug を検証して返す。未設定・空なら利用側が configure() で渡した
 * defaultProject を返す (ADR-0012)。値は REMOTION_PROJECT か composition の
 * props から来る。
 */
export const resolveProjectSlug = (env: string | undefined): string => {
  if (!env) {
    return getSetup().defaultProject;
  }

  if (!PROJECT_SLUG_PATTERN.test(env)) {
    throw new Error(
      `project の slug の形式が不正です (YYYYMMDD-<name> の形にしてください): ${env}`,
    );
  }

  return env;
};

// default export が Timeline の形 (fps・width・height・durationSec が
// number、layers が配列の配列、各 item は kind が fade/cut で at・duration
// (fade は in・out も) が有限の number) かどうかだけを検査する
// (ADR-0006: zod schema は持たない)。
export const isTimeline = (value: unknown): value is Timeline => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Timeline>;

  return (
    typeof candidate.fps === "number" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    typeof candidate.durationSec === "number" &&
    Array.isArray(candidate.layers) &&
    candidate.layers.every(
      (layer) =>
        Array.isArray(layer) &&
        layer.every((item) => {
          if (typeof item !== "object" || item === null) {
            return false;
          }

          const {
            kind,
            at,
            duration,
            in: fadeIn,
            out,
          } = item as {
            kind?: unknown;
            at?: unknown;
            duration?: unknown;
            in?: unknown;
            out?: unknown;
          };

          if (!Number.isFinite(at) || !Number.isFinite(duration)) {
            return false;
          }

          if (kind === "fade") {
            return Number.isFinite(fadeIn) && Number.isFinite(out);
          }

          return kind === "cut";
        }),
    )
  );
};

// projects/<slug>/timeline.ts を読み、timeline() の戻り値 (Timeline) を返す。
// 実際の読み込みは利用側が configure() で渡した loadTimeline() が行う
// (ADR-0012)。lib は default export が Timeline の形かどうかだけを検査する。
export const loadTimeline = async (slug: string): Promise<Timeline> => {
  const resolved = resolveProjectSlug(slug);

  const timelineModule = await getSetup().loadTimeline(resolved);

  if (!isTimeline(timelineModule.default)) {
    throw new Error(
      `project \`${resolved}\` の timeline.ts の default export が Timeline の形ではありません: projects/${resolved}/timeline.ts`,
    );
  }

  return timelineModule.default;
};
