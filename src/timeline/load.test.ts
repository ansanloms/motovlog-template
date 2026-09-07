import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT, resolveProjectSlug } from "./load";

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
