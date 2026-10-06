import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  crossfadeGain,
  equalPowerGain,
  fadeGain,
  fadeOpacity,
  frameEffectsOpacity,
  toFrame,
  toFrameSpan,
  transitionFrames,
} from "./frames.ts";

describe("toFrame", () => {
  it("秒を fps でフレーム番号にする", () => {
    expect(toFrame(2, 30)).toBe(60);
  });

  it("フレーム境界の間は四捨五入する", () => {
    expect(toFrame(1 / 30 / 2, 30)).toBe(1);
    expect(toFrame(1 / 30 / 2 - 1e-9, 30)).toBe(0);
  });

  it("0 と負の秒もそのまま換算する", () => {
    expect(toFrame(0, 30)).toBe(0);
    expect(toFrame(-1, 30)).toBe(-30);
  });
});

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

describe("fadeGain", () => {
  it("in/out が 0 なら常に 1", () => {
    expect(
      fadeGain({ frame: 0, durationInFrames: 10, inFrames: 0, outFrames: 0 }),
    ).toBe(1);
    expect(
      fadeGain({ frame: 9, durationInFrames: 10, inFrames: 0, outFrames: 0 }),
    ).toBe(1);
  });

  it("in 区間の最初のフレームは 0、inFrames で 1", () => {
    expect(
      fadeGain({ frame: 0, durationInFrames: 10, inFrames: 4, outFrames: 0 }),
    ).toBe(0);
    expect(
      fadeGain({ frame: 4, durationInFrames: 10, inFrames: 4, outFrames: 0 }),
    ).toBe(1);
  });

  it("out 区間の最後のフレームは 0", () => {
    expect(
      fadeGain({ frame: 9, durationInFrames: 10, inFrames: 0, outFrames: 4 }),
    ).toBe(0);
  });

  it("中央のフレームは 1", () => {
    expect(
      fadeGain({ frame: 5, durationInFrames: 10, inFrames: 4, outFrames: 4 }),
    ).toBe(1);
  });

  it("in と out が重なる区間は min 側が効く", () => {
    expect(
      fadeGain({ frame: 5, durationInFrames: 10, inFrames: 6, outFrames: 6 }),
    ).toBeLessThan(1);
  });

  it("fadeOpacity との差は両端だけ (中央以降は同じ)", () => {
    const params = { durationInFrames: 10, inFrames: 4, outFrames: 4 };

    expect(fadeGain({ frame: 0, ...params })).not.toBe(
      fadeOpacity({ frame: 0, ...params }),
    );
    expect(fadeGain({ frame: 0, ...params })).toBe(0);
    expect(fadeOpacity({ frame: 0, ...params })).toBeGreaterThan(0);

    expect(fadeGain({ frame: 9, ...params })).not.toBe(
      fadeOpacity({ frame: 9, ...params }),
    );
    expect(fadeGain({ frame: 9, ...params })).toBe(0);
    expect(fadeOpacity({ frame: 9, ...params })).toBeGreaterThan(0);

    expect(fadeGain({ frame: 5, ...params })).toBe(
      fadeOpacity({ frame: 5, ...params }),
    );
  });
});

describe("equalPowerGain", () => {
  it("0 は 0、1 は 1", () => {
    expect(equalPowerGain(0)).toBe(0);
    expect(equalPowerGain(1)).toBe(1);
  });

  it("0.5 は約 0.7071 (sin(π/4))", () => {
    expect(equalPowerGain(0.5)).toBeCloseTo(Math.SQRT1_2);
  });

  it("r と 1 − r の二乗和は 1 (等パワー)", () => {
    const r = 0.3;
    const sum = equalPowerGain(r) ** 2 + equalPowerGain(1 - r) ** 2;

    expect(sum).toBeCloseTo(1);
  });

  it("範囲外はクランプする", () => {
    expect(equalPowerGain(-1)).toBe(0);
    expect(equalPowerGain(2)).toBe(1);
  });
});

describe("crossfadeGain", () => {
  it("in 区間の最初のフレームは equalPowerGain(1/inFrames)、inFrames - 1 で 1", () => {
    expect(
      crossfadeGain({
        frame: 0,
        durationInFrames: 10,
        inFrames: 4,
        outFrames: 0,
      }),
    ).toBeCloseTo(equalPowerGain(1 / 4));
    expect(
      crossfadeGain({
        frame: 3,
        durationInFrames: 10,
        inFrames: 4,
        outFrames: 0,
      }),
    ).toBe(1);
  });

  it("out 区間の最後のフレームは 0", () => {
    expect(
      crossfadeGain({
        frame: 9,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 4,
      }),
    ).toBe(0);
  });

  it("in/out が 0 なら常に 1", () => {
    expect(
      crossfadeGain({
        frame: 0,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 0,
      }),
    ).toBe(1);
    expect(
      crossfadeGain({
        frame: 9,
        durationInFrames: 10,
        inFrames: 0,
        outFrames: 0,
      }),
    ).toBe(1);
  });

  it("対になる入る側と出る側の二乗和が 1 (等パワー)", () => {
    const durationOut = 30;

    for (const inFrames of [3, 12]) {
      for (let f = 0; f < inFrames; f += 1) {
        const gainIn = crossfadeGain({
          frame: f,
          durationInFrames: 30,
          inFrames,
          outFrames: 0,
        });
        const gainOut = crossfadeGain({
          frame: durationOut - inFrames + f,
          durationInFrames: durationOut,
          inFrames: 0,
          outFrames: inFrames,
        });

        expect(gainIn ** 2 + gainOut ** 2).toBeCloseTo(1);
      }
    }
  });
});

describe("frameEffectsOpacity", () => {
  it("items が空なら 1", () => {
    expect(frameEffectsOpacity({ frame: 0, fps: 30, items: [] })).toBe(1);
  });

  it("区間外なら 1", () => {
    expect(
      frameEffectsOpacity({
        frame: 0,
        fps: 30,
        items: [{ at: 1, duration: 1, in: 0.5, out: 0 }],
      }),
    ).toBe(1);
  });

  it("区間内なら fadeOpacity と同じ値", () => {
    const opacity = frameEffectsOpacity({
      frame: 5,
      fps: 30,
      items: [{ at: 0, duration: 1, in: 0.5, out: 0 }],
    });

    expect(opacity).toBe(
      fadeOpacity({
        frame: 5,
        durationInFrames: 30,
        inFrames: 15,
        outFrames: 0,
      }),
    );
  });
});

describe("transitionFrames", () => {
  it("整数境界ではフレーム数どおりになる", () => {
    expect(transitionFrames({ at: 1, duration: 0.5, fps: 30 })).toBe(15);
  });

  it("丸めで 0 フレームになる", () => {
    expect(transitionFrames({ at: 0, duration: 0.4 / 30, fps: 30 })).toBe(0);
  });

  it("丸めで 1 フレームになる", () => {
    expect(transitionFrames({ at: 0, duration: 0.5 / 30, fps: 30 })).toBe(1);
  });
});
