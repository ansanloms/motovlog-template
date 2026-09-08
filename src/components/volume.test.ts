import { describe, expect, it } from "vitest";
import { assertVolume, toVolumeProp, volumeAt } from "./volume.ts";

describe("volumeAt", () => {
  it("2 点フェードの中間値", () => {
    const points = [
      { at: 0, volume: 1 },
      { at: 2, volume: 0 },
    ];

    expect(volumeAt(points, 1)).toBe(0.5);
  });

  it("最初の点より前は最初の点の値でクランプする", () => {
    const points = [
      { at: 1, volume: 1 },
      { at: 3, volume: 0 },
    ];

    expect(volumeAt(points, 0)).toBe(1);
  });

  it("最後の点より後は最後の点の値でクランプする", () => {
    const points = [
      { at: 1, volume: 1 },
      { at: 3, volume: 0 },
    ];

    expect(volumeAt(points, 5)).toBe(0);
  });

  it("同じ値の 2 点は音量を保持する", () => {
    const points = [
      { at: 0, volume: 0.5 },
      { at: 2, volume: 0.5 },
    ];

    expect(volumeAt(points, 1)).toBe(0.5);
  });

  it("3 点以上での区間切り替え", () => {
    const points = [
      { at: 0, volume: 0 },
      { at: 1, volume: 1 },
      { at: 3, volume: 0 },
    ];

    expect(volumeAt(points, 0.5)).toBe(0.5);
    expect(volumeAt(points, 2)).toBe(0.5);
  });

  it("空配列を throw する", () => {
    expect(() => volumeAt([], 0)).toThrow();
  });
});

describe("toVolumeProp", () => {
  it("一定値をそのまま返す", () => {
    const prop = toVolumeProp(0.8, 30);

    expect(prop).toBe(0.8);
  });

  it("折れ線は frame を fps で秒に換算して評価する (fps=30, frame 30 = 1 秒)", () => {
    const points = [
      { at: 0, volume: 1 },
      { at: 2, volume: 0 },
    ];
    const prop = toVolumeProp(points, 30);

    if (typeof prop !== "function") {
      throw new Error("prop は関数のはず");
    }

    expect(prop(30)).toBe(0.5);
  });
});

describe("assertVolume", () => {
  it("負の値 (数値) を throw する", () => {
    expect(() => assertVolume(-1)).toThrow();
  });

  it("負の値 (折れ線の volume) を throw する", () => {
    expect(() =>
      assertVolume([
        { at: 0, volume: 1 },
        { at: 1, volume: -1 },
      ]),
    ).toThrow();
  });

  it("at の非単調 (同値・逆行) を throw する", () => {
    expect(() =>
      assertVolume([
        { at: 1, volume: 1 },
        { at: 1, volume: 0 },
      ]),
    ).toThrow();

    expect(() =>
      assertVolume([
        { at: 1, volume: 1 },
        { at: 0, volume: 0 },
      ]),
    ).toThrow();
  });

  it("空配列を throw する", () => {
    expect(() => assertVolume([])).toThrow();
  });

  it("1 超の値 (数値) を throw する", () => {
    expect(() => assertVolume(1.1)).toThrow();
  });

  it("1 超の値 (折れ線の volume) を throw する", () => {
    expect(() =>
      assertVolume([
        { at: 0, volume: 1 },
        { at: 1, volume: 1.1 },
      ]),
    ).toThrow();
  });

  it("正しい入力は throw しない", () => {
    expect(() => assertVolume(1)).not.toThrow();
    expect(() =>
      assertVolume([
        { at: 0, volume: 1 },
        { at: 1, volume: 0 },
      ]),
    ).not.toThrow();
  });
});
