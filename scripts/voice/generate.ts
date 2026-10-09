// extractLines() が集めた line (text・reading・voice) ごとに、音声キャッシュ
// (public/projects/<slug>/lines/<key>.{wav,json}) を生成する (ADR-0010)。
// 合成には reading (省略時は text) を使う。同じ key (text・reading・voice の
// hash) の wav・json が両方あれば再生成しない。fs・fetch は実際の I/O を
// injects しないテストができるよう deps 経由で渡す (scripts/convert の
// やり方に合わせる)。

import path from "node:path";
import type { VoiceCache } from "../../src/voice/cache.ts";
import { readingText } from "../../src/voice/reading.ts";
import { linePath, resolveVoice, voiceKey } from "../../src/voice/key.ts";
import { fps as themeFps } from "../../src/theme/timing.ts";
import {
  applyVoice,
  checkSpeaker,
  fetchAudioQuery,
  fetchSynthesis,
} from "./engine.ts";
import type { ExtractedLine } from "./extract.ts";
import { queryToLipsync, queryTotalSeconds } from "./lipsync.ts";
import { wavDurationSeconds } from "./wav.ts";

/** generateMissing() が使う I/O・ENGINE 呼び出しの差し替え口。 */
export type GenerateDeps = {
  /** public/projects/<slug>/lines の絶対パス。mkdir だけに使う。 */
  linesDir: string;
  /** public/ の絶対パス。linePath(slug, key) の相対パスをここに前置してファイルパスを組む。 */
  publicDir: string;
  /** VOICEVOX ENGINE の URL。 */
  voicevoxUrl: string;
  /** ENGINE への問い合わせに使う fetch。 */
  fetchImpl: typeof fetch;
  /** パスの存在確認。 */
  exists: (p: string) => boolean;
  /** ディレクトリの作成。 */
  mkdir: (dir: string) => void;
  /** ファイルの書き込み。 */
  writeFile: (p: string, data: Buffer | string) => void;
  /** ファイルのリネーム (tmp から本番パスへの確定に使う)。 */
  rename: (from: string, to: string) => void;
  /** 進捗ログの出力。 */
  log: (line: string) => void;
  /** 警告ログの出力。 */
  warn: (line: string) => void;
  /** VoiceCache.generatedAt に書く値。既定は Temporal.Now.instant().toString()。 */
  now: () => string;
};

/** generateMissing() の集計結果。生成した件数と skip した件数。 */
export type GenerateResult = {
  /** 新規に生成した件数。 */
  generated: number;
  /** 既存キャッシュがあり skip した件数。 */
  skipped: number;
};

/**
 * lines を key (text と voice の hash) ごとに生成する。既に `<key>.wav` と
 * `<key>.json` が両方あれば skip する。生成した `<key>.json` は tmp に
 * 書いてから rename する (書き込み中のクラッシュで壊れたファイルが残らない
 * ように)。speaker (style id) が ENGINE の /speakers にあるかの確認は、この
 * 実行中に同じ speaker を 2 度以上問い合わせないよう speaker ごとに 1 度だけ
 * 行う (skip される発話しか無ければ 1 度も呼ばない)。
 */
export const generateMissing = async (
  slug: string,
  lines: readonly ExtractedLine[],
  deps: GenerateDeps,
): Promise<GenerateResult> => {
  const { linesDir, publicDir, voicevoxUrl, fetchImpl } = deps;

  deps.mkdir(linesDir);

  let generated = 0;
  let skipped = 0;
  const checkedSpeakers = new Set<number>();

  for (const { text, reading: readingProp, voice } of lines) {
    const resolvedVoice = resolveVoice(voice);
    const key = await voiceKey({ text, reading: readingProp, voice });
    const relPath = linePath(slug, key);
    const wavPath = path.join(publicDir, `${relPath}.wav`);
    const jsonPath = path.join(publicDir, `${relPath}.json`);

    if (deps.exists(wavPath) && deps.exists(jsonPath)) {
      deps.log(`skip: ${slug}/${key}`);
      skipped++;
      continue;
    }

    if (!checkedSpeakers.has(resolvedVoice.speaker)) {
      await checkSpeaker(fetchImpl, voicevoxUrl, resolvedVoice.speaker);
      checkedSpeakers.add(resolvedVoice.speaker);
    }

    const reading = readingText(readingProp ?? text);
    const query = applyVoice(
      await fetchAudioQuery(
        fetchImpl,
        voicevoxUrl,
        reading,
        resolvedVoice.speaker,
      ),
      resolvedVoice,
    );
    const wav = await fetchSynthesis(
      fetchImpl,
      voicevoxUrl,
      query,
      resolvedVoice.speaker,
    );

    const lipsync = queryToLipsync(query);
    const duration = Math.round(wavDurationSeconds(wav) * 1000) / 1000;

    // query 全体の長さ (postPhonemeLength を含む) と wav の実尺のずれが 1
    // フレーム分を超える場合、口パクと音声がフレーム単位でずれて見えるため
    // 警告する。
    const driftSeconds = Math.abs(queryTotalSeconds(query) - duration);

    if (!Number.isFinite(driftSeconds)) {
      throw new Error(
        `mora 合計と wav の実尺の差を計算できませんでした (NaN): ${key}`,
      );
    }

    if (driftSeconds > 1 / themeFps) {
      deps.warn(
        `warn: ${slug}/${key}: mora 合計と wav の実尺の差が ${Math.round(driftSeconds * 1000)} ms`,
      );
    }

    deps.writeFile(wavPath, wav);

    const cache: VoiceCache = {
      text,
      voice: resolvedVoice,
      reading,
      duration,
      lipsync,
      generatedAt: deps.now(),
    };

    const tmpPath = `${jsonPath}.tmp`;
    deps.writeFile(tmpPath, `${JSON.stringify(cache, null, 2)}\n`);
    deps.rename(tmpPath, jsonPath);

    deps.log(`generate: ${slug}/${key}`);
    generated++;
  }

  deps.log(`generated: ${generated}, skipped: ${skipped} (${slug})`);

  return { generated, skipped };
};
