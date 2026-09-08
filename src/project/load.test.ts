import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT,
  isVideo,
  loadVideo,
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

describe("isVideo", () => {
  it("正常形は true", () => {
    expect(
      isVideo({
        fps: 30,
        width: 1920,
        height: 1080,
        durationSec: 10,
        items: [],
      }),
    ).toBe(true);
  });

  it("width/height/durationSec が無い形は false", () => {
    expect(isVideo({ fps: 30, items: [] })).toBe(false);
  });

  it("null は false", () => {
    expect(isVideo(null)).toBe(false);
  });
});

describe("loadVideo", () => {
  it("存在しない project は reject する", async () => {
    await expect(loadVideo("20990101-missing")).rejects.toThrow();
  });

  it("00000000-sample は resolve して fps === 30 になる", async () => {
    const video = await loadVideo("00000000-sample");
    expect(video.fps).toBe(30);
  });

  it("空文字は DEFAULT_PROJECT に resolve して fps === 30 になる", async () => {
    const video = await loadVideo("");
    expect(video.fps).toBe(30);
  });
});
