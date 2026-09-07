// remotion が持つ `declare module "*.css"` (`*.module.css` にもマッチする) の型
// 宣言が優先され、CSS Modules の import 結果 (styles) は any になる。そのため
// 存在しないクラス名を参照しても TypeScript で止められない。ここでは実行時に
// tsx から参照するクラス名が対応する *.module.css に定義されているかを検証し、
// 型で防げない分を代替する。
// `styles[expr]` のような計算キーはこのテストで追えないため使わない
// (`styles.key` の形に限る)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

type CssModuleImport = {
  tsxFile: string;
  ident: string;
  cssFile: string;
};

// src 配下の *.tsx を再帰的に集める。
const findTsxFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return findTsxFiles(entryPath);
    }

    return entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
};

// 行コメント (`//` 以降) とブロックコメント (`/* ... */`。JSX の
// `{/* ... */}` も `/*` `*/` の対で一致する) を取り除く。コメント中の
// styles.foo 等をクラス名参照と誤検出しないようにするため。
const stripComments = (content: string): string =>
  content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// tsx が `import <ident> from "./<name>.module.css"` の形で import している
// *.module.css (相対パス) を集める。
const findCssModuleImports = (tsxFiles: string[]): CssModuleImport[] => {
  const importPattern =
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+"(\.[^"]+\.module\.css)"/g;

  return tsxFiles.flatMap((tsxFile) => {
    const content = stripComments(fs.readFileSync(tsxFile, "utf-8"));
    const matches = [...content.matchAll(importPattern)];

    return matches.map(({ 1: ident, 2: relPath }) => ({
      tsxFile,
      ident,
      cssFile: path.resolve(path.dirname(tsxFile), relPath),
    }));
  });
};

// tsx 内で `<ident>.<key>` / `<ident>["key"]` の形で参照されているキーを集める。
const findReferencedKeys = (tsxFile: string, ident: string): string[] => {
  const content = stripComments(fs.readFileSync(tsxFile, "utf-8"));
  const escapedIdent = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dotPattern = new RegExp(
    `\\b${escapedIdent}\\.([A-Za-z_$][\\w$]*)`,
    "g",
  );
  const bracketPattern = new RegExp(
    `\\b${escapedIdent}\\[["'\`]([^"'\`]+)["'\`]\\]`,
    "g",
  );

  return [
    ...[...content.matchAll(dotPattern)].map((match) => match[1]),
    ...[...content.matchAll(bracketPattern)].map((match) => match[1]),
  ];
};

// .module.css 内で定義されているクラスセレクタ (`.text {` `.text,` `.text:` 等)
// のクラス名を集める。
const findDefinedClasses = (cssFile: string): string[] => {
  const content = fs.readFileSync(cssFile, "utf-8");
  const pattern = /(?<![\w.])\.([A-Za-z_][\w-]*)(?![\w-])/g;

  return [...new Set([...content.matchAll(pattern)].map((match) => match[1]))];
};

const tsxFiles = findTsxFiles(srcDir);
const cssModuleImports = findCssModuleImports(tsxFiles);

describe("CSS Modules のクラス名参照", () => {
  it("*.module.css を import している tsx が見つかる", () => {
    // 検出の仕組み自体が壊れると以降のテストが黙って通ってしまうため、ここで止める。
    expect(cssModuleImports.length).toBeGreaterThan(0);
  });

  for (const { tsxFile, ident, cssFile } of cssModuleImports) {
    const tsxName = path.relative(srcDir, tsxFile);
    const cssName = path.relative(srcDir, cssFile);
    const referencedKeys = findReferencedKeys(tsxFile, ident);
    const definedClasses = findDefinedClasses(cssFile);

    for (const key of referencedKeys) {
      it(`${tsxName} が参照する ${ident}.${key} は ${cssName} に定義されている`, () => {
        expect(definedClasses).toContain(key);
      });
    }

    it(`${cssName} で定義されたクラスはすべて ${tsxName} から参照されている`, () => {
      const unused = definedClasses.filter(
        (className) => !referencedKeys.includes(className),
      );

      expect(unused).toEqual([]);
    });
  }
});
