import type { Anchor, Item } from "./types.ts";

const createAnchor = (
  edge: Anchor["edge"],
  item: Item,
  offset: number,
): Anchor => {
  if (!Number.isFinite(offset)) {
    throw new Error(`${edge}: offset が不正です (${offset})`);
  }

  return { kind: "anchor", edge, item, offset };
};

/**
 * item の開始を基準にした Anchor を返す。`at` に渡す。offset は開始からの
 * 相対秒 (負も可)。参照先が未解決 (上の layer・同じ layer の後ろの item・
 * どの layer にも置かれていない item) なら timeline() が throw する。
 */
export const start = (item: Item, offset = 0): Anchor =>
  createAnchor("start", item, offset);

/**
 * item の終端 (遷移で縮んだ後の値) を基準にした Anchor を返す。`at` に
 * 渡す。offset は終端からの相対秒 (負も可)。参照先が未解決の場合の扱いは
 * start() と同じ。
 */
export const end = (item: Item, offset = 0): Anchor =>
  createAnchor("end", item, offset);

/** at が Anchor かどうかを判定する。 */
export const isAnchor = (at: unknown): at is Anchor =>
  typeof at === "object" &&
  at !== null &&
  (at as { kind?: unknown }).kind === "anchor";
