import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getSetup } from "../setup.ts";
import { themeCssVars } from "./cssVars.ts";

// palette は利用側の値 (ADR-0012)。テストは test/setup.ts が configure()
// したものを使う。
const { palette } = getSetup().theme;

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// src 配下の *.module.css を再帰的に集める。
const findModuleCssFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return findModuleCssFiles(entryPath);
    }

    return entry.name.endsWith(".module.css") ? [entryPath] : [];
  });
};

describe("themeCssVars", () => {
  it("すべてのキーが -- で始まり、値が空文字でない", () => {
    const vars = themeCssVars(palette, "Noto Sans JP");

    for (const [key, value] of Object.entries(vars)) {
      expect(key.startsWith("--")).toBe(true);
      expect(value).not.toBe("");
    }
  });

  it("-alpha・-line-height で終わる変数は px を付けない", () => {
    // 無単位キーの判定 (isRawValueKey) は大文字小文字を区別しないため、
    // 小文字始まりの接尾辞 (例: characterShadow.alpha) も px を付けない。
    const vars = themeCssVars(palette, "Noto Sans JP");

    for (const [key, value] of Object.entries(vars)) {
      if (key.endsWith("-alpha") || key.endsWith("-line-height")) {
        expect(value.endsWith("px")).toBe(false);
      }
    }
  });

  it("*.module.css が参照する var(--...) はすべて themeCssVars に存在する", () => {
    // CSS 変数のタイプミスは実行時に黙って効かなくなるため、ここで止める。
    const vars = themeCssVars(palette, "Noto Sans JP");
    const files = findModuleCssFiles(srcDir);

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.matchAll(/var\(\s*(--[\w-]+)/g);

      for (const match of matches) {
        expect(vars).toHaveProperty(match[1]);
      }
    }
  });
});
