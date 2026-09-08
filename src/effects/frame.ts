import type { FrameMarker } from "./types.ts";

/**
 * 「下の layer までの合成結果」を表す印を返す。fade() の node に渡す
 * (`fade(frame(), { ... })`)。cut() には渡せない (型と実行時の両方で
 * 弾く)。layer 0 に置くと timeline() が throw する。
 */
export const frame = (): FrameMarker => ({ kind: "frame" });

/** node が frame() の印かどうかを判定する。 */
export const isFrame = (node: unknown): node is FrameMarker =>
  typeof node === "object" &&
  node !== null &&
  (node as { kind?: unknown }).kind === "frame";
