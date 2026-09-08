import type { Transition } from "./types.ts";

/** crossfade() に渡すオプション。 */
type CrossfadeOptions = {
  /** 遷移の尺 (秒)。 */
  duration: number;
};

/**
 * layer 内の item と item の間に置く遷移。直後の item の開始を
 * 「直前の item の終端 − duration」に固定する。duration の検査
 * (正の有限・1 フレーム以上・前後の item の尺との比較・先頭/末尾/連続の
 * 禁止) は timeline() の resolveLayer で行う (cut と同じ方針)。
 */
export const crossfade = (options: CrossfadeOptions): Transition => {
  const { duration } = options;

  return { kind: "crossfade", duration };
};
