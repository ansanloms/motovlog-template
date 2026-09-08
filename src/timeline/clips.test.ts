import { describe, expect, it } from "vitest";
import { resolveClipSpans } from "./clips.ts";
import type { Timeline } from "./schema.ts";

const clip = (
  overrides: Partial<Timeline["clips"][number]>,
): Timeline["clips"][number] => ({
  src: "clip.mp4",
  duration: 1,
  sourceFrom: 0,
  volume: 1,
  gapBefore: 0,
  crossfadeIn: 0,
  ...overrides,
});

describe("resolveClipSpans", () => {
  it("先頭クリップの start は gapBefore になる", () => {
    const spans = resolveClipSpans([clip({ duration: 3, gapBefore: 2 })]);

    expect(spans).toEqual([{ start: 2, end: 5 }]);
  });

  it("2 番目以降の start は 前の end + gapBefore - crossfadeIn になる (gapBefore)", () => {
    const spans = resolveClipSpans([
      clip({ duration: 3 }),
      clip({ duration: 2, gapBefore: 1 }),
    ]);

    // 前の end = 3。start = 3 + 1 - 0 = 4。
    expect(spans).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 6 },
    ]);
  });

  it("2 番目以降の start は 前の end + gapBefore - crossfadeIn になる (crossfadeIn)", () => {
    const spans = resolveClipSpans([
      clip({ duration: 3 }),
      clip({ duration: 2, crossfadeIn: 1 }),
    ]);

    // 前の end = 3。start = 3 + 0 - 1 = 2。
    expect(spans).toEqual([
      { start: 0, end: 3 },
      { start: 2, end: 4 },
    ]);
  });
});
