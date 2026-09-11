import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTimeline, loadTimeline, resolveProjectSlug } from "./load.ts";
import { getSetup } from "../setup.ts";
import { fps } from "../theme/timing.ts";

// 既定の slug と timeline の読み込みは利用側が configure() で渡す (ADR-0012)。
// テストの値は test/setup.ts が設定している。
const { defaultProject } = getSetup();

// loadTimeline("00000000-sample") は narration() を経由し、発話の音声
// キャッシュ (<key>.json) を fetch する。ここでの目的 (default export が
// Timeline の形であること) には実際のキャッシュファイルは要らないため、
// .json で終わる URL には isVoiceCache を通る偽のキャッシュを返す。
const FAKE_VOICE_CACHE = {
  text: "dummy",
  voice: {
    speaker: 13,
    speed: 1,
    pitch: 0,
    intonation: 1,
    volume: 1,
    pause: 1,
    silenceBefore: 0.1,
    silenceAfter: 0.1,
  },
  reading: "dummy",
  duration: 1.5,
  lipsync: [],
  generatedAt: "2026-09-08T00:00:00Z",
};

beforeEach(() => {
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith(".json")) {
      return new Response(JSON.stringify(FAKE_VOICE_CACHE), { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveProjectSlug", () => {
  it("未設定なら configure() の defaultProject を返す", () => {
    expect(resolveProjectSlug(undefined)).toBe(defaultProject);
  });

  it("空文字なら configure() の defaultProject を返す", () => {
    expect(resolveProjectSlug("")).toBe(defaultProject);
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

  it("configure() の loadTimeline 経由で 00000000-sample を読める", async () => {
    const timeline = await loadTimeline("00000000-sample");
    expect(timeline.fps).toBe(fps);
  });

  it("空文字は defaultProject に resolve して fps が theme の fps になる", async () => {
    const timeline = await loadTimeline("");
    expect(timeline.fps).toBe(fps);
  });
});
