// VOICEVOX ENGINE の HTTP API 呼び出し (ADR-0008)。

import type { Voice } from "../../src/voice/cache.ts";
import type { AudioQuery } from "./lipsync.ts";

/**
 * voice (省略分を埋めた後の値) を AudioQuery に反映する。speaker は
 * `/audio_query`・`/synthesis` の URL クエリで渡すため query 本体には
 * 含めない。pauseLength (絶対秒) は voice に対応する項目が無いため触らない。
 */
export const applyVoice = (query: AudioQuery, voice: Voice): AudioQuery => {
  if (voice.speaker < 0) {
    throw new Error(`voice.speaker が不正です (${voice.speaker})`);
  }

  return {
    ...query,
    speedScale: voice.speed,
    pitchScale: voice.pitch,
    intonationScale: voice.intonation,
    volumeScale: voice.volume,
    pauseLengthScale: voice.pause,
    prePhonemeLength: voice.silenceBefore,
    postPhonemeLength: voice.silenceAfter,
  };
};

/** checkSpeaker() が期待する /speakers の要素 1 件の形。 */
type SpeakerEntry = { styles: { id: number }[] };

/** value が /speakers の応答 (SpeakerEntry の配列) の形かどうかを判定する。 */
const isSpeakersResponse = (value: unknown): value is SpeakerEntry[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      Array.isArray((entry as { styles?: unknown }).styles) &&
      (entry as { styles: unknown[] }).styles.every(
        (style) =>
          typeof style === "object" &&
          style !== null &&
          typeof (style as { id?: unknown }).id === "number",
      ),
  );

/** ENGINE に問い合わせ、speaker (style id) が使えるか確認する。 */
export const checkSpeaker = async (
  fetchImpl: typeof fetch,
  voicevoxUrl: string,
  speaker: number,
): Promise<void> => {
  const url = `${voicevoxUrl}/speakers`;
  const res = await fetchImpl(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `/speakers に失敗しました (status ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const speakers: unknown = await res.json();

  if (!isSpeakersResponse(speakers)) {
    throw new Error(
      `/speakers の応答が VOICEVOX ENGINE の形ではありません (${url})`,
    );
  }

  const known = speakers.some((s) =>
    s.styles.some((style) => style.id === speaker),
  );

  if (!known) {
    throw new Error(`speaker ${speaker} が ENGINE の /speakers にありません`);
  }
};

/** VOICEVOX ENGINE の `/audio_query` を呼び、text・speaker から AudioQuery を得る。 */
export const fetchAudioQuery = async (
  fetchImpl: typeof fetch,
  voicevoxUrl: string,
  text: string,
  speaker: number,
): Promise<AudioQuery> => {
  const url = `${voicevoxUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
  const res = await fetchImpl(url, { method: "POST" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `/audio_query に失敗しました (status ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  return (await res.json()) as AudioQuery;
};

/** VOICEVOX ENGINE の `/synthesis` を呼び、query・speaker から wav バッファを得る。 */
export const fetchSynthesis = async (
  fetchImpl: typeof fetch,
  voicevoxUrl: string,
  query: AudioQuery,
  speaker: number,
): Promise<Buffer> => {
  const url = `${voicevoxUrl}/synthesis?speaker=${speaker}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `/synthesis に失敗しました (status ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  return Buffer.from(await res.arrayBuffer());
};
