import type { ReactNode } from "react";
import type { FadeItem } from "./types.ts";

/** fade() に渡すオプション。 */
type FadeOptions = {
  /** 開始位置 (秒)。 */
  at: number;
  /** 表示する尺 (秒)。 */
  duration: number;
  /** フェードインの尺 (秒)。既定は 0 (フェードなし)。 */
  in?: number;
  /** フェードアウトの尺 (秒)。既定は 0 (フェードなし)。 */
  out?: number;
};

/**
 * node を at から duration 秒だけ表示し、in/out 秒でフェードイン/アウトする。
 * in + out が duration を超える指定は throw する。
 */
export const fade = (node: ReactNode, options: FadeOptions): FadeItem => {
  const { at, duration, in: fadeIn = 0, out: fadeOut = 0 } = options;

  if (fadeIn + fadeOut > duration) {
    throw new Error(
      `fade: in (${fadeIn}) + out (${fadeOut}) が duration (${duration}) を超えています`,
    );
  }

  return { kind: "fade", node, at, duration, in: fadeIn, out: fadeOut };
};
