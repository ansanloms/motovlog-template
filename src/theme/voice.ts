// 話者と声質の既定値 (ADR-0010)。ブラウザ側 (compositions) も voice の key
// を作るために既定を知る必要があるため theme に置く。ENGINE の URL は .env
// (VOICEVOX_URL) のまま、バンドルには入れない。

/**
 * 既定の話者と声質。VOICEVOX 青山龍星 (T&M)。speed・pitch・intonation・
 * volume・pause は倍率 (pitch のみオフセットで 0 が中立、他は 1 が中立)、
 * silenceBefore・silenceAfter は秒。値は ENGINE の初期値 (speed 1、pitch 0、
 * intonation 1、volume 1、前後無音 0.1) から T&M の語りに合わせて調整した
 * もの (2026-09-09)。
 */
export const narrator = {
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
} as const;
