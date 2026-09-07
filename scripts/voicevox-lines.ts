// 使い方: npm run voice -- <slug> [--force]
//
// projects/<slug>/timeline.json の lines から VOICEVOX ENGINE の API で
// セリフ音声 (wav) と口パクデータを生成し、public/projects/<slug>/lines/ に
// 書き出す。生成結果 (audio/lipsync/duration) は timeline.json に書き戻す
// (ADR-0006)。npm run はリポジトリルートを cwd にして実行する。

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { queryToLipsync, queryTotalSeconds } from "../src/timeline/lipsync";
import type { AudioQuery } from "../src/timeline/lipsync";
import { timelineSchema } from "../src/timeline/schema";
import { readingText } from "../src/timeline/text";
import { wavDurationSeconds } from "../src/timeline/wav";

// ADR-0002 の slug 形式 (make-proxy.sh と同じ正規表現)。
const SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

type VoiceResult = { audio: string; lipsync: string; duration: number };

// text は表示用に残す (比較には使わない)。skip 判定は reading・speaker で行う。
type VoiceMeta = {
  text: string;
  reading: string;
  speaker: number;
  duration: number;
};

// voice.json (前回実行の生成結果) を読み直すときの検証。壊れた・古い形式の
// JSON はここで弾き、skip せず再生成させる (readVoiceMeta 参照)。
const voiceMetaSchema = z.object({
  reading: z.string(),
  speaker: z.number().int(),
  duration: z.number().positive(),
  generatedAt: z.string(),
});

// ZodError の issue を 1 行ずつ「path: message」の形にする (起動時の parse
// 失敗用。生の ZodError をそのまま出さない)。
const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

// 書き戻し後の検証失敗を「line の id: start を調整してください」の形にする。
// 対象は path の末尾が start の issue だけで、それ以外 (id 重複等) は
// path: message にフォールバックする。
const formatWriteBackIssues = (
  updatedLines: unknown,
  error: z.ZodError,
): string => {
  const lines = Array.isArray(updatedLines) ? updatedLines : [];

  return error.issues
    .map((issue) => {
      const [container, index] = issue.path;
      const isStartIssue = issue.path[issue.path.length - 1] === "start";

      if (container === "lines" && typeof index === "number" && isStartIssue) {
        const line = lines[index];
        const id =
          typeof line === "object" && line !== null && "id" in line
            ? String((line as Record<string, unknown>).id)
            : `index ${index}`;

        return `${id}: start を調整してください`;
      }

      return `${issue.path.join(".")}: ${issue.message}`;
    })
    .join("\n");
};

// timeline.json (生の JSON) に生成結果を書き戻す。対象外の line・他の
// フィールドはそのまま保つ。入力を変更せず、書き戻した内容のクローンを返す。
export const applyVoiceResults = (
  timelineJson: unknown,
  results: Map<string, VoiceResult>,
): unknown => {
  const cloned = JSON.parse(JSON.stringify(timelineJson)) as {
    lines?: unknown;
  };

  if (!Array.isArray(cloned.lines)) {
    return cloned;
  }

  for (const line of cloned.lines) {
    if (typeof line !== "object" || line === null) {
      continue;
    }

    const record = line as Record<string, unknown>;
    const id = record.id;

    if (typeof id !== "string") {
      continue;
    }

    const result = results.get(id);

    if (!result) {
      continue;
    }

    record.audio = result.audio;
    record.lipsync = result.lipsync;
    record.duration = result.duration;
  }

  return cloned;
};

const readVoiceMeta = (voiceMetaPath: string): VoiceMeta | undefined => {
  if (!fs.existsSync(voiceMetaPath)) {
    return undefined;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(voiceMetaPath, "utf-8"));

    if (!voiceMetaSchema.safeParse(raw).success) {
      return undefined;
    }

    return raw as VoiceMeta;
  } catch {
    return undefined;
  }
};

// skip できるなら (wav・lipsync が既にあり、reading・speaker が一致するなら)
// その voice.json の内容を返す。skip できなければ undefined を返す。
const resolveSkippableMeta = (params: {
  meta: VoiceMeta | undefined;
  wavPath: string;
  lipsyncPath: string;
  reading: string;
  speaker: number;
}): VoiceMeta | undefined => {
  const { meta, wavPath, lipsyncPath, reading, speaker } = params;

  if (!fs.existsSync(wavPath) || !fs.existsSync(lipsyncPath)) {
    return undefined;
  }

  if (
    meta === undefined ||
    meta.reading !== reading ||
    meta.speaker !== speaker
  ) {
    return undefined;
  }

  return meta;
};

const fetchAudioQuery = async (
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

const fetchSynthesis = async (
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

export const run = async (params: {
  slug: string;
  force: boolean;
  voicevoxUrl: string;
  cwd: string;
  fetchImpl?: typeof fetch;
}): Promise<{ generated: number; skipped: number }> => {
  const { slug, force, cwd } = params;
  const fetchImpl = params.fetchImpl ?? globalThis.fetch;
  // 末尾のスラッシュがあると URL 組み立て時に // が入るため取り除く。
  const voicevoxUrl = params.voicevoxUrl.replace(/\/+$/, "");

  const timelinePath = path.join(cwd, "projects", slug, "timeline.json");
  const raw = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
  const parsed = timelineSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `timeline.json の検証に失敗しました:\n${formatZodError(parsed.error)}`,
    );
  }

  const timeline = parsed.data;

  // 話者は合成に入る前に全 line 分を解決する。未指定の line が複数あっても
  // 1 回で id を列挙できるようにし、1 件目で止めて残りを隠さない。
  const missingSpeakerIds = timeline.lines
    .filter((line) => (line.speaker ?? timeline.voice?.speaker) === undefined)
    .map((line) => line.id);

  if (missingSpeakerIds.length > 0) {
    throw new Error(
      `話者 (speaker) が指定されていません。line.speaker か timeline.voice.speaker を設定してください: ${missingSpeakerIds.join(", ")}`,
    );
  }

  const speakers = new Map<string, number>(
    timeline.lines.map((line) => [
      line.id,
      (line.speaker ?? timeline.voice?.speaker) as number,
    ]),
  );

  const linesDir = path.join(cwd, "public", "projects", slug, "lines");
  fs.mkdirSync(linesDir, { recursive: true });

  const results = new Map<string, VoiceResult>();
  let generated = 0;
  let skipped = 0;

  for (const line of timeline.lines) {
    const speaker = speakers.get(line.id) as number;

    const wavPath = path.join(linesDir, `${line.id}.wav`);
    const lipsyncPath = path.join(linesDir, `${line.id}.lipsync.json`);
    const voiceMetaPath = path.join(linesDir, `${line.id}.voice.json`);
    const reading = readingText(line.text);
    const audio = `projects/${slug}/lines/${line.id}.wav`;
    const lipsync = `projects/${slug}/lines/${line.id}.lipsync.json`;

    const meta = readVoiceMeta(voiceMetaPath);
    const skippableMeta = force
      ? undefined
      : resolveSkippableMeta({ meta, wavPath, lipsyncPath, reading, speaker });

    if (skippableMeta) {
      results.set(line.id, {
        audio,
        lipsync,
        duration: skippableMeta.duration,
      });
      console.log(`skip: ${line.id}`);
      skipped++;
      continue;
    }

    const query = await fetchAudioQuery(
      fetchImpl,
      voicevoxUrl,
      reading,
      speaker,
    );
    const wav = await fetchSynthesis(fetchImpl, voicevoxUrl, query, speaker);

    const generatedLipsync = queryToLipsync(query);
    const duration = Math.round(wavDurationSeconds(wav) * 1000) / 1000;

    // query 全体の長さ (postPhonemeLength を含む) と wav の実尺のずれが 1
    // フレーム分を超える場合、口パクと音声がフレーム単位でずれて見えるため
    // 警告する。
    const driftSeconds = Math.abs(queryTotalSeconds(query) - duration);

    if (!Number.isFinite(driftSeconds)) {
      throw new Error(
        `mora 合計と wav の実尺の差を計算できませんでした (NaN): ${line.id}`,
      );
    }

    if (driftSeconds > 1 / timeline.meta.fps) {
      console.error(
        `warn: ${line.id}: mora 合計と wav の実尺の差が ${Math.round(driftSeconds * 1000)} ms`,
      );
    }

    fs.writeFileSync(wavPath, wav);
    fs.writeFileSync(
      lipsyncPath,
      JSON.stringify(generatedLipsync, null, 2) + "\n",
    );
    fs.writeFileSync(
      voiceMetaPath,
      JSON.stringify(
        {
          text: line.text,
          reading,
          speaker,
          duration,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );

    results.set(line.id, { audio, lipsync, duration });

    console.log(`generate: ${line.id}`);
    generated++;
  }

  if (results.size > 0) {
    // 生成中に timeline.json が手編集されている可能性があるため、書き戻し
    // 直前に読み直してから適用する (起動時に読んだ raw は使わない)。
    const currentRaw = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
    const updated = applyVoiceResults(currentRaw, results) as {
      lines?: unknown;
    };

    // 書き込みより前に検証する。失敗したら timeline.json は書き換えず、
    // 元の内容のまま残す (duration 等は各 line の
    // public/projects/<slug>/lines/<id>.voice.json に残っているため失われない)。
    const validated = timelineSchema.safeParse(updated);

    if (!validated.success) {
      throw new Error(
        "timeline.json への書き戻し後の検証に失敗しました (timeline.json は書き換えていません)。" +
          "再生成した行の wav・lipsync.json・voice.json は新しい text を反映済みですが、" +
          "timeline.json の duration は前回のままです。" +
          "lines の start を直して `npm run voice -- <slug>` を再実行すると、" +
          `生成済みの行は合成せずに duration を書き戻します。\n${formatWriteBackIssues(updated.lines, validated.error)}`,
      );
    }

    // 書き込み中のクラッシュ・強制終了で timeline.json が壊れないよう、一時
    // ファイルに書いてから rename で置き換える (POSIX の rename はアトミック)。
    const tmpPath = `${timelinePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + "\n");
    fs.renameSync(tmpPath, timelinePath);
  }

  console.log(`generated: ${generated}, skipped: ${skipped}`);

  return { generated, skipped };
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slug = args.find((arg) => arg !== "--force");

  if (!slug) {
    console.error("usage: npm run voice -- <slug> [--force]");
    process.exit(1);
  }

  if (!SLUG_PATTERN.test(slug)) {
    console.error(
      `error: slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: ${slug}`,
    );
    process.exit(1);
  }

  const voicevoxUrl = process.env.VOICEVOX_URL;

  if (!voicevoxUrl) {
    console.error("VOICEVOX_URL を設定してください (例: http://ceres:50021)");
    process.exit(1);
  }

  await run({ slug, force, voicevoxUrl, cwd: process.cwd() });
};

// tsx で直接実行されたときだけ main を呼ぶ (テストからの import では呼ばない)。
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
