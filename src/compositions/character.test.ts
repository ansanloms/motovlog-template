import { describe, expect, it } from "vitest";
import { character, resolveBy } from "./character.ts";

describe("resolveBy", () => {
  const hero = character({ expressions: { normal: ["a.png"] } });

  it("Character をそのまま渡すと { character } に正規化する (expression は無い)", () => {
    expect(resolveBy(hero)).toEqual({ character: hero });
  });

  it("{ character, expression } はそのまま返す", () => {
    expect(resolveBy({ character: hero, expression: "normal" })).toEqual({
      character: hero,
      expression: "normal",
    });
  });

  it("null を渡すと Error を throw する (プロパティアクセスの生の TypeError ではない)", () => {
    expect(() => resolveBy(null as never)).toThrow(
      /by は character\(\) の戻り値か \{ character, expression\? \} の形で書いてください/,
    );
  });

  it("非オブジェクト (文字列) を渡すと Error を throw する", () => {
    expect(() => resolveBy("hero" as never)).toThrow(
      /by は character\(\) の戻り値か/,
    );
  });

  it("character キーの無いオブジェクトを渡すと Error を throw する", () => {
    expect(() => resolveBy({} as never)).toThrow(
      /by は character\(\) の戻り値か/,
    );
  });

  it("character が Character (expressions を持つオブジェクト) でなければ Error を throw する", () => {
    expect(() => resolveBy({ character: { foo: 1 } } as never)).toThrow(
      /by は character\(\) の戻り値か/,
    );
  });
});
