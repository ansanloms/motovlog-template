import type { ReactNode } from "react";
import { isFrame } from "./frame.ts";
import type { SampleNode } from "./sample.ts";
import type { Anchor, CutItem, PendingCutItem, Placement } from "./types.ts";

/** cut() に渡すオプション (duration 指定)。 */
type CutOptionsWithDuration = Placement & {
  /** 表示する尺 (秒)。 */
  duration: number;
};

/** cut() に渡すオプション (until 指定)。 */
type CutOptionsWithUntil = Placement & {
  /** 終端の絶対秒または Anchor。尺は開始位置の解決後に求める。 */
  until: number | Anchor;
};

/**
 * node を duration 秒 (または until で求めた尺) だけ、フェード無しで
 * 表示する。`at`/`after` を省略すると同じ layer の直前の item の終端に
 * 連結する。`at` と `after` の同時指定、`duration` と `until` の同時指定は
 * throw する (at/after は型エラーにもなる。実行時の検査は timeline() の
 * resolveLayer で行う)。frame() (FrameMarker) は型で弾かれるが、
 * `@ts-expect-error` で呼ばれた場合に備えて実行時にも throw する。
 * `duration`・`until` を両方省くと PendingCutItem になり、narration()
 * だけが duration (発話の実尺) を埋めて layer に置ける (普通の layer に
 * 直接置くと型エラーになる)。sample() (SampleNode) も node に渡せる
 * (Stage が毎フレーム render を呼ぶ)。
 */
export function cut(
  node: ReactNode | SampleNode,
  options: CutOptionsWithDuration,
): CutItem;
export function cut(
  node: ReactNode | SampleNode,
  options: CutOptionsWithUntil,
): CutItem;
export function cut(
  node: ReactNode | SampleNode,
  options: Placement,
): PendingCutItem;
export function cut(
  node: ReactNode | SampleNode,
  options: Placement & { duration?: number; until?: number | Anchor },
): CutItem | PendingCutItem {
  const { at, after, duration, until } = options;

  if (isFrame(node)) {
    throw new Error("cut: frame() は渡せません");
  }

  if (duration !== undefined && until !== undefined) {
    throw new Error("cut: duration と until は同時に指定できません");
  }

  return {
    kind: "cut",
    node,
    at,
    after,
    duration,
    until,
  } as CutItem | PendingCutItem;
}
