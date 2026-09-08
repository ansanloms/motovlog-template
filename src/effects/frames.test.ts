import { describe, expect, it } from "vitest";
import { fadeOpacity, toFrameSpan } from "./frames.ts";

describe("toFrameSpan", () => {
  it("開始と尺を fps でフレーム化する", () => {
    expect(toFrameSpan(1, 2, 30)).toEqual({ from: 30, durationInFrames: 60 });
  });

  it("終端基準で丸める (隣接区間の隙間/重複を防ぐ)", () => {
    const span = toFrameSpan(1 / 3, 1 / 3, 30);
    expect(span.from).toBe(10);
    expect(span.durationInFrames).toBe(10);
  });

  it("最小 1 フレームを保証する", () => {
    expect(toFrameSpan(0, 0, 30).durationInFrames).toBe(1);
  });
});

describe("fadeOpacity", () => {
  it("in/out が 0 なら常に 1", () => {
    expect(
      fadeOpacity({
        frame: 0,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 0,
      }),
    ).toBe(1);
    expect(
      fadeOpacity({
        frame: 9,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 0,
      }),
    ).toBe(1);
  });

  it("in 区間は最初のフレームが 1/inFrames、inFrames 番目で 1", () => {
    expect(
      fadeOpacity({
        frame: 0,
        durationInFrames: 10,
        inFrames: 4,
        outFrames: 0,
      }),
    ).toBe(0.25);
    expect(
      fadeOpacity({
        frame: 2,
        durationInFrames: 10,
        inFrames: 4,
        outFrames: 0,
      }),
    ).toBe(0.75);
    expect(
      fadeOpacity({
        frame: 3,
        durationInFrames: 10,
        inFrames: 4,
        outFrames: 0,
      }),
    ).toBe(1);
  });

  it("out 区間は最後のフレームが 1/outFrames", () => {
    expect(
      fadeOpacity({
        frame: 9,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 4,
      }),
    ).toBe(0.25);
    expect(
      fadeOpacity({
        frame: 7,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 4,
      }),
    ).toBe(0.75);
  });

  it("in と out が重なる区間は min 側が効く", () => {
    expect(
      fadeOpacity({
        frame: 5,
        durationInFrames: 10,
        inFrames: 6,
        outFrames: 6,
      }),
    ).toBeLessThan(1);
  });

  it("Sequence の範囲内 (frame=inFrames-1) では 1 になる", () => {
    expect(
      fadeOpacity({
        frame: 7,
        durationInFrames: 15,
        inFrames: 8,
        outFrames: 8,
      }),
    ).toBe(1);
  });

  it("durationInFrames=1, inFrames=1, outFrames=0 のとき frame 0 で 1", () => {
    expect(
      fadeOpacity({
        frame: 0,
        durationInFrames: 1,
        inFrames: 1,
        outFrames: 0,
      }),
    ).toBe(1);
  });

  it("inFrames=12 のとき frame 0 が 1/12、frame 11 が 1", () => {
    expect(
      fadeOpacity({
        frame: 0,
        durationInFrames: 20,
        inFrames: 12,
        outFrames: 0,
      }),
    ).toBeCloseTo(1 / 12);
    expect(
      fadeOpacity({
        frame: 11,
        durationInFrames: 20,
        inFrames: 12,
        outFrames: 0,
      }),
    ).toBe(1);
  });
});
