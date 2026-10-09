import { describe, expect, it } from "vitest";
import { cut } from "./cut.ts";
import type { CutItem, Layer, PendingCutItem } from "./types.ts";

describe("cut", () => {
  it("duration を渡すと CutItem (duration 込み) を返す", () => {
    const item: CutItem = cut(null, { duration: 3 });

    expect(item.kind).toBe("cut");
    expect(item.duration).toBe(3);
  });

  it("duration を省くと PendingCutItem (duration なし) を返す", () => {
    const item: PendingCutItem = cut(null, { at: 8 });

    expect(item.kind).toBe("cut");
    expect(item.duration).toBeUndefined();
    expect(item.at).toBe(8);
  });

  it("PendingCutItem は普通の layer に置けない (型エラー)", () => {
    // @ts-expect-error PendingCutItem は Item に含まれず Layer に置けない。
    const layer: Layer = [cut(null, { at: 0 })];

    expect(layer).toBeDefined();
  });
});
