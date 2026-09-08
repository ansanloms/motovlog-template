import type { Item } from "./types.ts";

/** clip() に渡すオプション。 */
type ClipOptions = {
  /** 映像素材の URL (staticFile() 済み)。 */
  src: string;
  /** 再生する尺 (秒)。 */
  duration: number;
  /** 開始位置 (秒)。省略時は video() が直前の clip の終端 (最初は 0) に解決する。 */
  at?: number;
  /** 元動画の頭を捨てる秒数。既定は 0。 */
  trimBefore?: number;
};

/**
 * 走行映像のクリップを 1 本並べる (ADR-0003 の `<Video>`)。`at` を省略すると
 * `video()` が直前の clip の終端 (最初は 0) に連結する。
 */
export const clip = (options: ClipOptions): Extract<Item, { kind: "clip" }> => {
  const { src, duration, at, trimBefore = 0 } = options;

  return { kind: "clip", src, duration, trimBefore, at };
};
