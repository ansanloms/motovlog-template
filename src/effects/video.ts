import type { Item, ResolvedItem, Video } from "./types.ts";

/** video() の幅の既定値 (px)。 */
export const DEFAULT_WIDTH = 1920;

/** video() の高さの既定値 (px)。 */
export const DEFAULT_HEIGHT = 1080;

/** video() に渡すオプション。 */
type VideoOptions = {
  /** composition のフレームレート。ADR-0003 の不変条件: 素材の fps と一致させる。 */
  fps: number;
  /** 幅 (px)。既定は DEFAULT_WIDTH。 */
  width?: number;
  /** 高さ (px)。既定は DEFAULT_HEIGHT。 */
  height?: number;
};

/**
 * timeline.ts のアイテム列から Video を組み立てる。clip の `at` を省略すると
 * 直前の clip の終端 (最初は 0) に連結する。durationSec は全アイテムの
 * `at + duration` の最大値。items が空なら throw する。
 */
export const video = (options: VideoOptions, items: readonly Item[]): Video => {
  const { fps, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;

  if (items.length === 0) {
    throw new Error("video: items が空です");
  }

  let clipEnd = 0;
  const resolved: ResolvedItem[] = items.map((item) => {
    if (item.kind !== "clip") {
      return item;
    }

    const at = item.at ?? clipEnd;
    clipEnd = at + item.duration;

    return { ...item, at };
  });

  const durationSec = Math.max(
    ...resolved.map((item) => item.at + item.duration),
  );

  return { fps, width, height, durationSec, items: resolved };
};
