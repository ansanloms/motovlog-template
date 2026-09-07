import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AudioQuery } from "../src/timeline/lipsync";
import { applyVoiceResults, run } from "./voicevox-lines";

const SLUG = "20260101-test";
const VOICEVOX_URL = "http://voicevox.example";

const uint32le = (value: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
};

// 24kHz・16bit・mono の wav を組み立てる。
const buildWav = (durationSeconds: number): Buffer => {
  const sampleRate = 24000;
  const blockAlign = 2; // mono・16bit
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.round(sampleRate * durationSeconds) * blockAlign;

  const fmtChunkData = Buffer.alloc(16);
  fmtChunkData.writeUInt16LE(1, 0); // AudioFormat = PCM
  fmtChunkData.writeUInt16LE(1, 2); // channels
  fmtChunkData.writeUInt32LE(sampleRate, 4);
  fmtChunkData.writeUInt32LE(byteRate, 8);
  fmtChunkData.writeUInt16LE(blockAlign, 12);
  fmtChunkData.writeUInt16LE(16, 14); // bitsPerSample

  const fmtChunk = Buffer.concat([
    Buffer.from("fmt "),
    uint32le(fmtChunkData.length),
    fmtChunkData,
  ]);
  const dataChunk = Buffer.concat([
    Buffer.from("data"),
    uint32le(dataSize),
    Buffer.alloc(dataSize),
  ]);
  const middle = Buffer.concat([fmtChunk, dataChunk]);

  return Buffer.concat([
    Buffer.from("RIFF"),
    uint32le(4 + middle.length),
    Buffer.from("WAVE"),
    middle,
  ]);
};

// wav・query は常に 0.1 秒分に固定する (テストの重なり判定を単純にするため)。
const WAV_DURATION_SECONDS = 0.1;
const wav = buildWav(WAV_DURATION_SECONDS);

const fixedQuery: AudioQuery = {
  accent_phrases: [
    {
      moras: [
        {
          consonant: null,
          consonant_length: null,
          vowel: "a",
          vowel_length: WAV_DURATION_SECONDS,
          pitch: 5.0,
        },
      ],
      pause_mora: null,
    },
  ],
  speedScale: 1,
  prePhonemeLength: 0,
  postPhonemeLength: 0,
};

const fakeFetch: typeof fetch = (async (
  input: RequestInfo | URL,
): Promise<Response> => {
  const url = String(input);

  if (url.includes("/audio_query")) {
    return new Response(JSON.stringify(fixedQuery), { status: 200 });
  }

  if (url.includes("/synthesis")) {
    return new Response(new Uint8Array(wav), { status: 200 });
  }

  throw new Error(`unexpected fetch url: ${url}`);
}) as typeof fetch;

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "voicevox-lines-test-"));
  fs.mkdirSync(path.join(cwd, "projects", SLUG), { recursive: true });
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

const timelinePath = (): string =>
  path.join(cwd, "projects", SLUG, "timeline.json");

const writeTimeline = (timeline: unknown): void => {
  fs.writeFileSync(timelinePath(), JSON.stringify(timeline, null, 2) + "\n");
};

const readTimeline = (): {
  lines: Array<Record<string, unknown>>;
  [key: string]: unknown;
} => JSON.parse(fs.readFileSync(timelinePath(), "utf-8"));

const runVoice = (force = false): ReturnType<typeof run> =>
  run({
    slug: SLUG,
    force,
    voicevoxUrl: VOICEVOX_URL,
    cwd,
    fetchImpl: fakeFetch,
  });

describe("run", () => {
  it("(a) 生成し、audio・lipsync・duration を書き戻す", async () => {
    writeTimeline({
      clips: [{ src: "clip1.mp4", duration: 10 }],
      voice: { speaker: 13 },
      lines: [
        { id: "l1", start: 1, text: "こんにちは" },
        { id: "l2", start: 5, text: "またね" },
      ],
    });

    const result = await runVoice();

    expect(result).toEqual({ generated: 2, skipped: 0 });

    const timeline = readTimeline();
    expect(timeline.lines[0].audio).toBe(`projects/${SLUG}/lines/l1.wav`);
    expect(timeline.lines[0].lipsync).toBe(
      `projects/${SLUG}/lines/l1.lipsync.json`,
    );
    expect(timeline.lines[0].duration).toBeCloseTo(WAV_DURATION_SECONDS, 5);

    const linesDir = path.join(cwd, "public", "projects", SLUG, "lines");
    expect(fs.existsSync(path.join(linesDir, "l1.wav"))).toBe(true);
    expect(fs.existsSync(path.join(linesDir, "l1.lipsync.json"))).toBe(true);
    expect(fs.existsSync(path.join(linesDir, "l1.voice.json"))).toBe(true);
  });

  it("(b) 2 回目は skip するが、audio・lipsync・duration の書き戻しは揃う", async () => {
    writeTimeline({
      clips: [{ src: "clip1.mp4", duration: 10 }],
      voice: { speaker: 13 },
      lines: [
        { id: "l1", start: 1, text: "こんにちは" },
        { id: "l2", start: 5, text: "またね" },
      ],
    });

    await runVoice();

    // 生成済みの wav・lipsync・voice.json は残したまま、timeline.json 側の
    // 書き戻し内容だけを手で消す (書き戻しが再度行われることを確認するため)。
    const afterFirst = readTimeline();
    for (const line of afterFirst.lines) {
      delete line.audio;
      delete line.lipsync;
      delete line.duration;
    }
    writeTimeline(afterFirst);

    const result = await runVoice();

    expect(result).toEqual({ generated: 0, skipped: 2 });

    const timeline = readTimeline();
    for (const line of timeline.lines) {
      expect(line.audio).toBe(`projects/${SLUG}/lines/${line.id}.wav`);
      expect(line.lipsync).toBe(
        `projects/${SLUG}/lines/${line.id}.lipsync.json`,
      );
      expect(line.duration).toBeCloseTo(WAV_DURATION_SECONDS, 5);
    }
  });

  it("(c) 書き戻し後に重なりが生まれると、timeline.json を書き換えずにエラーを投げる", async () => {
    writeTimeline({
      clips: [{ src: "clip1.mp4", duration: 10 }],
      voice: { speaker: 13 },
      lines: [
        { id: "l1", start: 1, text: "あ" },
        // duration は 0.1 秒に固定されるため、start の差が 0.1 未満だと重なる。
        { id: "l2", start: 1.05, text: "い" },
      ],
    });

    await expect(runVoice()).rejects.toThrow(/l2: start を調整してください/);

    // 検証に失敗した場合、timeline.json は書き換えない。
    const timeline = readTimeline();
    expect(timeline.lines[1].duration).toBeUndefined();

    // duration は事実なので、public/projects/<slug>/lines/l2.voice.json には
    // 残っている (失われない)。
    const voiceMetaPath = path.join(
      cwd,
      "public",
      "projects",
      SLUG,
      "lines",
      "l2.voice.json",
    );
    const voiceMeta = JSON.parse(fs.readFileSync(voiceMetaPath, "utf-8"));
    expect(voiceMeta.duration).toBeCloseTo(WAV_DURATION_SECONDS, 5);
  });
});

describe("applyVoiceResults", () => {
  it("対象外の line・他のフィールドと順序を保つ", () => {
    const timelineJson = {
      version: 1,
      meta: { fps: 30 },
      clips: [{ src: "clip1.mp4", duration: 10 }],
      lines: [
        { id: "l1", start: 1, text: "あ", subtitleTail: 0.4 },
        { id: "l2", start: 2, text: "い" },
      ],
    };

    const results = new Map([
      ["l1", { audio: "a.wav", lipsync: "a.json", duration: 1.23 }],
    ]);

    const updated = applyVoiceResults(timelineJson, results) as {
      lines: Array<Record<string, unknown>>;
      clips: unknown;
    };

    expect(Object.keys(updated.lines[0])).toEqual([
      "id",
      "start",
      "text",
      "subtitleTail",
      "audio",
      "lipsync",
      "duration",
    ]);
    expect(updated.lines[1]).toEqual({ id: "l2", start: 2, text: "い" });
    expect(updated.clips).toEqual(timelineJson.clips);

    // 入力は変更せず、書き戻した内容のクローンを返す。
    expect(timelineJson.lines[0]).not.toHaveProperty("audio");
  });
});
