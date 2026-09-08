import { describe, expect, it } from "vitest";
import { formatDateRange, formatRidingTime } from "./endingFormat.ts";

const zdt = (iso: string) => Temporal.ZonedDateTime.from(iso);

describe("formatDateRange", () => {
  it("単一日 (from と to の暦日が同じ)", () => {
    const result = formatDateRange({
      from: zdt("2026-01-01T00:00[Asia/Tokyo]"),
      to: zdt("2026-01-01T00:00[Asia/Tokyo]"),
    });

    expect(result).toBe("2026.01.01");
  });

  it("同一年月 (to の日は 0 埋めしない)", () => {
    const result = formatDateRange({
      from: zdt("2026-01-01T00:00[Asia/Tokyo]"),
      to: zdt("2026-01-03T00:00[Asia/Tokyo]"),
    });

    expect(result).toBe("2026.01.01-3");
  });

  it("同一年 (月が異なる)", () => {
    const result = formatDateRange({
      from: zdt("2026-01-31T00:00[Asia/Tokyo]"),
      to: zdt("2026-02-03T00:00[Asia/Tokyo]"),
    });

    expect(result).toBe("2026.01.31-02.03");
  });

  it("それ以外 (年が異なる)", () => {
    const result = formatDateRange({
      from: zdt("2026-12-31T00:00[Asia/Tokyo]"),
      to: zdt("2027-01-03T00:00[Asia/Tokyo]"),
    });

    expect(result).toBe("2026.12.31-2027.01.03");
  });
});

describe("formatRidingTime", () => {
  it("1 時間 12 分", () => {
    const result = formatRidingTime(
      Temporal.Duration.from({ hours: 1, minutes: 12 }),
    );

    expect(result).toBe("1:12");
  });

  it("24 時間超 (25 時間 5 分)", () => {
    const result = formatRidingTime(
      Temporal.Duration.from({ hours: 25, minutes: 5 }),
    );

    expect(result).toBe("25:05");
  });

  it("5 分 (0 時間)", () => {
    const result = formatRidingTime(Temporal.Duration.from({ minutes: 5 }));

    expect(result).toBe("0:05");
  });

  it("P1D (日単位の Duration も時に換算する)", () => {
    const result = formatRidingTime(Temporal.Duration.from("P1D"));

    expect(result).toBe("24:00");
  });
});
