import type { Layer } from "./types.ts";

/**
 * group() が返す塊の node。cut()/fade() の node に渡す
 * (`cut(group([...]), { ... })`)。内部の layers は塊自身の時間原点
 * (塊の先頭を 0 とする相対秒) で解決される (timeline.ts 参照)。
 */
export type GroupNode = {
  readonly kind: "group";
  readonly layers: readonly Layer[];
};

/**
 * layers を塊 (GroupNode) にまとめる。塊の中の item の at は塊の先頭からの
 * 相対秒になる (after・省略・アンカー・until・crossfade は塊の中でも同じ
 * 規則で使える)。cut()/fade() の node に渡す。layers が空、または空の
 * layer があれば throw する (timeline() の layers 検査と同じ規則)。
 */
export const group = (layers: readonly Layer[]): GroupNode => {
  if (layers.length === 0) {
    throw new Error("group: layers が空です");
  }

  layers.forEach((layer, layerIndex) => {
    if (layer.length === 0) {
      throw new Error(`group: layer ${layerIndex} が空です`);
    }
  });

  return { kind: "group", layers };
};

/** node が group() の印かどうかを判定する。 */
export const isGroup = (node: unknown): node is GroupNode =>
  typeof node === "object" &&
  node !== null &&
  (node as { kind?: unknown }).kind === "group";
