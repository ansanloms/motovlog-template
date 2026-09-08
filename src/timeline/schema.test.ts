import { describe, expect, it } from "vitest";
import {
  defineTimeline,
  mergeVoice,
  timelineSchema,
  voicedTimelineSchema,
  voiceSchema,
} from "./schema.ts";
import { serializeTimeline } from "./serialize.ts";

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

describe("characterSegments", () => {
  it("side を省略すると既定で left になる", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      characterSegments: [{ start: 0, duration: 1, src: "a.png" }],
    });

    expect(parsed.characterSegments[0].side).toBe("left");
  });

  it("src が無いと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      characterSegments: [{ start: 0, duration: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("表示区間が重なると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      characterSegments: [
        { start: 0, duration: 2, src: "a.png" },
        { start: 1, duration: 2, src: "b.png" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("隣接 (次の start === 前の終了) は許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      characterSegments: [
        { start: 0, duration: 2, src: "a.png" },
        { start: 2, duration: 2, src: "b.png" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("opening があるとき、OP の表示中 (start < 4.8) に始まると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      opening: {
        photo: "photo.jpg",
        badge: "#1 福島",
        title: "title",
        character: "c.png",
      },
      characterSegments: [{ start: 4, duration: 1, src: "a.png" }],
    });

    expect(result.success).toBe(false);
  });

  it("ending があるとき、ending.start より後まで表示が続くと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
        },
        distance: 48,
        ridingTime: Temporal.Duration.from({ hours: 1, minutes: 12 }),
        routes: ["福島"],
      },
      // start 9 + duration 2 = 11 > ending.start (10)
      characterSegments: [{ start: 9, duration: 2, src: "a.png" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("chapters", () => {
  it("表示区間の間隔 (2.4 秒) 未満で隣接すると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      chapters: [
        { start: 0, title: "a" },
        { start: 2.3, title: "b" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("表示区間の間隔がちょうど 2.4 秒なら許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      chapters: [
        { start: 0, title: "a" },
        { start: 2.4, title: "b" },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("notes", () => {
  it("表示区間が重なると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      notes: [
        { start: 0, duration: 2, text: "a" },
        { start: 1, duration: 2, text: "b" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("隣接 (次の start === 前の終了) は許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      notes: [
        { start: 0, duration: 2, text: "a" },
        { start: 2, duration: 2, text: "b" },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("photos", () => {
  it("表示区間が重なると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      photos: [
        { start: 0, duration: 2, src: ["a.jpg"] },
        { start: 1, duration: 2, src: ["b.jpg"] },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("src が 0 要素だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      photos: [{ start: 0, duration: 2, src: [] }],
    });

    expect(result.success).toBe(false);
  });

  it("src が 3 要素だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      photos: [{ start: 0, duration: 2, src: ["a.jpg", "b.jpg", "c.jpg"] }],
    });

    expect(result.success).toBe(false);
  });
});

describe("opening", () => {
  const opening = {
    photo: "photo.jpg",
    badge: "#1 福島",
    title: "title",
    character: "c.png",
  };

  it("badge が無いと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      opening: { photo: "photo.jpg", title: "title", character: "c.png" },
    });

    expect(result.success).toBe(false);
  });

  it("opening があるとき、chapters の start が openingTiming.duration (4.8 秒) 未満だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      opening,
      chapters: [{ start: 4, title: "a" }],
    });

    expect(result.success).toBe(false);
  });

  it("opening があるとき、chapters の start が 4.8 秒以上なら許可する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      opening,
      chapters: [{ start: 4.8, title: "a" }],
    });

    expect(result.success).toBe(true);
  });
});

describe("ending", () => {
  const validEnding = {
    subtitle: "EP.1 / 福島",
    start: 10,
    date: {
      from: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
      to: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
    },
    distance: 48,
    ridingTime: Temporal.Duration.from({ hours: 1, minutes: 12 }),
    routes: ["福島", "浄土平"],
  };

  it("必須項目 (start・subtitle・date・distance・ridingTime・routes) を満たせば通る", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: validEnding,
    });

    expect(result.success).toBe(true);
  });

  it("date・ridingTime は Temporal のインスタンスのまま保持される (ISO 文字列への変換は serializeTimeline が行う、ADR-0009)", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      ending: validEnding,
    });

    expect(parsed.ending?.date.from).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(parsed.ending?.date.to).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(parsed.ending?.ridingTime).toBeInstanceOf(Temporal.Duration);
  });

  it("date.from が Temporal.ZonedDateTime でない (文字列) と拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        date: { from: "2026-08-02", to: "2026-08-02" },
      },
    });

    expect(result.success).toBe(false);
  });

  it("ridingTime が Temporal.Duration でない (文字列) と拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: { ...validEnding, ridingTime: "1:12" },
    });

    expect(result.success).toBe(false);
  });

  it("date.from が date.to より後だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        date: {
          from: Temporal.ZonedDateTime.from("2026-08-03T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
        },
      },
    });

    expect(result.success).toBe(false);
  });

  // props 向け (serializedEndingSchema、ADR-0009) にも同じ検証をかける
  // (voicedTimelineSchema 経由)。
  it("props 向け (voicedTimelineSchema) でも date.from が date.to より後だと拒否する", () => {
    const result = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: Temporal.ZonedDateTime.from(
            "2026-08-03T00:00[Asia/Tokyo]",
          ).toString(),
          to: Temporal.ZonedDateTime.from(
            "2026-08-02T00:00[Asia/Tokyo]",
          ).toString(),
        },
        distance: 48,
        ridingTime: Temporal.Duration.from({
          hours: 1,
          minutes: 12,
        }).toString(),
        routes: ["福島"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("props 向けで date.from が不正な文字列のとき safeParse が success: false を返し、例外を投げない", () => {
    const result = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: "not-a-date",
          to: Temporal.ZonedDateTime.from(
            "2026-08-02T00:00[Asia/Tokyo]",
          ).toString(),
        },
        distance: 48,
        ridingTime: Temporal.Duration.from({
          hours: 1,
          minutes: 12,
        }).toString(),
        routes: ["福島"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("ridingTime に year を含むと拒否する (作者向け・props 向けとも)", () => {
    const author = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        ridingTime: Temporal.Duration.from({ years: 1 }),
      },
    });

    expect(author.success).toBe(false);

    const props = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: validEnding.date.from.toString(),
          to: validEnding.date.to.toString(),
        },
        distance: 48,
        ridingTime: "P1Y",
        routes: ["福島"],
      },
    });

    expect(props.success).toBe(false);
  });

  it("ridingTime に month を含むと拒否する (作者向け・props 向けとも)", () => {
    const author = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        ridingTime: Temporal.Duration.from({ months: 1 }),
      },
    });

    expect(author.success).toBe(false);

    const props = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: validEnding.date.from.toString(),
          to: validEnding.date.to.toString(),
        },
        distance: 48,
        ridingTime: "P1M",
        routes: ["福島"],
      },
    });

    expect(props.success).toBe(false);
  });

  it("ridingTime に week を含むと拒否する (作者向け・props 向けとも)", () => {
    const author = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        ridingTime: Temporal.Duration.from({ weeks: 1 }),
      },
    });

    expect(author.success).toBe(false);

    const props = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: validEnding.date.from.toString(),
          to: validEnding.date.to.toString(),
        },
        distance: 48,
        ridingTime: "P1W",
        routes: ["福島"],
      },
    });

    expect(props.success).toBe(false);
  });

  it("ridingTime が負の Duration だと拒否する (作者向け・props 向けとも)", () => {
    const author = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        ...validEnding,
        ridingTime: Temporal.Duration.from({ hours: -1 }),
      },
    });

    expect(author.success).toBe(false);

    const props = voicedTimelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: {
          from: validEnding.date.from.toString(),
          to: validEnding.date.to.toString(),
        },
        distance: 48,
        ridingTime: "-PT1H",
        routes: ["福島"],
      },
    });

    expect(props.success).toBe(false);
  });

  it("subtitle が無いと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: {
        start: 10,
        date: validEnding.date,
        distance: 48,
        ridingTime: validEnding.ridingTime,
        routes: ["福島", "浄土平"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("title を省略すると既定で RIDE LOG になる", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      ending: validEnding,
    });

    expect(parsed.ending?.title).toBe("RIDE LOG");
  });

  it("credits を省略すると既定で空配列になる", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      ending: validEnding,
    });

    expect(parsed.ending?.credits).toEqual([]);
  });

  it("routes が空配列だと拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: { ...validEnding, routes: [] },
    });

    expect(result.success).toBe(false);
  });

  it("chapters が ending.start より後まで表示されると拒否する", () => {
    const result = timelineSchema.safeParse({
      clips: minimalClips,
      ending: validEnding,
      // start 9 + chapterTitleDurationSec (2.4) = 11.4 > ending.start (10)
      chapters: [{ start: 9, title: "a" }],
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
    expect(parsed.characterSegments).toEqual([]);
    expect(parsed.chapters).toEqual([]);
    expect(parsed.notes).toEqual([]);
    expect(parsed.photos).toEqual([]);
    expect(parsed.ending).toBeUndefined();
  });

  // 見た目 (style) と手置きの帯 (subtitleBands) は schema から外した
  // (ADR-0007, ADR-0008)。zod の object は未知キーを捨てるため、これらを
  // 書いた既存の timeline.ts も parse は通り、結果にキーが残らない。
  // ただし defineTimeline の型検査では余分なキーとして弾かれる (TS2353)
  // ので、timeline.ts から書く場合は削除が要る。
  it("style・subtitleBands を書いても zod の parse は通り、結果にキーが残らない", () => {
    const parsed = timelineSchema.parse({
      clips: minimalClips,
      style: { subtitle: { fontSize: 40 } },
      subtitleBands: [{ start: 0, duration: 1 }],
    });

    expect("style" in parsed).toBe(false);
    expect("subtitleBands" in parsed).toBe(false);
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
  const timeline = serializeTimeline(
    timelineSchema.parse({
      clips: minimalClips,
      lines: [
        { id: "line1", start: 0, text: "a" },
        { id: "line2", start: 2, text: "b" },
      ],
    }),
  );

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
    const timelineWithToString = serializeTimeline(
      timelineSchema.parse({
        clips: minimalClips,
        lines: [{ id: "toString", start: 0, text: "a" }],
      }),
    );
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

  // 回帰確認 (ADR-0009): ending (Temporal のインスタンス) を持つ timeline を
  // timelineSchema.parse → serializeTimeline → mergeVoice と通しても、
  // voicedTimelineSchema の再検証 (ISO 文字列を期待する) で ZodError に
  // ならないこと。
  it("ending を持つ timeline を serializeTimeline 経由で渡すと mergeVoice を通る", () => {
    const from = Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]");
    const ridingTime = Temporal.Duration.from({ hours: 1, minutes: 12 });

    const withEnding = timelineSchema.parse({
      clips: minimalClips,
      lines: [{ id: "line1", start: 0, text: "a" }],
      ending: {
        subtitle: "EP.1 / 福島",
        start: 5,
        date: { from, to: from },
        distance: 48,
        ridingTime,
        routes: ["福島"],
      },
    });

    const voice = voiceSchema.parse({
      version: 1,
      lines: { line1: { audio: "line1.wav", duration: 1 } },
    });

    const merged = mergeVoice(
      serializeTimeline(withEnding),
      voice,
      "20260817-jododaira",
    );

    expect(typeof merged.ending?.date.from).toBe("string");
    expect(
      Temporal.ZonedDateTime.from(merged.ending!.date.from).equals(from),
    ).toBe(true);
    expect(
      Temporal.Duration.from(merged.ending!.ridingTime).total({
        unit: "minutes",
      }),
    ).toBe(ridingTime.total({ unit: "minutes" }));
  });
});

describe("defineTimeline", () => {
  it("入力をそのまま返す (parse はしない)", () => {
    const input = { clips: minimalClips };

    expect(defineTimeline(input)).toBe(input);
  });
});
