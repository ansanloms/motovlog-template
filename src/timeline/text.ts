// セリフの読み記法 {漢字|よみ} の展開 (ADR-0006)。
//
// VOICEVOX エディタが解釈するこの記法を、API はそのまま文として読んでしまう
// ため、字幕表示用と音声合成用でそれぞれ展開する関数を用意する。

const READING_PATTERN = /\{([^{}|]+)\|([^{}|]+)\}/g;

// 字幕表示用: {漢字|よみ} を 漢字 に展開する。記法が無ければそのまま返す。
export const displayText = (text: string): string =>
  text.replace(READING_PATTERN, "$1");

// 音声合成用: {漢字|よみ} を よみ に展開する。記法が無ければそのまま返す。
// 字幕の改行 (\n・\r) は音声合成に不要なため取り除く。
export const readingText = (text: string): string =>
  text.replace(READING_PATTERN, "$2").replace(/[\r\n]/g, "");
