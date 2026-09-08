import { describe, expect, it } from "vitest";
import { timelineSchema } from "./schema.ts";
import { chapterSpans, subtractSpans, thumbnailSpan } from "./spans.ts";

const minimalClips = [{ src: "clip1.mp4", duration: 1 }];

describe("chapterSpans", () => {
  it("start 順に並べ、1 始まりの番号を振る", () => {
    const spans = chapterSpans([
      { start: 10, title: "後半" },
      { start: 2, title: "前半" },
    ]);

    expect(
      spans.map((span) => ({ number: span.number, title: span.title })),
    ).toEqual([
      { number: 1, title: "前半" },
      { number: 2, title: "後半" },
    ]);
  });
});

describe("thumbnailSpan", () => {
  it("opening が無ければ null", () => {
    const timeline = timelineSchema.parse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 5,
        date: {
          from: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Tokyo]"),
        },
        distance: 1,
        ridingTime: Temporal.Duration.from({ minutes: 10 }),
        routes: ["a", "b"],
      },
    });

    expect(thumbnailSpan(timeline)).toBeNull();
  });

  it("opening と ending の両方があれば ED の後に置く", () => {
    const timeline = timelineSchema.parse({
      clips: minimalClips,
      opening: {
        photo: "photo.jpg",
        badge: "#1 福島",
        title: "title",
        character: "c.png",
      },
      ending: {
        subtitle: "EP.1 / 福島",
        start: 20,
        date: {
          from: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Tokyo]"),
        },
        distance: 1,
        ridingTime: Temporal.Duration.from({ minutes: 10 }),
        routes: ["a", "b"],
      },
    });

    expect(thumbnailSpan(timeline)).toEqual({ start: 32, duration: 4.8 });
  });
});

describe("subtractSpans", () => {
  it("断片化: 中央を抜くと前後 2 断片になる", () => {
    expect(
      subtractSpans([{ start: 0, duration: 10 }], [{ start: 4, duration: 2 }]),
    ).toEqual([
      { start: 0, duration: 4 },
      { start: 6, duration: 4 },
    ]);
  });

  it("先頭・末尾の切り詰め", () => {
    expect(
      subtractSpans(
        [{ start: 0, duration: 10 }],
        [
          { start: -1, duration: 2 }, // 先頭を切り詰め (0 -> 1)
          { start: 9, duration: 5 }, // 末尾を切り詰め (10 -> 9)
        ],
      ),
    ).toEqual([{ start: 1, duration: 8 }]);
  });

  it("完全に消える場合は空配列", () => {
    expect(
      subtractSpans([{ start: 2, duration: 3 }], [{ start: 0, duration: 10 }]),
    ).toEqual([]);
  });

  it("重ならない場合はそのまま返る", () => {
    expect(
      subtractSpans([{ start: 0, duration: 5 }], [{ start: 10, duration: 2 }]),
    ).toEqual([{ start: 0, duration: 5 }]);
  });

  it("hidden 同士の重なりは union として扱う", () => {
    // hidden が [4,7) と [6,9) で重なるので union は [4,9)。
    expect(
      subtractSpans(
        [{ start: 0, duration: 10 }],
        [
          { start: 4, duration: 3 },
          { start: 6, duration: 3 },
        ],
      ),
    ).toEqual([
      { start: 0, duration: 4 },
      { start: 9, duration: 1 },
    ]);
  });
});
