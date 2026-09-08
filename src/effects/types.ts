import type { ReactNode } from "react";

/**
 * clip() が組み立てるアイテム。走行映像 1 本を @remotion/media の `<Video>`
 * として並べる。`at` は video() が解決する前は省略できる (直前の clip の
 * 終端に連結する)。
 */
type ClipInput = {
  readonly kind: "clip";
  /** 映像素材の URL (staticFile() 済み)。 */
  readonly src: string;
  /** 再生する尺 (秒)。 */
  readonly duration: number;
  /** 元動画の頭を捨てる秒数。 */
  readonly trimBefore: number;
  /** 開始位置 (秒)。省略時は video() が直前の clip の終端に解決する。 */
  readonly at?: number;
};

/** `at` が解決済みの ClipItem (video() の戻り値 `items` の要素)。 */
export type ClipItem = Omit<ClipInput, "at"> & { readonly at: number };

/** fade() が組み立てるアイテム。node をフェードイン/アウトで重ねる。 */
export type FadeItem = {
  readonly kind: "fade";
  /** 表示する要素。 */
  readonly node: ReactNode;
  /** 開始位置 (秒)。 */
  readonly at: number;
  /** 表示する尺 (秒)。 */
  readonly duration: number;
  /** フェードインの尺 (秒)。0 ならフェードなし。 */
  readonly in: number;
  /** フェードアウトの尺 (秒)。0 ならフェードなし。 */
  readonly out: number;
};

/** cut() が組み立てるアイテム。node をフェード無しで重ねる。 */
export type CutItem = {
  readonly kind: "cut";
  /** 表示する要素。 */
  readonly node: ReactNode;
  /** 開始位置 (秒)。 */
  readonly at: number;
  /** 表示する尺 (秒)。 */
  readonly duration: number;
};

/** video() に渡す入力アイテムの列 (clip の `at` は省略できる)。 */
export type Item = ClipInput | FadeItem | CutItem;

/** video() の戻り値の `items` に入る、`at` が解決済みのアイテム。 */
export type ResolvedItem = ClipItem | FadeItem | CutItem;

/**
 * video() の戻り値。動画 1 本分の演出アイテムの列と、フレームレート・解像度・
 * 尺を持つ。React 要素を含むため、Composition の props には載せない。
 */
export type Video = {
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
  readonly items: readonly ResolvedItem[];
};
