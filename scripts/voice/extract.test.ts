import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { extractLines } from "./extract.ts";

// isNarrationLineCall (#8) は import が実際の src/compositions/narration.ts
// (line の実体) に解決されるものだけを発話の呼び出しと見なす。テストの
// fixture もこの解決に乗るよう、実在するファイルへの相対パスで import する。
const NARRATION_TS = fileURLToPath(
  new URL("../../src/compositions/narration.ts", import.meta.url),
);

const lineSpecifierFor = (dir: string): string => {
  const rel = path.relative(dir, NARRATION_TS).split(path.sep).join("/");

  return rel.startsWith(".") ? rel : `./${rel}`;
};

const lineImportFor = (dir: string, localName = "line"): string =>
  localName === "line"
    ? `import { line } from "${lineSpecifierFor(dir)}";`
    : `import { line as ${localName} } from "${lineSpecifierFor(dir)}";`;

// fs に書かず、path 計算だけに使う架空の timeline.ts のパス
// (projects/<slug>/timeline.ts と同じ深さに置く。実プロジェクトの import
// 記法 "../../src/compositions/narration.ts" と一致させるため)。
const FILE = path.join(
  fileURLToPath(new URL("../../", import.meta.url)),
  "projects",
  "00000000-sample",
  "timeline.ts",
);
const FILE_DIR = path.dirname(FILE);
const LINE_IMPORT = lineImportFor(FILE_DIR);

const THEME_SOURCE = `
export const narrator = { speaker: 13, speed: 1, pitch: 0 };
export const speeds = { slow: { speaker: 13, speed: 0.8 } };
`;

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * tmp ディレクトリに theme.ts と timeline.ts を書き出し、timeline.ts の
 * 絶対パスを返す。timeline.ts の先頭には実物の narration.ts から line を
 * import する行を自動で足す (呼び出し側の timelineSource はそれに続く本文)。
 */
const setupProject = (timelineSource: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-test-"));
  tmpDirs.push(dir);
  fs.writeFileSync(path.join(dir, "theme.ts"), THEME_SOURCE);
  const timelinePath = path.join(dir, "timeline.ts");
  fs.writeFileSync(timelinePath, `${lineImportFor(dir)}\n${timelineSource}`);
  return timelinePath;
};

describe("extractLines", () => {
  it("正常系: text だけの呼び出しを読む", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "こんにちは" },
    ]);
  });

  it("正常系: voice (リテラルのみの object literal) を読む", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは", voice: { speaker: 13 } });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "こんにちは", voice: { speaker: 13 } },
    ]);
  });

  it("正常系: voice に単項マイナスの数値リテラルを渡せる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは", voice: { pitch: -0.1 } });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "こんにちは", voice: { pitch: -0.1 } },
    ]);
  });

  it("正常系: 複数の line() 呼び出しをすべて集める", async () => {
    const source = `${LINE_IMPORT}
      cut(line({ text: "a" }), { at: 0 });
      cut(line({ text: "b", voice: { speaker: 1 } }), { after: 0.5 });
    `;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "a" },
      { text: "b", voice: { speaker: 1 } },
    ]);
  });

  it("text が変数参照なら位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nconst t = "a"; line({ text: t });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*リテラル/,
    );
  });

  it("text が置換ありテンプレートリテラルなら位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nconst t = 1; line({ text: \`x\${t}\` });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*リテラル/,
    );
  });

  it("text が置換無しテンプレートリテラルなら通る", async () => {
    const source = `${LINE_IMPORT}\nline({ text: \`こんにちは\` });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "こんにちは" },
    ]);
  });

  it("line() の同じプロパティが重複していれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", text: "b" });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*重複/,
    );
  });

  it("voice のプロパティが重複していれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", voice: { speaker: 1, speaker: 2 } });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*重複/,
    );
  });

  it("text が無ければ位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ voice: { speaker: 1 } });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /text がありません/,
    );
  });

  it("voice に未知のキーがあれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", voice: { unknown: 1 } });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(/未知のキー/);
  });

  it("voice の値が数値でなければ位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", voice: { speaker: "13" } });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(/有限の数値/);
  });

  it("line() の呼び出しが無ければ空配列を返す", async () => {
    await expect(extractLines("const x = 1;", FILE)).resolves.toEqual([]);
  });

  it("import の別名 (line as l) も拾う", async () => {
    const source = `${lineImportFor(FILE_DIR, "l")}\nl({ text: "alias" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "alias" },
    ]);
  });

  it("namespace import (import * as n) 経由の n.line() も拾う", async () => {
    const source = `import * as n from "${lineSpecifierFor(FILE_DIR)}";\nn.line({ text: "namespace" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual([
      { text: "namespace" },
    ]);
  });

  it("無関係なモジュールの namespace import の同名プロパティ (m.line()) は拾わない", async () => {
    const source = `
      import * as m from "./theme.ts";
      m.line({ text: "unrelated" });
    `;
    const timelinePath = setupProject(source);
    const written = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(written, timelinePath)).resolves.toEqual([]);
  });

  it("ローカルの line 関数 (import ではない) は拾わない", async () => {
    const source = `
      function line(props: { text: string }) { return props; }
      line({ text: "local" });
    `;

    await expect(extractLines(source, FILE)).resolves.toEqual([]);
  });

  it("const の循環参照は位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}
      const a = b;
      const b = a;
      line({ text: "x", voice: a });
    `;

    await expect(extractLines(source, FILE)).rejects.toThrow(/循環参照/);
  });

  it("voice に import した const をそのまま渡せる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./theme.ts";
      line({ text: "a", voice: narrator });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual([
      { text: "a", voice: { speaker: 13, speed: 1, pitch: 0 } },
    ]);
  });

  it("voice に spread (...narrator) と上書きを渡せる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./theme.ts";
      line({ text: "a", voice: { ...narrator, speed: 0.9 } });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual([
      { text: "a", voice: { speaker: 13, speed: 0.9, pitch: 0 } },
    ]);
  });

  it("voice に同じファイルの top-level const を渡せる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./theme.ts";
      const calm = { ...narrator, volume: 0.8 };
      line({ text: "a", voice: calm });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual([
      { text: "a", voice: { speaker: 13, speed: 1, pitch: 0, volume: 0.8 } },
    ]);
  });

  it("voice にプロパティアクセス (speeds.slow) を渡せる", async () => {
    const timelinePath = setupProject(`
      import { speeds } from "./theme.ts";
      line({ text: "a", voice: speeds.slow });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual([
      { text: "a", voice: { speaker: 13, speed: 0.8 } },
    ]);
  });

  it("voice に関数呼び出しがあれば位置付きエラーになる", async () => {
    const timelinePath = setupProject(
      `line({ text: "a", voice: { speaker: getSpeaker() } });`,
    );
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).rejects.toThrow(
      /評価できません/,
    );
  });

  it("voice が存在しない export の参照なら位置付きエラーになる", async () => {
    const timelinePath = setupProject(`
      import { missing } from "./theme.ts";
      line({ text: "a", voice: missing });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).rejects.toThrow(
      /export missing がありません/,
    );
  });

  it("voice の import 先が読み込めなければ位置付きエラーになる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./not-exist.ts";
      line({ text: "a", voice: narrator });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).rejects.toThrow(
      /読み込めません/,
    );
  });
});
