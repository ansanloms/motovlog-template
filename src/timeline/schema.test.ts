import { describe, expect, it } from "vitest";
import { assertVoiced, timelineSchema } from "./schema";

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
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
        },
        {
          id: "line1",
          audio: "line2.wav",
          start: 2,
          duration: 1,
          text: "b",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("start の重なりを拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
        },
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
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
        },
        {
          id: "line2",
          audio: "line2.wav",
          start: 1,
          duration: 1,
          text: "b",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("speaker・lipsync を指定できる", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
          speaker: 13,
          lipsync: "projects/slug/lines/line1.lipsync.json",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("duration の省略は parse を通す", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "a",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("id に英数字・_・- 以外の文字が含まれると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line/1",
          start: 0,
          text: "a",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("id が英数字・_・- だけなら許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line_1-A",
          start: 0,
          text: "a",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("読み仮名の記法 {漢字|よみ} が閉じていない text を拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "今日は{浄土平|じょうどだいらまで行った。",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("読み仮名の記法として閉じていれば許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "本当に{浄土平|じょうどだいら}まで行くのか？",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("記法外の | は字幕の文字として許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "60|80 km/h",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("duration の無い line は重なり検証の対象外になる", () => {
    // line1 は duration 省略、line2 は line1 と start が重なるが、line1 に
    // duration が無いため検証をすり抜けて parse は通る。
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "a",
        },
        {
          id: "line2",
          audio: "line2.wav",
          start: 0,
          duration: 1,
          text: "b",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("voice", () => {
  it("トップレベルの voice.speaker を指定できる", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      voice: { speaker: 13 },
    });

    expect(result.success).toBe(true);
  });
});

describe("assertVoiced", () => {
  it("audio・duration が揃っていれば通す", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
        },
      ],
    });

    const voiced = assertVoiced(parsed);

    expect(voiced.lines[0].audio).toBe("line1.wav");
    expect(voiced.lines[0].duration).toBe(1);
  });

  it("duration が無い line があれば拒否する", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      lines: [
        {
          id: "line1",
          start: 0,
          text: "a",
        },
      ],
    });

    expect(() => assertVoiced(parsed)).toThrow(/line1/);
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
      lines: [
        {
          id: "line1",
          audio: "line1.wav",
          start: 0,
          duration: 1,
          text: "a",
        },
      ],
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
