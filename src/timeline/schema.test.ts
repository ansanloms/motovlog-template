import { describe, expect, it } from "vitest";
import {
  defineTimeline,
  mergeVoice,
  timelineSchema,
  voicedTimelineSchema,
  voiceSchema,
} from "./schema";

const minimalClips = [{ src: "clip1.mp4", duration: 1 }];

describe("version", () => {
  it("省略時は 1 になる", () => {
    const parsed = timelineSchema.parse({ clips: minimalClips });

    expect(parsed.version).toBe(1);
  });

  it("2 は拒否する", () => {
    const result = timelineSchema.safeParse({
      version: 2,
      clips: minimalClips,
    });

    expect(result.success).toBe(false);
  });
});

describe("clips", () => {
  it("先頭クリップの crossfadeIn != 0 を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: [{ src: "clip1.mp4", duration: 1, crossfadeIn: 0.5 }],
    });

    expect(result.success).toBe(false);
  });

  it("gapBefore と crossfadeIn の同時指定を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: [
        { src: "clip1.mp4", duration: 1 },
        {
          src: "clip2.mp4",
          duration: 1,
          gapBefore: 1,
          crossfadeIn: 0.5,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("crossfadeIn が直前クリップの露出長 (duration - crossfadeIn) を超える指定を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: [
        { src: "clip1.mp4", duration: 1 },
        { src: "clip2.mp4", duration: 5, crossfadeIn: 2 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("crossfadeIn が自クリップの duration を超える指定を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: [
        // 露出長は十分に大きいので、この検証にだけ引っかかるようにする。
        { src: "clip1.mp4", duration: 5 },
        { src: "clip2.mp4", duration: 1, crossfadeIn: 2 },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("lines", () => {
  it("id の重複を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        { id: "line1", start: 0, text: "a" },
        { id: "line1", start: 2, text: "b" },
      ],
    });

    expect(result.success).toBe(false);
  });
});

// 区間の重なり検証は audio・duration を合成した後 (voicedTimelineSchema) で
// 行う。timeline.ts 単体では duration が定まらないため対象外
// (ADR-0006、schema.ts の checkLineOverlaps 参照)。
describe("voicedTimelineSchema (lines の重なり検証)", () => {
  it("start の重なりを拒否する", () => {
    const result = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        { id: "line1", audio: "line1.wav", start: 0, duration: 1, text: "a" },
        {
          id: "line2",
          audio: "line2.wav",
          start: 0.5,
          duration: 1,
          text: "b",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("隣接 (next.start === prev.start + prev.duration) は許可する", () => {
    const result = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        { id: "line1", audio: "line1.wav", start: 0, duration: 1, text: "a" },
        { id: "line2", audio: "line2.wav", start: 1, duration: 1, text: "b" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("id の重複を拒否する", () => {
    const result = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        { id: "line1", audio: "line1.wav", start: 0, duration: 1, text: "a" },
        { id: "line1", audio: "line2.wav", start: 2, duration: 1, text: "b" },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("overlays", () => {
  it("image の overlay で volume を指定すると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      overlays: [
        {
          kind: "image",
          src: "photo.png",
          start: 0,
          duration: 1,
          volume: 0.5,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("ending", () => {
  it("credits.start が fadeToBlackStart より前だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        fadeToBlackStart: 5,
        credits: {
          text: "credits",
          start: 2,
          duration: 1,
        },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("default 値の補完", () => {
  it("meta・subtitleTail 等の省略項目を default で補完する", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      lines: [{ id: "line1", start: 0, text: "a" }],
    });

    expect(parsed.meta).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(parsed.lines[0].subtitleTail).toBe(0.4);
    expect(parsed.overlays).toEqual([]);
    expect(parsed.bgm).toEqual([]);
    expect(parsed.subtitleBands).toEqual([]);
    expect(parsed.characterSegments).toEqual([]);
    expect(parsed.ending).toBeUndefined();
    expect(parsed.style.subtitle.fontSize).toBe(40);
    expect(parsed.style.band.color).toBe("#262672");
  });
});

describe("voiceSchema", () => {
  it("version・lines を検証する", () => {
    const result = voiceSchema.safeParse({
      version: 1,
      lines: {
        line1: { audio: "line1.wav", duration: 1.5 },
      },
    });

    expect(result.success).toBe(true);
  });

  it("looseObject なので line エントリの余分なキーも通る (speaker・lipsync 等)", () => {
    const result = voiceSchema.safeParse({
      version: 1,
      lines: {
        line1: {
          audio: "line1.wav",
          duration: 1.5,
          speaker: 3,
          generatedAt: "2026-09-07T00:00:00Z",
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("mergeVoice", () => {
  const timeline = timelineSchema.parse({
    clips: minimalClips,
    lines: [
      { id: "line1", start: 0, text: "a" },
      { id: "line2", start: 2, text: "b" },
    ],
  });

  it("id で timeline の line に voice の audio・duration を合成する", () => {
    const voice = voiceSchema.parse({
      version: 1,
      lines: {
        line1: { audio: "line1.wav", duration: 1 },
        line2: { audio: "line2.wav", duration: 1 },
      },
    });

    const merged = mergeVoice(timeline, voice, "20260817-jododaira");

    expect(merged.lines[0]).toMatchObject({
      id: "line1",
      audio: "line1.wav",
      duration: 1,
    });
    expect(merged.lines[1]).toMatchObject({
      id: "line2",
      audio: "line2.wav",
      duration: 1,
    });
  });

  it("voice に無い id があるとエラーになり、id と slug がメッセージに含まれる", () => {
    const voice = voiceSchema.parse({
      version: 1,
      lines: {
        line1: { audio: "line1.wav", duration: 1 },
      },
    });

    let thrown: unknown;
    try {
      mergeVoice(timeline, voice, "20260817-jododaira");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("line2");
    expect((thrown as Error).message).toContain("20260817-jododaira");
  });

  it("id が Object.prototype 由来のプロパティ名 (toString) でも、voice に無ければ未生成のエラーになる", () => {
    const timelineWithToString = timelineSchema.parse({
      clips: minimalClips,
      lines: [{ id: "toString", start: 0, text: "a" }],
    });
    const voice = voiceSchema.parse({ version: 1, lines: {} });

    expect(() =>
      mergeVoice(timelineWithToString, voice, "20260817-jododaira"),
    ).toThrow(/音声が未生成です/);
  });

  it("voice にだけある id は無視する", () => {
    const voice = voiceSchema.parse({
      version: 1,
      lines: {
        line1: { audio: "line1.wav", duration: 1 },
        line2: { audio: "line2.wav", duration: 1 },
        extra: { audio: "extra.wav", duration: 1 },
      },
    });

    const merged = mergeVoice(timeline, voice, "20260817-jododaira");

    expect(merged.lines.map((line) => line.id)).toEqual(["line1", "line2"]);
  });
});

describe("defineTimeline", () => {
  it("入力をそのまま返す (parse はしない)", () => {
    const input = { clips: minimalClips };

    expect(defineTimeline(input)).toBe(input);
  });
});
