/**
 * 字幕・題名等の複数行入力を表す型。配列で書いた場合は改行として結合する
 * (音声合成では `readingText()` が改行を落とすので読みには影響しない)。
 */
export type TextLines = string | readonly string[];

/** TextLines を `\n` 区切りの単一行文字列に結合する。 */
export const joinLines = (text: TextLines): string =>
  typeof text === "string" ? text : text.join("\n");
