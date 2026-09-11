import { describe, expect, it, vi } from "vitest";
import { getSetup } from "./setup.ts";
import type { Setup } from "./setup.ts";
import { PALETTE_KEYS } from "./theme/tokens.ts";
import { VOICE_KEYS } from "./voice/cache.ts";

describe("getSetup", () => {
  it("configure() 済みなら利用側の値を返す", () => {
    // test/setup.ts が configure() している。
    expect(getSetup().defaultProject).toBe("00000000-sample");
    expect(typeof getSetup().theme.narrator.speaker).toBe("number");
  });

  it("configure() 前に呼ぶと configure() を書く場所を示して throw する", async () => {
    // このファイルのモジュールレジストリだけを捨てて、configure() されていない
    // 状態の setup.ts を読み直す。
    vi.resetModules();
    const fresh = await import("./setup.ts");

    expect(() => fresh.getSetup()).toThrow(/app\/index\.ts/);
  });
});

describe("configure", () => {
  /** 全項目の揃った theme。壊す項目だけを上書きして使う。 */
  const validTheme = () => {
    const narrator: Record<string, number> = {};
    const palette: Record<string, string> = {};

    for (const key of VOICE_KEYS) {
      narrator[key] = 1;
    }

    for (const key of PALETTE_KEYS) {
      palette[key] = "#0f1a14";
    }

    return { narrator, palette };
  };

  /**
   * theme を差し替えた Setup。見るのは configure() の検査だけなので、
   * defaultProject と loadTimeline は形だけ合わせる。
   */
  const setupWith = (theme: unknown): Setup =>
    ({
      theme,
      defaultProject: "00000000-sample",
      loadTimeline: () => Promise.resolve({ default: {} }),
    }) as Setup;

  /**
   * 読み直した setup.ts。このファイルが静的に import している側 (test/setup.ts
   * が configure() 済み) のレジストリを上書きしないため、毎回読み直す。
   */
  const freshSetup = async () => {
    vi.resetModules();

    return import("./setup.ts");
  };

  it("narrator の項目が数値でなければ、その項目名を挙げて throw する", async () => {
    const { configure } = await freshSetup();
    const theme = validTheme();

    delete theme.narrator.pitch;
    theme.narrator.volume = Number.NaN;

    expect(() => configure(setupWith(theme))).toThrow(
      "configure(): theme.narrator の項目が数値ではありません: pitch・volume",
    );
  });

  it("palette の項目が欠けていれば、その項目名を挙げて throw する", async () => {
    const { configure } = await freshSetup();
    const theme = validTheme();

    delete theme.palette.inkDim;

    expect(() => configure(setupWith(theme))).toThrow(
      "configure(): theme.palette の項目がありません: inkDim",
    );
  });

  it("palette の色が #rrggbb でなければ、キーと値を挙げて throw する", async () => {
    const { configure } = await freshSetup();
    const theme = validTheme();

    // toRgbChannels() (src/theme/cssVars.ts) が要求する形から外れたもの。
    theme.palette.bg = "#0f1a1";
    theme.palette.accent = "green";

    expect(() => configure(setupWith(theme))).toThrow(
      "configure(): theme.palette の色は #rrggbb の形で書いてください: bg=#0f1a1・accent=green",
    );
  });

  it("検査に落ちたときは何も記録しない", async () => {
    const fresh = await freshSetup();
    const theme = validTheme();

    delete theme.palette.warn;

    expect(() => fresh.configure(setupWith(theme))).toThrow();
    expect(() => fresh.getSetup()).toThrow(/app\/index\.ts/);
  });

  it("揃っていれば記録する", async () => {
    const fresh = await freshSetup();

    fresh.configure(setupWith(validTheme()));

    expect(fresh.getSetup().defaultProject).toBe("00000000-sample");
  });
});
