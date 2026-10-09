import { describe, expect, it } from "vitest";
import { isSample, sample } from "./sample.ts";

describe("sample", () => {
  it("kind: sample と render をそのまま持つ SampleNode を返す", () => {
    const render = (): null => null;
    const node = sample(render);

    expect(node.kind).toBe("sample");
    expect(node.render).toBe(render);
  });

  it("isSample は sample() の戻り値を true と判定する", () => {
    expect(isSample(sample(() => null))).toBe(true);
  });

  it("isSample は sample() 以外 (null・オブジェクト・frame() 形の印) を false と判定する", () => {
    expect(isSample(null)).toBe(false);
    expect(isSample(undefined)).toBe(false);
    expect(isSample({})).toBe(false);
    expect(isSample({ kind: "frame" })).toBe(false);
  });
});
