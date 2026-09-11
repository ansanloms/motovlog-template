// 発話 1 本分のキャッシュ (public/projects/<slug>/lines/<key>.json) の型と
// 最小ランタイム検査 (ADR-0010)。key は text と voice の hash
// (src/voice/key.ts)。zod は使わず project/load.ts の isTimeline と同じ
// 流儀で検査する。

/**
 * 発話 1 本の声質。全項目必須。speed・pitch・intonation・volume・pause は
 * 倍率 (pitch のみオフセットで 0 が中立、他は 1 が中立)、silenceBefore・
 * silenceAfter は秒。VOICEVOX ENGINE の `/audio_query` の項目に対応する
 * (speed→speedScale 等、scripts/voice/engine.ts の applyVoice() を参照)。
 */
export type Voice = {
  /** VOICEVOX のスタイル id。 */
  readonly speaker: number;
  /** 話速 (speedScale)。 */
  readonly speed: number;
  /** 音高 (pitchScale)。 */
  readonly pitch: number;
  /** 抑揚 (intonationScale)。 */
  readonly intonation: number;
  /** 音量 (volumeScale)。 */
  readonly volume: number;
  /** 句読点の間 (pauseLengthScale)。 */
  readonly pause: number;
  /** 開始無音 (prePhonemeLength)。秒。 */
  readonly silenceBefore: number;
  /** 終了無音 (postPhonemeLength)。秒。 */
  readonly silenceAfter: number;
};

/**
 * 書き手が line() に書く voice。項目は全て任意で、省略分は key.ts の
 * resolveVoice() が theme (src/theme/voice.ts) の既定値で埋める。
 */
export type VoiceOptions = Partial<Voice>;

/** 口パクの母音区間 1 件。生成は scripts/voice、読み出しは src/compositions/figure.ts (口パク)。 */
export type LipsyncEntry = {
  readonly start: number;
  readonly end: number;
  readonly vowel: string;
};

/** `<key>.json` の形。voice は省略分を埋めた後の値 (key の算出に使った値と同じ)。 */
export type VoiceCache = {
  readonly text: string;
  readonly voice: Voice;
  readonly reading: string;
  readonly duration: number;
  readonly lipsync: readonly LipsyncEntry[];
  readonly generatedAt: string;
};

/** Voice の項目名の一覧。extract.ts が line().voice の未知キーを検査するのにも使う。 */
export const VOICE_KEYS = [
  "speaker",
  "speed",
  "pitch",
  "intonation",
  "volume",
  "pause",
  "silenceBefore",
  "silenceAfter",
] as const;

const isVoice = (value: unknown): value is Voice => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<string, unknown>>;

  return VOICE_KEYS.every((key) => typeof candidate[key] === "number");
};

/** VoiceCache の形 (項目の有無と型) だけを検査する。値の妥当性までは見ない。 */
export const isVoiceCache = (value: unknown): value is VoiceCache => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VoiceCache>;

  if (
    typeof candidate.text !== "string" ||
    typeof candidate.reading !== "string" ||
    typeof candidate.generatedAt !== "string" ||
    !Number.isFinite(candidate.duration)
  ) {
    return false;
  }

  if (!isVoice(candidate.voice)) {
    return false;
  }

  return (
    Array.isArray(candidate.lipsync) &&
    candidate.lipsync.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        Number.isFinite((entry as Partial<LipsyncEntry>).start) &&
        Number.isFinite((entry as Partial<LipsyncEntry>).end) &&
        typeof (entry as Partial<LipsyncEntry>).vowel === "string",
    )
  );
};
