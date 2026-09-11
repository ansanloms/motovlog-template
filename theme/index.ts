// 利用側が持つ見た目と声の値 (ADR-0012)。lib (src/) はこの値を直接 import せず、
// app/index.ts の configure() 経由で受け取る。layout・timing のトークンは lib の
// src/theme/ が持つ。
//
// このファイルは Remotion を import しない。npm run dev / render の前段で動く
// watcher (scripts/voice.ts) が Node から app/config.ts 経由で読むため。

import type { Narrator, Palette, Theme } from "../src/theme/index.ts";

// T&M「カラー」節 (docs/design/tone-and-manner.md)。design の :root と同名。
// 値は design と一致させる (CLAUDE.md「Claude Design の同期」)。
const palette: Palette = {
  bg: "#0f1a14",
  surface: "#1a2c22",
  ink: "#edf3ed",
  inkDim: "#9db0a3",
  inkFaint: "#7f9686",
  line: "#223529",
  lineStrong: "#2f4638",
  accent: "#74c48a",
  accentSoft: "#9ed9ac",
  warn: "#c4705f",
  inkVideo: "#f2f4ef", // 映像の上に乗る文字 (パレットに依存しない)
  black: "#000000", // design の :root には無い。OP のフェード元に使う純黒
};

/**
 * 既定の話者と声質。VOICEVOX 青山龍星 (T&M)。speed・pitch・intonation・
 * volume・pause は倍率 (pitch のみオフセットで 0 が中立、他は 1 が中立)、
 * silenceBefore・silenceAfter は秒。値は ENGINE の初期値 (speed 1、pitch 0、
 * intonation 1、volume 1、前後無音 0.1) から T&M の語りに合わせて調整した
 * もの (2026-09-09)。
 */
const narrator: Narrator = {
  /**
   * VOICEVOX のスタイル ID。
   * 85: 青山龍星(かなしみ)
   */
  speaker: 85,

  /**
   * 話速 (speedScale)。倍率、1 が中立。
   */
  speed: 1,

  /**
   * 音高 (pitchScale)。
   * オフセット、0 が中立。
   */
  pitch: -0.1,

  /**
   * 抑揚 (intonationScale)。倍率、1 が中立。
   */
  intonation: 1.5,

  /**
   * 音量 (volumeScale)。倍率、1 が中立。
   */
  volume: 1.5,

  /**
   * 句読点の間 (pauseLengthScale)。倍率、1 が中立。
   */
  pause: 0.5,

  /**
   * 開始無音 (prePhonemeLength)。秒。
   */
  silenceBefore: 0,

  /**
   * 終了無音 (postPhonemeLength)。秒。
   */
  silenceAfter: 0,
};

export { narrator, palette };

/** app/config.ts から configure() へ渡す値。 */
export const theme: Theme = { palette, narrator };
