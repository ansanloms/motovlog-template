import type { ReactNode } from "react";
import type { SampleNode } from "./sample.ts";

/**
 * フェード等の効果を「下の layer までの合成結果」にかける印。fade() の
 * node に渡す (`fade(frame(), { ... })`)。cut() には渡せない (型で弾く)。
 * layer 0 に置くと timeline() が throw する (下の layer が無いため)。
 */
export type FrameMarker = {
  readonly kind: "frame";
};

/**
 * layer 内の item と item の間に置く遷移。直後の item の開始を
 * 「直前の item の終端 − duration」に固定し、その区間で直後の item の
 * opacity を 0 から 1 に上げる。
 */
export type Transition = {
  readonly kind: "crossfade";
  /** 遷移の尺 (秒)。 */
  readonly duration: number;
};

/**
 * 解決済みの item を基準にした位置指定。start(item) は item の開始、
 * end(item) は item の終端 (遷移で縮んだ後の値) を指す。offset は基準
 * からの相対秒 (負も可)。参照先は timeline() が下から前へ解決する順で
 * 既に解決済みでなければならない (上の layer・同じ layer の後ろの item・
 * どの layer にも置かれていない item は throw)。
 */
export type Anchor = {
  readonly kind: "anchor";
  readonly edge: "start" | "end";
  readonly item: Item;
  readonly offset: number;
};

/**
 * layer 内での位置指定。省略時は timeline() が同じ layer の直前の item の
 * 終端 (最初は 0) に連結する。`after` は直前の終端からの相対秒、`at` は
 * 絶対秒または Anchor。型として排他 (両方は同時に指定できない)。
 */
export type Placement =
  | {
      /** 開始位置 (絶対秒または Anchor)。省略時は同じ layer の直前の item の終端 (最初は 0) に連結する。 */
      readonly at?: number | Anchor;
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
  /** 表示する要素。frame() (FrameMarker) や sample() (SampleNode) も渡せる。 */
  readonly node: ReactNode | FrameMarker | SampleNode;
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
  /** 表示する要素。sample() (SampleNode) も渡せる。 */
  readonly node: ReactNode | SampleNode;
  /** 表示する尺 (秒)。 */
  readonly duration: number;
};

/**
 * cut() が duration を省いて組み立てるアイテム。narration() が発話の実尺で
 * duration を埋めてから layer に置くための中間形で、Item には含めない
 * (Layer に直接置くと型エラーになる)。
 */
export type PendingCutItem = Omit<CutItem, "duration"> & {
  readonly duration?: undefined;
};

/** timeline() に渡す入力アイテムの列 (位置は at / after / 省略のいずれか)。 */
export type Item = FadeItem | CutItem;

/** layer (時間が重ならない item の列。item と item の間に Transition を置ける)。 */
export type Layer = readonly (Item | Transition)[];

/** `at` が解決済みの FadeItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedFadeItem = Omit<FadeItem, "at" | "after"> & {
  readonly at: number;
  /** 直前からの遷移 (crossfade)。無ければ undefined。 */
  readonly transitionIn?: Transition;
};

/** `at` が解決済みの CutItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedCutItem = Omit<CutItem, "at" | "after"> & {
  readonly at: number;
  /** 直前からの遷移 (crossfade)。無ければ undefined。 */
  readonly transitionIn?: Transition;
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
