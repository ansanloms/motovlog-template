import { describe, expect, it, vi } from "vitest";
import { getSetup } from "./setup.ts";

describe("getSetup", () => {
  it("configure() 済みなら利用側の値を返す", () => {
    // src/test/setup.ts が configure() している。
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
