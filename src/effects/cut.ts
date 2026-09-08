import type { ReactNode } from "react";
import { isFrame } from "./frame.ts";
import type { CutItem, PendingCutItem, Placement } from "./types.ts";

/** cut() に渡すオプション。 */
type CutOptions = Placement & {
  /** 表示する尺 (秒)。 */
  duration: number;
};

/**
 * node を duration 秒だけ、フェード無しで表示する。`at`/`after` を省略
 * すると同じ layer の直前の item の終端に連結する。`at` と `after` の
 * 同時指定は型エラーになる (実行時の検査は timeline() の resolveLayer で
 * 行う)。frame() (FrameMarker) は型で弾かれるが、`@ts-expect-error` で
 * 呼ばれた場合に備えて実行時にも throw する。duration を省くと
 * PendingCutItem になり、narration() だけが duration (発話の実尺) を
 * 埋めて layer に置ける (普通の layer に直接置くと型エラーになる)。
 */
export function cut(node: ReactNode, options: CutOptions): CutItem;
export function cut(node: ReactNode, options: Placement): PendingCutItem;
export function cut(
  node: ReactNode,
  options: CutOptions | Placement,
): CutItem | PendingCutItem {
  const { at, after } = options;
  const duration = "duration" in options ? options.duration : undefined;

  if (isFrame(node)) {
    throw new Error("cut: frame() は渡せません");
  }

  return { kind: "cut", node, at, after, duration } as CutItem | PendingCutItem;
}
