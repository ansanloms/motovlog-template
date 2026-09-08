import { describe, expect, it } from "vitest";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "./frames.ts";

describe("secondsToFrames", () => {
  it("四捨五入でフレーム数に丸める", () => {
    expect(secondsToFrames(1, 30)).toBe(30);
    expect(secondsToFrames(0.5, 30)).toBe(15);
    // 0.0166... * 30 = 0.5 -> 四捨五入で 1。
    expect(secondsToFrames(1 / 60, 30)).toBe(1);
  });
});

describe("toFrameSpan", () => {
  it("隣接する 2 区間 (前の終端 = 次の開始) にフレーム上の隙間・重複が無い", () => {
    // fps=30 のとき 1/3 秒はどちらの端で丸めても端数が出る値。
    const first = toFrameSpan(0, 1 / 3, 30);
    const second = toFrameSpan(1 / 3, 1 / 3, 30);

    expect(second.from).toBe(first.from + first.durationInFrames);
  });

  it("素朴な丸め (Math.round(duration * fps)) と結果が分かれる値でも隙間・重複が無い", () => {
    // 終端基準の丸めでは区間は [2, 3) で durationInFrames=1。開始と終了を
    // 個別に丸める素朴な実装では durationInFrames=2 になり、次の区間
    // (from=3) と重なる。
    const first = toFrameSpan(0.05, 0.05, 30);

    expect(first).toEqual({ from: 2, durationInFrames: 1 });

    const second = toFrameSpan(0.1, 0.05, 30);

    expect(second.from).toBe(first.from + first.durationInFrames);
  });

  it("durationInFrames は 1 以上になる", () => {
    // start と end が同一フレームに丸められる極小区間。
    const span = toFrameSpan(0, 0.0001, 30);

    expect(span.durationInFrames).toBeGreaterThanOrEqual(1);
  });
});

describe("fadeEnvelope", () => {
  it("fadeInFrames=0 のとき frame=0 で peak に達する", () => {
    const value = fadeEnvelope({
      frame: 0,
      durationInFrames: 10,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });

    expect(value).toBe(1);
  });

  it("fadeInFrames > 0 のとき frame=0 で 0 になる", () => {
    const value = fadeEnvelope({
      frame: 0,
      durationInFrames: 10,
      fadeInFrames: 5,
      fadeOutFrames: 0,
    });

    expect(value).toBe(0);
  });

  it("fadeOutFrames > 0 のとき frame=durationInFrames-1 で 0 になる", () => {
    const value = fadeEnvelope({
      frame: 9,
      durationInFrames: 10,
      fadeInFrames: 0,
      fadeOutFrames: 5,
    });

    expect(value).toBe(0);
  });

  it("peak を指定すると中間フレームでその値になる", () => {
    const value = fadeEnvelope({
      frame: 5,
      durationInFrames: 10,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      peak: 0.5,
    });

    expect(value).toBe(0.5);
  });
});
