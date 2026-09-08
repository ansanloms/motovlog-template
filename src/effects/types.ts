import type { ReactNode } from "react";

/**
 * layer 内での位置指定。省略時は timeline() が同じ layer の直前の item の
 * 終端 (最初は 0) に連結する。`after` は直前の終端からの相対秒、`at` は
 * 絶対秒。型として排他 (両方は同時に指定できない)。
 */
export type Placement =
  | {
      /** 開始位置 (絶対秒)。省略時は同じ layer の直前の item の終端 (最初は 0) に連結する。 */
      readonly at?: number;
      readonly after?: never;
    }
  | {
      /** 直前の item の終端からの相対秒。 */
      readonly after?: number;
      readonly at?: never;
    };

/** fade() が組み立てるアイテム。node をフェードイン/アウトで重ねる。 */
export type FadeItem = Placement & {
  readonly kind: "fade";
  /** 表示する要素。 */
  readonly node: ReactNode;
  /** 表示する尺 (秒)。 */
  readonly duration: number;
  /** フェードインの尺 (秒)。0 ならフェードなし。 */
  readonly in: number;
  /** フェードアウトの尺 (秒)。0 ならフェードなし。 */
  readonly out: number;
};

/** cut() が組み立てるアイテム。node をフェード無しで重ねる。 */
export type CutItem = Placement & {
  readonly kind: "cut";
  /** 表示する要素。 */
  readonly node: ReactNode;
  /** 表示する尺 (秒)。 */
  readonly duration: number;
};

/** timeline() に渡す入力アイテムの列 (位置は at / after / 省略のいずれか)。 */
export type Item = FadeItem | CutItem;

/** layer (時間が重ならない item の列)。 */
export type Layer = readonly Item[];

/** `at` が解決済みの FadeItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedFadeItem = Omit<FadeItem, "at" | "after"> & {
  readonly at: number;
};

/** `at` が解決済みの CutItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedCutItem = Omit<CutItem, "at" | "after"> & {
  readonly at: number;
};

/** timeline() の戻り値の `layers` に入る、`at` が解決済みのアイテム。 */
export type ResolvedItem = ResolvedFadeItem | ResolvedCutItem;

/** 解決済み item の列 (layer 1 本分)。 */
export type ResolvedLayer = readonly ResolvedItem[];

/**
 * timeline() の戻り値。動画 1 本分の演出アイテムを layer (z 順、後ろが上) の
 * 配列で持ち、フレームレート・解像度・尺を併せ持つ。React 要素を含むため、
 * Composition の props には載せない。
 */
export type Timeline = {
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
  readonly layers: readonly ResolvedLayer[];
};
