import { describe, expect, it } from "vitest";
import { emitTimeline, formatTimeline } from "./emit.ts";
import type { TimelinePlan } from "./plan.ts";

const plan = (overrides: Partial<TimelinePlan> = {}): TimelinePlan => ({
  slug: "20260101-sample",
  character: "hero",
  videos: [
    {
      ref: "clip1",
      src: "A.mp4",
      trimBefore: 2,
      volume: [
        { at: 0, volume: 0 },
        { at: 1, volume: 0.5 },
        { at: 11, volume: 0.5 },
      ],
      at: 4.8,
      duration: 11,
      in: 0.5,
      out: 0,
    },
    {
      ref: "clip2",
      src: "B.mp4",
      trimBefore: 0,
      volume: 1,
      crossfadeIn: 1,
      at: 14.8,
      duration: 20,
      in: 0,
      out: 0,
    },
  ],
  scenes: [
    {
      kind: "opening",
      at: 0,
      photo: "photos/P1.jpg",
      badge: "#1",
      title: "タイトル",
    },
    { kind: "chapter", at: 5.4, title: "第 1 章", subtitle: "CHAPTER 1" },
    { kind: "photo", at: 12.8, duration: 2, photos: ["photos/P1.jpg"] },
    {
      kind: "ending",
      anchor: "clip2",
      ending: {
        title: "タイトル",
        subtitle: "EP.1",
        date: {
          from: "2026-01-01T00:00[Asia/Tokyo]",
          to: "2026-01-02T00:00[Asia/Tokyo]",
        },
        distance: 12.5,
        ridingTime: { hours: 1, minutes: 2 },
        routes: ["A", "B"],
        credits: [{ VOICEVOX: "話者" }],
      },
    },
  ],
  figures: [
    {
      at: 6.8,
      duration: 8,
      in: 0.4,
      out: 0,
      expression: "normal",
      side: "left",
    },
  ],
  audios: [
    {
      src: "assets/bgm/m1.wav",
      trimBefore: 0,
      volume: 0.2,
      at: 4.8,
      duration: 10,
    },
  ],
  frames: [
    { at: 0, duration: 0.4, in: 0.4, out: 0, opening: true },
    { at: 13.8, duration: 1, in: 0, out: 1 },
  ],
  narration: [
    { kind: "line", at: 7.8, text: "こんにちは", expression: "normal" },
    { kind: "subtitle", after: 1, duration: 1, text: "(声の無い字幕)" },
  ],
  skipped: [],
  warnings: [],
  ...overrides,
});

describe("emitTimeline", () => {
  const source = emitTimeline(plan());

  it("生成物であることを先頭に書く", () => {
    expect(source.startsWith("// このファイルは scripts/migrate/aup2 が")).toBe(
      true,
    );
  });

  it("lib の 5 入口から、使うものだけを import する", () => {
    expect(source).toContain(
      `import { hero } from "../../characters/hero.ts";`,
    );
    expect(source).toContain(
      `import { audio, chapter, ending, photoShowcase, video } from "../../src/components/index.tsx";`,
    );
    expect(source).toContain(
      `import { figure, line, narration, thumbnail } from "../../src/compositions/index.ts";`,
    );
    expect(source).toContain(
      `import { crossfade, cut, end, fade, frame, timeline } from "../../src/effects/index.ts";`,
    );
    expect(source).toContain(
      `import { chapterDurationSec, chapterTiming, endingTiming, openingTiming } from "../../src/theme/index.ts";`,
    );
    // 5 入口より下を直に見ない (ADR-0012)。
    expect(source).not.toContain("src/compositions/figure.ts");
    expect(source).not.toContain("src/compositions/narration.ts");
    expect(source).not.toContain("src/compositions/thumbnail.ts");
    expect(source).not.toContain("src/theme/timing.ts");
  });

  it("slug から asset() を組み立てる", () => {
    expect(source).toContain(
      "const asset = (path: string) => staticFile(`projects/20260101-sample/${path}`);",
    );
  });

  it("走行映像を const にし、フェードの有無で cut / fade を選ぶ", () => {
    expect(source).toContain(
      `const clip1 = fade(video({ src: asset("A.mp4"), trimBefore: 2, volume: [{ at: 0, volume: 0 }, { at: 1, volume: 0.5 }, { at: 11, volume: 0.5 }] }), { at: 4.8, duration: 11, in: 0.5 });`,
    );
    // crossfade の直後の item に at は書かない。
    expect(source).toContain(
      `const clip2 = cut(video({ src: asset("B.mp4"), trimBefore: 0, volume: 1 }), { duration: 20 });`,
    );
    expect(source).toContain("crossfade({ duration: 1 })");
  });

  it("OP・章タイトル・ED を theme の秒数で書く", () => {
    expect(source).toContain("duration: openingTiming.duration");
    expect(source).toContain(
      "duration: chapterDurationSec, in: chapterTiming.fade, out: chapterTiming.fade",
    );
    expect(source).toContain(
      "{ at: end(clip2, -endingTiming.duration), duration: endingTiming.duration }",
    );
    expect(source).toContain(
      `from: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Tokyo]"),`,
    );
    expect(source).toContain(
      "ridingTime: Temporal.Duration.from({ hours: 1, minutes: 2 }),",
    );
  });

  it("立ち絵に speech と左右を渡す", () => {
    expect(source).toContain(
      `fade(figure(hero, { expression: "normal", speech: n.speech, side: "left" }), { at: 6.8, duration: 8, in: 0.4 })`,
    );
  });

  it("発話と声の無い字幕を narration() に渡す", () => {
    expect(source).toContain(
      `cut(line({ text: "こんにちは", by: hero, expression: "normal" }), { at: 7.8 })`,
    );
    expect(source).toContain(
      `cut(line({ text: "(声の無い字幕)", voice: null }), { after: 1, duration: 1 })`,
    );
  });

  it("layer をサンプルと同じ順で並べる", () => {
    const order = [
      "// layer 0: 走行映像",
      "// layer 1: OP・章タイトル・写真紹介・ED",
      "// layer 2: 立ち絵",
      "// layer 3: BGM",
      "// layer 4: 下の layer の合成結果に掛ける黒からの立ち上がり・黒落ち",
      "...n.layers",
    ];

    expect(order.map((marker) => source.indexOf(marker))).toEqual(
      [...order.map((marker) => source.indexOf(marker))].sort((a, b) => a - b),
    );
    expect(order.every((marker) => source.includes(marker))).toBe(true);
  });

  it("使わない入口は import しない", () => {
    const source2 = emitTimeline(
      plan({ audios: [], figures: [], frames: [], narration: [] }),
    );

    expect(source2).not.toContain("audio");
    expect(source2).not.toContain("figure");
    expect(source2).not.toContain("frame(");
    expect(source2).not.toContain("narration");
  });

  it("発話が無ければ立ち絵に空の speech を渡す", () => {
    const source2 = emitTimeline(plan({ narration: [] }));

    // const n を書かないので n.speech は参照できない。
    expect(source2).not.toContain("const n = await narration");
    expect(source2).not.toContain("n.speech");
    expect(source2).toContain("speech: []");
  });
});

describe("formatTimeline", () => {
  it("prettier が読める TypeScript を吐く", async () => {
    const formatted = await formatTimeline(
      emitTimeline(plan()),
      "projects/20260101-sample/timeline.ts",
    );

    expect(formatted).toContain("export default timeline([");
    // 2 度整形しても変わらない (prettier の出力として安定している)。
    expect(
      await formatTimeline(formatted, "projects/20260101-sample/timeline.ts"),
    ).toBe(formatted);
  });
});
