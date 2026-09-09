import type { ReactNode } from "react";

/**
 * sample() の render に渡される時刻。item (Sequence) 内での相対値と、動画
 * 先頭からの絶対値の両方を持つ。
 */
export type SampleTime = {
  /** item の開始からの秒 (Sequence 内のフレーム / fps)。 */
  readonly seconds: number;
  /** 動画先頭からの絶対秒 ((from + frame) / fps)。 */
  readonly absolute: number;
  /** Sequence 内のフレーム番号 (0 起点)。 */
  readonly frame: number;
};

/**
 * 時刻を受けて node を返す関数を effects が毎フレーム呼ぶための印。
 * cut()/fade() の node に渡せる (`cut(sample((t) => ...), { ... })`)。
 * frame() と違い、どの layer にも置ける。
 */
export type SampleNode = {
  readonly kind: "sample";
  readonly render: (t: SampleTime) => ReactNode;
};

/** render を毎フレーム呼ぶ SampleNode を返す。cut()/fade() の node に渡す。 */
export const sample = (render: (t: SampleTime) => ReactNode): SampleNode => ({
  kind: "sample",
  render,
});

/** node が sample() の印かどうかを判定する。 */
export const isSample = (node: unknown): node is SampleNode =>
  typeof node === "object" &&
  node !== null &&
  (node as { kind?: unknown }).kind === "sample";
