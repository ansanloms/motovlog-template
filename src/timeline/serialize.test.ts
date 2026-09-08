import { describe, expect, it } from "vitest";
import { timelineSchema } from "./schema.ts";
import { serializeTimeline } from "./serialize.ts";

const minimalClips = [{ src: "clip1.mp4", duration: 1 }];

describe("serializeTimeline", () => {
  it("ending が無ければそのまま返す", () => {
    const timeline = timelineSchema.parse({ clips: minimalClips });
    const serialized = serializeTimeline(timeline);

    expect(serialized.ending).toBeUndefined();
  });

  it("ending.date・ridingTime を ISO 文字列にし、Temporal.from() で元の値と一致する (往復確認)", () => {
    const from = Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]");
    const to = Temporal.ZonedDateTime.from("2026-08-03T00:00[Asia/Tokyo]");
    const ridingTime = Temporal.Duration.from({ hours: 1, minutes: 12 });

    const timeline = timelineSchema.parse({
      clips: minimalClips,
      ending: {
        subtitle: "EP.1 / 福島",
        start: 10,
        date: { from, to },
        distance: 48,
        ridingTime,
        routes: ["福島"],
      },
    });

    const serialized = serializeTimeline(timeline);

    expect(typeof serialized.ending?.date.from).toBe("string");
    expect(typeof serialized.ending?.date.to).toBe("string");
    expect(typeof serialized.ending?.ridingTime).toBe("string");

    expect(
      Temporal.ZonedDateTime.from(serialized.ending!.date.from).equals(from),
    ).toBe(true);
    expect(
      Temporal.ZonedDateTime.from(serialized.ending!.date.to).equals(to),
    ).toBe(true);
    expect(
      Temporal.Duration.from(serialized.ending!.ridingTime).total({
        unit: "minutes",
      }),
    ).toBe(ridingTime.total({ unit: "minutes" }));
  });
});
