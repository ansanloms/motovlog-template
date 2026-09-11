// セリフの読み記法 {漢字|よみ} の展開 (ADR-0008)。
//
// VOICEVOX エディタが解釈するこの記法を、API はそのまま文として読んでしまう
// ため、字幕表示用と音声合成用でそれぞれ展開する関数を用意する。

const READING_PATTERN = /\{([^{}|]+)\|([^{}|]+)\}/g;

/**
 * {漢字|よみ} 記法が壊れていないかを検査する。正しい形 (READING_PATTERN に
 * 合う `{漢字|よみ}`) をすべて取り除いた残りに `{`・`}` が残っていれば
 * throw する。片側が空 (`{|よみ}`・`{漢字|}`・`{|}`)・`|` が無い・
 * `|` が 2 つ以上のものは READING_PATTERN に合わずそのまま残るため拾える。
 * 入れ子 (`{猫{犬|いぬ}}`) は内側の正しい断片だけが取り除かれ、外側の
 * `{`・`}` が残るため拾える。閉じ忘れ (`{猫|ねこ`)・開き忘れ
 * (`猫|ねこ}`) もマッチせずそのまま残るため拾える。記法が無ければ
 * 何もしない。
 */
export const assertReadingNotation = (text: string): void => {
  const remainder = text.replace(READING_PATTERN, "");
  const braceIndex = remainder.search(/[{}]/);

  if (braceIndex === -1) {
    return;
  }

  const context = remainder.slice(
    Math.max(0, braceIndex - 6),
    Math.min(remainder.length, braceIndex + 7),
  );

  throw new Error(`{漢字|よみ} の形で書いてください: ${context}`);
};

/** 字幕表示用: {漢字|よみ} を漢字に展開する。記法が無ければそのまま返す。 */
export const displayText = (text: string): string =>
  text.replace(READING_PATTERN, "$1");

/**
 * 音声合成用: {漢字|よみ} をよみに展開する。記法が無ければそのまま返す。
 * 字幕の改行 (\n・\r) は音声合成に不要なため取り除く。
 */
export const readingText = (text: string): string =>
  text.replace(READING_PATTERN, "$2").replace(/[\r\n]/g, "");
