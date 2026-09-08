// text と voice から wav・json のキャッシュキーを作る (ADR-0010)。Node
// (scripts/voice) とブラウザ (src/compositions/narration.ts) の両方が同じ
// 実装で同じ key を作れるよう、crypto.subtle (Node 24 とブラウザで共通の
// Web Crypto API) だけを使う。

import { narrator } from "../theme/voice.ts";
import type { Voice, VoiceOptions } from "./cache.ts";

/**
 * voice の省略項目に既定値 (theme の narrator) を埋める。narrator のキー順
 * (speaker → speed → pitch → intonation → volume → pause → silenceBefore →
 * silenceAfter) がそのまま結果のキー順になり、voiceKey() の JSON 化の順序が
 * 固定される。
 */
export const resolveVoice = (voice: VoiceOptions | undefined): Voice => ({
  ...narrator,
  ...voice,
});

/**
 * text と voice (省略分は既定値で埋めてから) を JSON にし、SHA-256 の hex を
 * 返す。key の順序を固定するため、object は必ず text → voice の順で組む。
 */
export const voiceKey = async (params: {
  text: string;
  voice?: VoiceOptions;
}): Promise<string> => {
  const { text, voice } = params;
  const json = JSON.stringify({ text, voice: resolveVoice(voice) });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(json),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

/** key から public/projects/<slug>/lines/<key> (拡張子なし) の相対パスを組む。 */
export const linePath = (slug: string, key: string): string =>
  `projects/${slug}/lines/${key}`;
