import { describe, expect, it } from "vitest";
import { findFilter, numberParam, parseAup2 } from "./parse.ts";

/** CRLF の .aup2 を小さく組み立てる。 */
const crlf = (lines: readonly string[]): string => lines.join("\r\n");

describe("parseAup2", () => {
  it("header・オブジェクト・フィルタを読む", () => {
    const aup2 = parseAup2(
      crlf([
        "[project]",
        "version=2005300",
        "[scene.0]",
        "video.rate=30",
        "[1]",
        "layer=1",
        "frame=0,29",
        "group=3",
        "name=クリップ",
        "[1.0]",
        "effect.name=動画ファイル",
        "再生位置=1.500,2.500,再生範囲,0",
        "[1.1]",
        "effect.name=フェード",
        "イン=0.50",
        "アウト=0.00",
        "",
      ]),
    );

    expect(aup2.header).toEqual({
      project: { version: "2005300" },
      "scene.0": { "video.rate": "30" },
    });
    expect(aup2.objects).toHaveLength(1);
    expect(aup2.objects[0]).toMatchObject({
      id: 1,
      layer: 1,
      frame: [0, 29],
      group: 3,
      name: "クリップ",
    });
    expect(aup2.objects[0].filters).toEqual([
      {
        name: "動画ファイル",
        params: { 再生位置: "1.500,2.500,再生範囲,0" },
      },
      { name: "フェード", params: { イン: "0.50", アウト: "0.00" } },
    ]);
  });

  it("LF だけの改行も読む", () => {
    const aup2 = parseAup2("[1]\nlayer=2\nframe=5,9\n");

    expect(aup2.objects[0]).toMatchObject({ layer: 2, frame: [5, 9] });
  });

  it("値に含まれる = を残す", () => {
    const aup2 = parseAup2(
      crlf([
        "[1]",
        "layer=1",
        "frame=0,1",
        "[1.0]",
        "effect.name=図形",
        "式=a=b",
      ]),
    );

    expect(aup2.objects[0].filters[0].params["式"]).toBe("a=b");
  });

  it("group・name が無ければ持たない", () => {
    const aup2 = parseAup2(crlf(["[1]", "layer=1", "frame=0,1"]));

    expect(aup2.objects[0].group).toBeUndefined();
    expect(aup2.objects[0].name).toBeUndefined();
  });

  it("親のいないフィルタは throw する", () => {
    expect(() => parseAup2(crlf(["[2.0]", "effect.name=図形"]))).toThrow(
      /親オブジェクト/,
    );
  });

  it("layer の無いオブジェクトは throw する", () => {
    expect(() => parseAup2(crlf(["[1]", "frame=0,1"]))).toThrow(/layer/);
  });

  it("frame の無いオブジェクトは throw する", () => {
    expect(() => parseAup2(crlf(["[1]", "layer=1"]))).toThrow(/frame/);
  });

  it("frame の形が不正なら throw する", () => {
    expect(() => parseAup2(crlf(["[1]", "layer=1", "frame=0"]))).toThrow(
      /frame の形/,
    );
    expect(() => parseAup2(crlf(["[1]", "layer=1", "frame=9,0"]))).toThrow(
      /frame の値/,
    );
  });

  it("同じ番号のオブジェクトが 2 度現れたら throw する", () => {
    expect(() =>
      parseAup2(
        crlf(["[1]", "layer=1", "frame=0,1", "[1]", "layer=2", "frame=0,1"]),
      ),
    ).toThrow(/重複/);
  });

  it("effect.name の無いフィルタは throw する", () => {
    expect(() =>
      parseAup2(crlf(["[1]", "layer=1", "frame=0,1", "[1.0]", "サイズ=200"])),
    ).toThrow(/effect.name/);
  });
});

describe("findFilter", () => {
  it("名前で引き、無ければ undefined を返す", () => {
    const object = parseAup2(
      crlf([
        "[1]",
        "layer=1",
        "frame=0,1",
        "[1.0]",
        "effect.name=フェード",
        "イン=0.5",
      ]),
    ).objects[0];

    expect(findFilter(object, "フェード")?.params["イン"]).toBe("0.5");
    expect(findFilter(object, "図形")).toBeUndefined();
  });
});

describe("numberParam", () => {
  const filter = { name: "フェード", params: { イン: "0.50", 空: "" } };

  it("数値として読む", () => {
    expect(numberParam(filter, "イン", 9)).toBe(0.5);
  });

  it("フィルタもキーも無ければ fallback を返す", () => {
    expect(numberParam(undefined, "イン", 9)).toBe(9);
    expect(numberParam(filter, "アウト", 9)).toBe(9);
    expect(numberParam(filter, "空", 9)).toBe(9);
  });

  it("数値にならなければ throw する", () => {
    expect(() =>
      numberParam({ name: "フェード", params: { イン: "x" } }, "イン", 0),
    ).toThrow(/数値/);
  });
});
