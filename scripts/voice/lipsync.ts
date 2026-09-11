// VOICEVOX ENGINE の /audio_query が返す query から口パクデータを作る
// (ADR-0008)。mora の母音区間をそのまま口パクのタイムラインにする。
// 子音の区間は直前の母音の口形を維持する扱いのため、配列には含めない。

import type { LipsyncEntry } from "../../src/voice/cache.ts";

type Mora = {
  /** 子音の音素記号。子音を持たない mora (母音のみ) は null。 */
  consonant: string | null;
  /** 子音の長さ (秒)。consonant が null なら null。 */
  consonant_length: number | null;
  /** 母音の音素記号 (無声化すると大文字になる)。 */
  vowel: string;
  /** 母音の長さ (秒)。 */
  vowel_length: number;
  /** mora の音高。無声化した mora には ENGINE が 0 を返す。 */
  pitch: number;
};

type AccentPhrase = {
  /** アクセント句を構成する mora の列。 */
  moras: Mora[];
  /** アクセント句の直後の句読点の間 (mora)。無ければ null。 */
  pause_mora: Mora | null;
  /**
   * 疑問文の accent phrase 末尾かどうか。true なら ENGINE が /synthesis で
   * 上昇 mora を足して合成する (下記 UPSPEAK_LENGTH 参照)。
   */
  is_interrogative?: boolean;
};

/**
 * VOICEVOX ENGINE の /audio_query が返す query の型。queryToLipsync・
 * queryTotalSeconds・applyVoice (engine.ts) が要求する項目のみを列挙する
 * (query には他にも項目があるが未使用)。
 */
export type AudioQuery = {
  /** アクセント句の列 (テキスト全体の分割単位)。 */
  accent_phrases: AccentPhrase[];
  /** 話速の倍率。 */
  speedScale: number;
  /** 音高のオフセット。 */
  pitchScale: number;
  /** 抑揚の倍率。 */
  intonationScale: number;
  /** 音量の倍率。 */
  volumeScale: number;
  /** 句読点の間の倍率 (pauseLength が null のときに pause_mora.vowel_length へ掛ける)。 */
  pauseLengthScale: number;
  /**
   * 句読点の間の絶対秒。既定 (ENGINE の /audio_query の応答) は null で、
   * null のときは pause_mora.vowel_length * pauseLengthScale を使う。
   * 非 null なら ENGINE の OpenAPI の記述どおり絶対秒として優先する。
   */
  pauseLength: number | null;
  /** 発話開始前の無音 (秒)。 */
  prePhonemeLength: number;
  /** 発話終了後の無音 (秒)。 */
  postPhonemeLength: number;
};

// 無声化母音 (I・U 等) は大文字で返るため、口形の判定側が大文字小文字を
// 両方見ずに済むよう小文字に正規化する。"N" (撥音)・"cl" (促音)・"pau" (無音) は
// 母音と別扱いの記号のためそのまま残す。
const KEEP_AS_IS = new Set(["N", "cl", "pau"]);

const normalizeVowel = (vowel: string): string =>
  KEEP_AS_IS.has(vowel) ? vowel : vowel.toLowerCase();

// ENGINE の既定 (enable_interrogative_upspeak=true) が /synthesis で
// is_interrogative な accent phrase の末尾に足す上昇 mora の長さ (秒)。
// ENGINE の `_apply_interrogative_upspeak` 由来の固定値で、query には
// 反映されないため client 側で同じ長さを補う。
const UPSPEAK_LENGTH = 0.15;

// ENGINE の `_apply_interrogative_upspeak` は、末尾 mora が無声化していて
// pitch が 0 のときは上昇 mora を足さない (音高を持たない母音には上げようが
// ないため)。client 側でも同じ条件 (is_interrogative かつ末尾 mora の
// pitch > 0) で判定する。
const hasUpspeak = (phrase: AccentPhrase): boolean => {
  if (!phrase.is_interrogative || phrase.moras.length === 0) {
    return false;
  }

  return phrase.moras[phrase.moras.length - 1].pitch > 0;
};

// pause_mora (句読点の間) の長さ (秒)。query.pauseLength が非 null ならそれを
// 絶対秒として優先し、null なら pause_mora.vowel_length を
// query.pauseLengthScale で伸縮する。
const pauseMoraLength = (query: AudioQuery, pauseMora: Mora): number =>
  query.pauseLength ?? pauseMora.vowel_length * query.pauseLengthScale;

/** VOICEVOX ENGINE の query から口パクの母音区間の配列 (秒、速度反映済み) を作る。 */
export const queryToLipsync = (query: AudioQuery): LipsyncEntry[] => {
  const entries: LipsyncEntry[] = [];
  let t = query.prePhonemeLength;

  for (const phrase of query.accent_phrases) {
    for (const mora of phrase.moras) {
      t += mora.consonant_length ?? 0;

      const start = t;
      const end = t + mora.vowel_length;
      entries.push({ start, end, vowel: normalizeVowel(mora.vowel) });
      t = end;
    }

    if (hasUpspeak(phrase)) {
      const lastVowel = phrase.moras[phrase.moras.length - 1].vowel;
      const start = t;
      const end = t + UPSPEAK_LENGTH;
      entries.push({ start, end, vowel: normalizeVowel(lastVowel) });
      t = end;
    }

    if (phrase.pause_mora) {
      const pauseMora = phrase.pause_mora;

      t += pauseMora.consonant_length ?? 0;

      const start = t;
      const end = t + pauseMoraLength(query, pauseMora);
      entries.push({ start, end, vowel: "pau" });
      t = end;
    }
  }

  return entries.map((entry) => ({
    start: entry.start / query.speedScale,
    end: entry.end / query.speedScale,
    vowel: entry.vowel,
  }));
};

/**
 * query 全体の長さ (秒) を返す。queryToLipsync の最後の end は
 * postPhonemeLength を含まないため、wav の実尺との比較には代わりにこちらを
 * 使う。
 */
export const queryTotalSeconds = (query: AudioQuery): number => {
  let total = query.prePhonemeLength + query.postPhonemeLength;

  for (const phrase of query.accent_phrases) {
    for (const mora of phrase.moras) {
      total += (mora.consonant_length ?? 0) + mora.vowel_length;
    }

    if (hasUpspeak(phrase)) {
      total += UPSPEAK_LENGTH;
    }

    if (phrase.pause_mora) {
      total +=
        (phrase.pause_mora.consonant_length ?? 0) +
        pauseMoraLength(query, phrase.pause_mora);
    }
  }

  return total / query.speedScale;
};
