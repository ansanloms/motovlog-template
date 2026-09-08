import { describe, expect, it } from "vitest";
import { splitForVertical } from "./verticalText.ts";

describe("splitForVertical", () => {
  it("2 桁の数字は tcy にする", () => {
    expect(splitForVertical("10月")).toEqual([
      { kind: "tcy", value: "10" },
      { kind: "text", value: "月" },
    ]);
  });

  it("4 桁以上の数字は text のまま (年号等)", () => {
    expect(splitForVertical("2024年")).toEqual([
      { kind: "text", value: "2024年" },
    ]);
  });

  it("1 桁の数字は text のまま", () => {
    expect(splitForVertical("1")).toEqual([{ kind: "text", value: "1" }]);
  });

  it("改行を含む文でも数字の並びだけ tcy にする", () => {
    expect(splitForVertical("8月\n浄土平まで318km")).toEqual([
      { kind: "text", value: "8月\n浄土平まで" },
      { kind: "tcy", value: "318" },
      { kind: "text", value: "km" },
    ]);
  });
});
