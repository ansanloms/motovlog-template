import type { ReactNode } from "react";
import type { CutItem } from "./types.ts";

/** cut() に渡すオプション。 */
type CutOptions = {
  /** 開始位置 (秒)。 */
  at: number;
  /** 表示する尺 (秒)。 */
  duration: number;
};

/** node を at から duration 秒だけ、フェード無しで表示する。 */
export const cut = (node: ReactNode, options: CutOptions): CutItem => {
  const { at, duration } = options;

  return { kind: "cut", node, at, duration };
};
