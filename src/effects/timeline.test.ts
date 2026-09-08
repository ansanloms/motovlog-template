import { describe, expect, it } from "vitest";
import { fps } from "../theme/timing.ts";
import { cut } from "./cut.ts";
import { fade } from "./fade.ts";
import { timeline } from "./timeline.ts";
import type { CutItem, FadeItem } from "./types.ts";

describe("timeline", () => {
  it("位置を省略すると同じ layer の直前の item の終端に連結する", () => {
    const result = timeline([
      [cut(null, { duration: 5 }), cut(null, { duration: 3 })],
    ]);

    expect(result.layers[0][0].at).toBe(0);
    expect(result.layers[0][1].at).toBe(5);
  });

  it("after は直前の item の終端からの相対秒で解決する", () => {
    const result = timeline([
      [cut(null, { duration: 5 }), cut(null, { duration: 3, after: 2 })],
    ]);

    expect(result.layers[0][1].at).toBe(7);
  });

  it("at は絶対秒で解決する", () => {
    const result = timeline([[cut(null, { duration: 5, at: 10 })]]);

    expect(result.layers[0][0].at).toBe(10);
  });

  it("layer 内で item が直前の item と重なると throw する", () => {
    expect(() =>
      timeline([
        [cut(null, { duration: 5 }), cut(null, { duration: 3, at: 2 })],
      ]),
    ).toThrow();
  });

  it("durationSec は layer を跨いだ (at + duration) の最大値", () => {
    const result = timeline([
      [cut(null, { duration: 5 })],
      [fade(null, { duration: 10 })],
    ]);

    expect(result.durationSec).toBe(10);
  });

  it("layers が空なら throw する", () => {
    expect(() => timeline([])).toThrow();
  });

  it("空の layer があれば throw する", () => {
    expect(() => timeline([[]])).toThrow();
  });

  it("fade の in + out が duration を超えるなら throw する", () => {
    expect(() => fade(null, { duration: 1, in: 0.6, out: 0.6 })).toThrow();
  });

  it("fade の in が NaN なら throw する", () => {
    expect(() => fade(null, { duration: 1, in: Number.NaN })).toThrow();
  });

  it("fade の out が負なら throw する", () => {
    expect(() => fade(null, { duration: 1, out: -1 })).toThrow();
  });

  it("at と after を同時に指定すると throw する (cut)", () => {
    const item = {
      kind: "cut",
      node: null,
      duration: 1,
      at: 1,
      after: 1,
    } as unknown as CutItem;

    expect(() => timeline([[item]])).toThrow();
  });

  it("at と after を同時に指定すると throw する (fade)", () => {
    const item = {
      kind: "fade",
      node: null,
      duration: 1,
      in: 0,
      out: 0,
      at: 1,
      after: 1,
    } as unknown as FadeItem;

    expect(() => timeline([[item]])).toThrow();
  });

  it("duration が NaN / 0 / 負なら throw する (cut)", () => {
    expect(() => timeline([[cut(null, { duration: Number.NaN })]])).toThrow();
    expect(() => timeline([[cut(null, { duration: 0 })]])).toThrow();
    expect(() => timeline([[cut(null, { duration: -1 })]])).toThrow();
  });

  it("duration が NaN / 0 / 負なら throw する (fade)", () => {
    expect(() => timeline([[fade(null, { duration: Number.NaN })]])).toThrow();
    expect(() => timeline([[fade(null, { duration: 0 })]])).toThrow();
    expect(() => timeline([[fade(null, { duration: -1 })]])).toThrow();
  });

  it("時間順でない絶対指定は throw する (cut)", () => {
    expect(() =>
      timeline([
        [cut(null, { duration: 5, at: 11 }), cut(null, { duration: 3, at: 0 })],
      ]),
    ).toThrowError(/時間順/);
  });

  it("時間順でない絶対指定は throw する (fade)", () => {
    expect(() =>
      timeline([
        [
          fade(null, { duration: 5, at: 11 }),
          fade(null, { duration: 3, at: 0 }),
        ],
      ]),
    ).toThrowError(/時間順/);
  });

  it("cursor の丸め誤差 (1.1 + 2.2) の直後に at 3.3 を指定しても通る (cut)", () => {
    const result = timeline([
      [
        cut(null, { duration: 1.1 }),
        cut(null, { duration: 2.2 }),
        cut(null, { duration: 1, at: 3.3 }),
      ],
    ]);

    expect(result.layers[0][2].at).toBe(3.3);
  });

  it("cursor の丸め誤差 (1.1 + 2.2) の直後に at 3.3 を指定しても通る (fade)", () => {
    const result = timeline([
      [
        fade(null, { duration: 1.1 }),
        fade(null, { duration: 2.2 }),
        fade(null, { duration: 1, at: 3.3 }),
      ],
    ]);

    expect(result.layers[0][2].at).toBe(3.3);
  });

  it("最初の item の after: 2 は at 2 になる (cut)", () => {
    const result = timeline([[cut(null, { duration: 1, after: 2 })]]);

    expect(result.layers[0][0].at).toBe(2);
  });

  it("最初の item の after: 2 は at 2 になる (fade)", () => {
    const result = timeline([[fade(null, { duration: 1, after: 2 })]]);

    expect(result.layers[0][0].at).toBe(2);
  });

  it("duration が 1 フレーム未満なら throw する", () => {
    expect(() => timeline([[cut(null, { duration: 0.3 / fps })]])).toThrowError(
      /1 フレームに満たません/,
    );
  });

  it("半フレームの item は位置によっては 1 フレームに満たず throw する", () => {
    expect(() =>
      timeline([[cut(null, { duration: 0.5 / fps, at: 0.6 / fps })]]),
    ).toThrowError(/1 フレームに満たません/);
  });

  it("同じ duration でも at: 0 なら throw しない", () => {
    expect(() =>
      timeline([[cut(null, { duration: 0.5 / fps, at: 0 })]]),
    ).not.toThrow();
  });
});
