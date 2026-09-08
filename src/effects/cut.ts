import type { ReactNode } from "react";
import { isFrame } from "./frame.ts";
import type { CutItem, Placement } from "./types.ts";

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
 * 呼ばれた場合に備えて実行時にも throw する。
 */
export const cut = (node: ReactNode, options: CutOptions): CutItem => {
  const { at, after, duration } = options;

  if (isFrame(node)) {
    throw new Error("cut: frame() は渡せません");
  }

  return { kind: "cut", node, at, after, duration } as CutItem;
};
