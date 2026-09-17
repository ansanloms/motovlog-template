import type { Anchor, Item, PendingCutItem } from "./types.ts";

const createAnchor = (
  edge: Anchor["edge"],
  item: Item | PendingCutItem,
  offset: number,
): Anchor => {
  if (!Number.isFinite(offset)) {
    throw new Error(`${edge}: offset が不正です (${offset})`);
  }

  return { kind: "anchor", edge, item, offset };
};

/**
 * item の開始を基準にした Anchor を返す。`at`/`until` に渡す。offset は
 * 開始からの相対秒 (負も可)。item はどの layer に置かれた item でも渡せ、
 * narration() に渡した入力 item (line() を包む cut() 等) も渡せる。参照が
 * 循環している (同じ layer の後ろの item への参照も循環になる)、または
 * どの layer にも置かれていない item を指すと timeline() が throw する。
 */
export const start = (item: Item | PendingCutItem, offset = 0): Anchor =>
  createAnchor("start", item, offset);

/**
 * item の終端 (遷移で縮んだ後の値、または until で求めた尺の終端) を
 * 基準にした Anchor を返す。`at`/`until` に渡す。offset は終端からの相対秒
 * (負も可)。参照先の扱いは start() と同じ。
 */
export const end = (item: Item | PendingCutItem, offset = 0): Anchor =>
  createAnchor("end", item, offset);

/** at が Anchor かどうかを判定する。 */
export const isAnchor = (at: unknown): at is Anchor =>
  typeof at === "object" &&
  at !== null &&
  (at as { kind?: unknown }).kind === "anchor";
