import type { ReactNode } from "react";
import type { FadeItem, Placement } from "./types.ts";

/** fade() に渡すオプション。 */
type FadeOptions = Placement & {
  /** 表示する尺 (秒)。 */
  duration: number;
  /** フェードインの尺 (秒)。既定は 0 (フェードなし)。 */
  in?: number;
  /** フェードアウトの尺 (秒)。既定は 0 (フェードなし)。 */
  out?: number;
};

/**
 * node を duration 秒だけ表示し、in/out 秒でフェードイン/アウトする。
 * `at`/`after` を省略すると同じ layer の直前の item の終端に連結する。
 * `at` と `after` の同時指定は型エラーになる (実行時の検査は
 * timeline() の resolveLayer で行う)。in + out が duration を超える指定は
 * throw する。
 */
export const fade = (node: ReactNode, options: FadeOptions): FadeItem => {
  const { at, after, duration, in: fadeIn = 0, out: fadeOut = 0 } = options;

  if (!Number.isFinite(fadeIn) || fadeIn < 0) {
    throw new Error(`fade: in が不正です (${fadeIn})`);
  }

  if (!Number.isFinite(fadeOut) || fadeOut < 0) {
    throw new Error(`fade: out が不正です (${fadeOut})`);
  }

  if (fadeIn + fadeOut > duration) {
    throw new Error(
      `fade: in (${fadeIn}) + out (${fadeOut}) が duration (${duration}) を超えています`,
    );
  }

  return {
    kind: "fade",
    node,
    at,
    after,
    duration,
    in: fadeIn,
    out: fadeOut,
  } as FadeItem;
};
