import type { ReactNode } from "react";
import type { SampleNode } from "./sample.ts";
import type { FadeItem, FrameMarker, Placement, Span } from "./types.ts";

/** fade() に渡すオプション。 */
type FadeOptions = Placement &
  Span & {
    /** フェードインの尺 (秒)。既定は 0 (フェードなし)。 */
    in?: number;
    /** フェードアウトの尺 (秒)。既定は 0 (フェードなし)。 */
    out?: number;
  };

/**
 * node を duration 秒 (または until で求めた尺) だけ表示し、in/out 秒で
 * フェードイン/アウトする。`at`/`after` を省略すると同じ layer の直前の
 * item の終端に連結する。`at` と `after` の同時指定、`duration` と
 * `until` の同時指定は throw する (at/after は型エラーにもなる。実行時の
 * 検査は timeline() の resolveLayer で行う)。in + out が duration を超える
 * 指定は throw する。until 指定の
 * item は duration がここでは決まらないため、この検査は timeline() の
 * resolveLayer が開始位置と until を解決した後に行う。node には frame()
 * (FrameMarker、合成結果への効果) や sample() (SampleNode、Stage が
 * 毎フレーム render を呼ぶ) も渡せる。
 */
export const fade = (
  node: ReactNode | FrameMarker | SampleNode,
  options: FadeOptions,
): FadeItem => {
  const {
    at,
    after,
    duration,
    until,
    in: fadeIn = 0,
    out: fadeOut = 0,
  } = options;

  if (duration !== undefined && until !== undefined) {
    throw new Error("fade: duration と until は同時に指定できません");
  }

  if (!Number.isFinite(fadeIn) || fadeIn < 0) {
    throw new Error(`fade: in が不正です (${fadeIn})`);
  }

  if (!Number.isFinite(fadeOut) || fadeOut < 0) {
    throw new Error(`fade: out が不正です (${fadeOut})`);
  }

  if (duration !== undefined && fadeIn + fadeOut > duration) {
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
    until,
    in: fadeIn,
    out: fadeOut,
  } as FadeItem;
};
