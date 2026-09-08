import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT,
  isTimeline,
  loadTimeline,
  resolveProjectSlug,
} from "./load.ts";

describe("resolveProjectSlug", () => {
  it("未設定なら DEFAULT_PROJECT を返す", () => {
    expect(resolveProjectSlug(undefined)).toBe(DEFAULT_PROJECT);
  });

  it("空文字なら DEFAULT_PROJECT を返す", () => {
    expect(resolveProjectSlug("")).toBe(DEFAULT_PROJECT);
  });

  it("正しい形式 (YYYYMMDD-<name>) の slug はそのまま返す", () => {
    expect(resolveProjectSlug("20260817-jododaira")).toBe("20260817-jododaira");
  });

  it("ハイフン区切りの複数語の name も受け付ける", () => {
    expect(resolveProjectSlug("20260817-foo-bar")).toBe("20260817-foo-bar");
  });

  it("書式に合わない slug は拒否する", () => {
    expect(() => resolveProjectSlug("bad slug")).toThrow();
  });

  it("日付部分が 8 桁でない slug は拒否する", () => {
    expect(() => resolveProjectSlug("2026081-jododaira")).toThrow();
  });
});

describe("isTimeline", () => {
  it("正常形は true", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [],
      }),
    ).toBe(true);
  });

  it("width/height/durationSec が無い形は false", () => {
    expect(isTimeline({ fps: 30, layers: [] })).toBe(false);
  });

  it("layers の代わりに items を持つ旧形は false", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        items: [],
      }),
    ).toBe(false);
  });

  it("layers が配列の配列でない形は false", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [{ kind: "cut" }],
      }),
    ).toBe(false);
  });

  it("null は false", () => {
    expect(isTimeline(null)).toBe(false);
  });

  it("layer の item が kind/at/duration を欠けば false", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [[{}]],
      }),
    ).toBe(false);
  });

  it("layer の item が kind/at/duration を満たせば true", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [[{ kind: "cut", at: 0, duration: 1, node: null }]],
      }),
    ).toBe(true);
  });

  it("fade で in が無い item は false", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [[{ kind: "fade", at: 0, duration: 1, out: 0.5 }]],
      }),
    ).toBe(false);
  });

  it("duration が NaN の item は false", () => {
    expect(
      isTimeline({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        layers: [[{ kind: "cut", at: 0, duration: Number.NaN }]],
      }),
    ).toBe(false);
  });
});

describe("loadTimeline", () => {
  it("存在しない project は reject する", async () => {
    await expect(loadTimeline("20990101-missing")).rejects.toThrow();
  });

  it("00000000-sample は resolve して fps === 30 になる", async () => {
    const timeline = await loadTimeline("00000000-sample");
    expect(timeline.fps).toBe(30);
  });

  it("空文字は DEFAULT_PROJECT に resolve して fps === 30 になる", async () => {
    const timeline = await loadTimeline("");
    expect(timeline.fps).toBe(30);
  });
});
