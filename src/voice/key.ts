// text と voice から wav・json のキャッシュキーを作る (ADR-0010)。Node
// (scripts/voice) とブラウザ (src/compositions/narration.ts) の両方が同じ
// 実装で同じ key を作れるよう、crypto.subtle (Node 24 とブラウザで共通の
// Web Crypto API) だけを使う。

import { getSetup } from "../setup.ts";
import { VOICE_KEYS } from "./cache.ts";
import type { Voice, VoiceOptions } from "./cache.ts";

/**
 * voice の省略項目に既定値 (利用側の theme の narrator) を埋める。結果は必ず
 * VOICE_KEYS の順 (speaker → speed → pitch → intonation → volume → pause →
 * silenceBefore → silenceAfter) で組み直す。narrator は利用側が書くオブジェクト
 * なので、そのキー順を voiceKey() の JSON 化の順序に持ち込むと、利用側がキーを
 * 並べ替えただけで既存の音声キャッシュが全部無効になる。
 */
export const resolveVoice = (voice: VoiceOptions | undefined): Voice => {
  const merged: Voice = { ...getSetup().theme.narrator, ...voice };

  return Object.fromEntries(
    VOICE_KEYS.map((key) => [key, merged[key]]),
  ) as unknown as Voice;
};

/**
 * base (line().by の voice) と voice (line() 自身の voice) を合成する唯一の
 * 場所 (ADR-0011)。base・voice の両方が undefined なら undefined、それ以外は
 * `{ ...base, ...voice }` (voice が base を上書きする)。静的解析側
 * (scripts/voice/extract.ts) と実行時側 (narration.ts) の両方がこの関数で
 * 実効の声質を求め、同じ結果になることを保証する。
 */
export const mergeVoice = (
  base: VoiceOptions | undefined,
  voice: VoiceOptions | undefined,
): VoiceOptions | undefined =>
  base === undefined && voice === undefined ? undefined : { ...base, ...voice };

/**
 * text と voice (省略分は既定値で埋めてから) を JSON にし、SHA-256 の hex を
 * 返す。key の順序を固定するため、object は必ず text → (reading →) voice の
 * 順で組む。reading は指定時だけ JSON に含める。理由: 既存の (reading の無い)
 * 行の key を変えないため。
 */
export const voiceKey = async (params: {
  /** 発話のテキスト。 */
  text: string;
  /** 合成に渡す文 (省略時は text をそのまま使う)。指定時だけ key に含める。 */
  reading?: string;
  /** 声質。省略分は既定値 (theme の narrator) で埋める。 */
  voice?: VoiceOptions;
}): Promise<string> => {
  const { text, reading, voice } = params;
  const json = JSON.stringify({
    text,
    ...(reading !== undefined ? { reading } : {}),
    voice: resolveVoice(voice),
  });
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
