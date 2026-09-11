import { describe, expect, it } from "vitest";
import { parseArgs } from "./main.ts";

describe("parseArgs", () => {
  it("入力ファイルと slug を位置引数で読む", () => {
    expect(parseArgs(["movie.aup2", "20260101-sample"])).toEqual({
      input: "movie.aup2",
      slug: "20260101-sample",
    });
  });

  it("オプションを読む", () => {
    expect(
      parseArgs([
        "movie.aup2",
        "20260101-sample",
        "--out",
        "out/timeline.ts",
        "--meta",
        "meta.json",
        "--expressions",
        "expr.json",
        "--character",
        "hero",
      ]),
    ).toEqual({
      input: "movie.aup2",
      slug: "20260101-sample",
      out: "out/timeline.ts",
      meta: "meta.json",
      expressions: "expr.json",
      character: "hero",
    });
  });

  it("--help なら null を返す", () => {
    expect(parseArgs(["--help"])).toBeNull();
    expect(parseArgs(["movie.aup2", "20260101-sample", "-h"])).toBeNull();
  });

  it("位置引数が足りなければ throw する", () => {
    expect(() => parseArgs([])).toThrow(/usage/);
    expect(() => parseArgs(["movie.aup2"])).toThrow(/usage/);
  });

  it("不明なオプションは throw する", () => {
    expect(() =>
      parseArgs(["movie.aup2", "20260101-sample", "--slug", "x"]),
    ).toThrow(/不明なオプション/);
  });

  it("値の無いオプションは throw する", () => {
    expect(() => parseArgs(["movie.aup2", "20260101-sample", "--out"])).toThrow(
      /値がありません/,
    );
  });

  it("slug の形式が不正なら throw する", () => {
    expect(() => parseArgs(["movie.aup2", "Sample"])).toThrow(/slug/);
    expect(() => parseArgs(["movie.aup2", "20260101-Sample"])).toThrow(/slug/);
  });
});
