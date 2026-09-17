import type { ReactNode } from "react";
import type { GroupNode } from "./group.ts";
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
 * からの相対秒 (負も可)。参照先は layer に関わらず (どの layer に置かれた
 * item でも) 参照できるが、timeline() は item 間の依存関係の順で解決する
 * ため、参照が循環している (同じ layer の後ろの item への参照も循環に
 * なる) か、どの layer にも置かれていない item を指すと throw する。
 * item は narration() に渡した入力 item 自体 (CutItem・FadeItem の
 * source によって narration() が組み立てた発話 layer の item に結び付く)
 * も渡せる。
 */
export type Anchor = {
  readonly kind: "anchor";
  readonly edge: "start" | "end";
  readonly item: Item | PendingCutItem;
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

/**
 * item の尺の指定。`duration` (秒数) か `until` (終端の絶対秒または Anchor)
 * のいずれかで、型として排他 (両方は同時に指定できない)。`until` は
 * timeline() が resolveLayer で開始位置を解決した後に `duration = until − 開始`
 * として尺を求める (Anchor は start/end と同じ規則で解決する)。
 */
export type Span =
  | {
      /** 表示する尺 (秒)。 */
      readonly duration: number;
      readonly until?: never;
    }
  | {
      /** 終端の絶対秒または Anchor。尺は開始位置を解決してから求める。 */
      readonly until: number | Anchor;
      readonly duration?: never;
    };

/** duration も until も持たない (span を省いた) 印。ADR-0014 参照。 */
type NoSpan = { readonly duration?: never; readonly until?: never };

/**
 * cut()/fade() の node と span (duration/until) の組。node が塊
 * (GroupNode) のときだけ span を省略できる (ADR-0014、省略時は塊の内容の
 * 尺になる)。NonGroupNode は塊以外で node に渡せる型 (cut() は
 * ReactNode | SampleNode、fade() はさらに FrameMarker も含む)。
 */
type NodeSpan<NonGroupNode> =
  | ({ readonly node: NonGroupNode } & Span)
  | ({ readonly node: GroupNode } & (Span | NoSpan));

/** fade() が組み立てるアイテム。node をフェードイン/アウトで重ねる。 */
export type FadeItem = Placement & {
  readonly kind: "fade";
  /** フェードインの尺 (秒)。0 ならフェードなし。 */
  readonly in: number;
  /** フェードアウトの尺 (秒)。0 ならフェードなし。 */
  readonly out: number;
  /**
   * narration() が入力 item から作った item が指す、元の入力 item
   * (narration() に渡した item 自体)。resolveLayer() は解決結果を
   * source にも登録し、start()/end() で元の item を参照できるようにする。
   * narration() 以外の書き手は指定しない。
   */
  readonly source?: Item | PendingCutItem;
} & NodeSpan<ReactNode | FrameMarker | SampleNode>;

/** cut() が組み立てるアイテム。node をフェード無しで重ねる。 */
export type CutItem = Placement & {
  readonly kind: "cut";
  /**
   * narration() が入力 item から作った item が指す、元の入力 item
   * (narration() に渡した item 自体)。resolveLayer() は解決結果を
   * source にも登録し、start()/end() で元の item を参照できるようにする。
   * narration() 以外の書き手は指定しない。
   */
  readonly source?: Item | PendingCutItem;
} & NodeSpan<ReactNode | SampleNode>;

/**
 * cut() が duration も until も省いて組み立てるアイテム。narration() が
 * 発話の実尺で duration を埋めてから layer に置くための中間形で、Item には
 * 含めない (Layer に直接置くと型エラーになる)。node が塊 (GroupNode) の
 * ときは span を省いても CutItem になる (ADR-0014) ため、PendingCutItem は
 * 塊以外の node に限る。
 */
export type PendingCutItem = Placement & {
  readonly kind: "cut";
  readonly node: ReactNode | SampleNode;
  readonly source?: Item | PendingCutItem;
} & NoSpan;

/** timeline() に渡す入力アイテムの列 (位置は at / after / 省略のいずれか)。 */
export type Item = FadeItem | CutItem;

/** layer (時間が重ならない item の列。item と item の間に Transition を置ける)。 */
export type Layer = readonly (Item | Transition)[];

/**
 * group() (塊) の、解決済みの内部 layers。node が GroupNode の
 * ResolvedItem だけが持つ (Stage が内部 layer を描画する入り口)。
 */
export type ResolvedGroup = {
  readonly layers: readonly ResolvedLayer[];
};

/** `at`・`duration` が解決済みの FadeItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedFadeItem = Omit<
  FadeItem,
  "at" | "after" | "duration" | "until" | "source"
> & {
  readonly at: number;
  /** 表示する尺 (秒)。until 指定の item も開始位置の解決後に数値へ求まる。 */
  readonly duration: number;
  /** 直前からの遷移 (crossfade)。無ければ undefined。 */
  readonly transitionIn?: Transition;
  /** node が塊 (GroupNode) のときの、解決済みの内部 layers。 */
  readonly group?: ResolvedGroup;
};

/** `at`・`duration` が解決済みの CutItem (timeline() の戻り値 `layers` の要素)。 */
export type ResolvedCutItem = Omit<
  CutItem,
  "at" | "after" | "duration" | "until" | "source"
> & {
  readonly at: number;
  /** 表示する尺 (秒)。until 指定の item も開始位置の解決後に数値へ求まる。 */
  readonly duration: number;
  /** 直前からの遷移 (crossfade)。無ければ undefined。 */
  readonly transitionIn?: Transition;
  /** node が塊 (GroupNode) のときの、解決済みの内部 layers。 */
  readonly group?: ResolvedGroup;
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
  /** フレームレート。 */
  readonly fps: number;
  /** 動画の幅 (px)。 */
  readonly width: number;
  /** 動画の高さ (px)。 */
  readonly height: number;
  /** 動画の尺 (秒)。 */
  readonly durationSec: number;
  /** 演出アイテムの layer 列 (z 順、後ろが上)。 */
  readonly layers: readonly ResolvedLayer[];
};
