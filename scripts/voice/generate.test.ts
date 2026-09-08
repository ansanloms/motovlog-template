import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { linePath, voiceKey } from "../../src/voice/key.ts";
import { narrator } from "../../src/theme/index.ts";
import { generateMissing } from "./generate.ts";
import type { GenerateDeps } from "./generate.ts";

const PUBLIC_DIR = "/tmp/public";
const SLUG = "00000000-sample";

/** テストで使う wav・json の絶対パス (public/ + linePath()) を組む。 */
const cachePaths = (key: string): { wav: string; json: string } => {
  const rel = linePath(SLUG, key);

  return {
    wav: path.join(PUBLIC_DIR, `${rel}.wav`),
    json: path.join(PUBLIC_DIR, `${rel}.json`),
  };
};

// 24kHz・16bit・mono・N サンプルの無音 WAV バッファを組み立てる (wav.test.ts と同じ)。
const buildWav = (sampleCount: number): Buffer => {
  const sampleRate = 24000;
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;

  const fmtChunkData = Buffer.alloc(16);
  fmtChunkData.writeUInt16LE(1, 0);
  fmtChunkData.writeUInt16LE(1, 2);
  fmtChunkData.writeUInt32LE(sampleRate, 4);
  fmtChunkData.writeUInt32LE(byteRate, 8);
  fmtChunkData.writeUInt16LE(blockAlign, 12);
  fmtChunkData.writeUInt16LE(16, 14);

  const uint32le = (value: number): Buffer => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(value, 0);
    return b;
  };

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

const AUDIO_QUERY = {
  accent_phrases: [
    {
      moras: [
        {
          consonant: null,
          consonant_length: null,
          vowel: "a",
          vowel_length: 0.1,
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

const makeDeps = (
  overrides: Partial<GenerateDeps> & { existingKeys?: Set<string> } = {},
): GenerateDeps & {
  writes: Map<string, Buffer | string>;
  renames: [string, string][];
} => {
  const writes = new Map<string, Buffer | string>();
  const renames: [string, string][] = [];
  const existingKeys = overrides.existingKeys ?? new Set<string>();

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);

    if (url.includes("/speakers")) {
      return new Response(
        JSON.stringify([{ styles: [{ id: narrator.speaker }] }]),
        { status: 200 },
      );
    }

    if (url.includes("/audio_query")) {
      return new Response(JSON.stringify(AUDIO_QUERY), { status: 200 });
    }

    if (url.includes("/synthesis")) {
      // 0.1 秒 (2400 サンプル @ 24kHz) の wav。query の長さ (0.1 秒) と
      // 一致させ、警告が出ない基準ケースにする。
      return new Response(buildWav(2400), { status: 200 });
    }

    return new Response("not found", { status: 404 });
  };

  return {
    linesDir: path.join(PUBLIC_DIR, "projects", SLUG, "lines"),
    publicDir: PUBLIC_DIR,
    voicevoxUrl: "http://voicevox.example",
    fetchImpl,
    exists: (p) =>
      existingKeys.has(
        p
          .split("/")
          .pop()!
          .replace(/\.(wav|json)$/, ""),
      ),
    mkdir: () => {},
    writeFile: (p, data) => {
      writes.set(p, data);
    },
    rename: (from, to) => {
      renames.push([from, to]);
      const data = writes.get(from);
      if (data !== undefined) {
        writes.set(to, data);
        writes.delete(from);
      }
    },
    log: () => {},
    warn: () => {},
    now: () => "2026-09-08T00:00:00Z",
    ...overrides,
    writes,
    renames,
  } as GenerateDeps & {
    writes: Map<string, Buffer | string>;
    renames: [string, string][];
  };
};

describe("generateMissing", () => {
  it("wav・json が両方無ければ生成する", async () => {
    const deps = makeDeps();

    const result = await generateMissing(
      "00000000-sample",
      [{ text: "こんにちは" }],
      deps,
    );

    expect(result).toEqual({ generated: 1, skipped: 0 });

    const key = await voiceKey({ text: "こんにちは" });
    const { wav: wavPath, json: jsonPath } = cachePaths(key);
    expect(deps.writes.has(wavPath)).toBe(true);
    expect(deps.writes.has(jsonPath)).toBe(true);
    // json は tmp に書いてから rename している。
    expect(deps.renames).toEqual([[`${jsonPath}.tmp`, jsonPath]]);

    const written = JSON.parse(deps.writes.get(jsonPath) as string);
    expect(written.duration).toBeCloseTo(0.1, 6);
    expect(written.voice).toEqual(narrator);
  });

  it("wav・json が両方あれば skip する", async () => {
    const key = await voiceKey({ text: "こんにちは" });
    const deps = makeDeps({ existingKeys: new Set([key]) });

    const result = await generateMissing(
      "00000000-sample",
      [{ text: "こんにちは" }],
      deps,
    );

    expect(result).toEqual({ generated: 0, skipped: 1 });
    expect(deps.writes.size).toBe(0);
  });

  it("同じ speaker の複数行に対して /speakers を 1 度しか呼ばない", async () => {
    const deps = makeDeps();
    let speakerCalls = 0;
    const baseFetch = deps.fetchImpl;
    deps.fetchImpl = (async (input, init) => {
      if (String(input).includes("/speakers")) {
        speakerCalls++;
      }

      return baseFetch(input, init);
    }) as typeof fetch;

    await generateMissing(
      SLUG,
      [{ text: "こんにちは" }, { text: "さようなら" }],
      deps,
    );

    expect(speakerCalls).toBe(1);
  });

  it("skip される発話しか無ければ /speakers を呼ばない", async () => {
    const key1 = await voiceKey({ text: "こんにちは" });
    const key2 = await voiceKey({ text: "さようなら" });
    const deps = makeDeps({ existingKeys: new Set([key1, key2]) });
    let speakerCalls = 0;
    const baseFetch = deps.fetchImpl;
    deps.fetchImpl = (async (input, init) => {
      if (String(input).includes("/speakers")) {
        speakerCalls++;
      }

      return baseFetch(input, init);
    }) as typeof fetch;

    await generateMissing(
      SLUG,
      [{ text: "こんにちは" }, { text: "さようなら" }],
      deps,
    );

    expect(speakerCalls).toBe(0);
  });

  it("wav の実尺と mora 合計の差が 1 フレーム分を超えると warn する", async () => {
    const deps = makeDeps();
    // synthesis の wav を 0.2 秒 (query は 0.1 秒) にして差を作る。
    deps.fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/speakers")) {
        return new Response(
          JSON.stringify([{ styles: [{ id: narrator.speaker }] }]),
          { status: 200 },
        );
      }
      if (url.includes("/audio_query")) {
        return new Response(JSON.stringify(AUDIO_QUERY), { status: 200 });
      }
      if (url.includes("/synthesis")) {
        return new Response(buildWav(4800), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const warn = vi.fn();
    deps.warn = warn;

    await generateMissing("00000000-sample", [{ text: "こんにちは" }], deps);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/mora 合計と wav の実尺の差/);
  });

  it("speaker が /speakers に無ければ throw する", async () => {
    const deps = makeDeps();
    deps.fetchImpl = (async () =>
      new Response(JSON.stringify([{ styles: [{ id: 1 }] }]), {
        status: 200,
      })) as typeof fetch;

    await expect(
      generateMissing("00000000-sample", [{ text: "こんにちは" }], deps),
    ).rejects.toThrow(/speaker/);
  });
});
