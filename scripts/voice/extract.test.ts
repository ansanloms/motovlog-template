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

// isCharacterCall (#39) も同様に、実在する src/compositions/character.ts
// (character の実体) への相対パスで import する。
const CHARACTER_TS = fileURLToPath(
  new URL("../../src/compositions/character.ts", import.meta.url),
);

// 利用側は lib の 5 入口 (ADR-0012) からも line()・character() を import
// できる。実体を直接指す import と同じ扱いになることを確かめる。
const COMPOSITIONS_INDEX_TS = fileURLToPath(
  new URL("../../src/compositions/index.ts", import.meta.url),
);

const ROOT_INDEX_TS = fileURLToPath(
  new URL("../../src/index.ts", import.meta.url),
);

const specifierFor = (dir: string, target: string): string => {
  const rel = path.relative(dir, target).split(path.sep).join("/");

  return rel.startsWith(".") ? rel : `./${rel}`;
};

const lineSpecifierFor = (dir: string): string =>
  specifierFor(dir, NARRATION_TS);

const characterSpecifierFor = (dir: string): string =>
  specifierFor(dir, CHARACTER_TS);

const lineImportFor = (dir: string, localName = "line"): string =>
  localName === "line"
    ? `import { line } from "${lineSpecifierFor(dir)}";`
    : `import { line as ${localName} } from "${lineSpecifierFor(dir)}";`;

const characterImportFor = (dir: string, localName = "character"): string =>
  localName === "character"
    ? `import { character } from "${characterSpecifierFor(dir)}";`
    : `import { character as ${localName} } from "${characterSpecifierFor(dir)}";`;

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
 * timelineSource・otherFiles の値関数は実際に生成される dir を受け取る
 * (character.ts への相対 specifier は dir から計算するため)。
 */
const setupProject = (
  timelineSource: string | ((dir: string) => string),
  otherFiles: Record<string, (dir: string) => string> = {},
): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-test-"));
  tmpDirs.push(dir);
  fs.writeFileSync(path.join(dir, "theme.ts"), THEME_SOURCE);

  for (const [name, content] of Object.entries(otherFiles)) {
    fs.writeFileSync(path.join(dir, name), content(dir));
  }

  const resolvedSource =
    typeof timelineSource === "function" ? timelineSource(dir) : timelineSource;

  const timelinePath = path.join(dir, "timeline.ts");
  fs.writeFileSync(timelinePath, `${lineImportFor(dir)}\n${resolvedSource}`);
  return timelinePath;
};

describe("extractLines", () => {
  it("lib の入口 (src/compositions/index.ts) からの import も line() と見なす", async () => {
    const source = `import { line } from "${specifierFor(FILE_DIR, COMPOSITIONS_INDEX_TS)}";\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("lib の root export (src/index.ts) からの import も line() と見なす", async () => {
    const source = `import { line } from "${specifierFor(FILE_DIR, ROOT_INDEX_TS)}";\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("bare specifier (motovlog-template/compositions) からの import も line() と見なす", async () => {
    const source = `import { line } from "motovlog-template/compositions";\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("bare specifier (motovlog-template) からの import も line() と見なす", async () => {
    const source = `import { line } from "motovlog-template";\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("lib 以外の bare specifier からの line は拾わない", async () => {
    const source = `import { line } from "other-package";\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [],
      silent: 0,
    });
  });

  it("bare specifier の character() も by の voice として読む", async () => {
    const timelinePath = setupProject(
      `
        import { character } from "motovlog-template/compositions";
        const hero = character({
          voice: { speaker: 13 },
          expressions: { normal: [] },
        });
        line({ text: "a", by: hero });
      `,
    );
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual({
      lines: [{ text: "a", voice: { speaker: 13 } }],
      silent: 0,
    });
  });

  it("正常系: text だけの呼び出しを読む", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("正常系: voice (リテラルのみの object literal) を読む", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは", voice: { speaker: 13 } });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは", voice: { speaker: 13 } }],
      silent: 0,
    });
  });

  it("正常系: voice に単項マイナスの数値リテラルを渡せる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "こんにちは", voice: { pitch: -0.1 } });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは", voice: { pitch: -0.1 } }],
      silent: 0,
    });
  });

  it("正常系: 複数の line() 呼び出しをすべて集める", async () => {
    const source = `${LINE_IMPORT}
      cut(line({ text: "a" }), { at: 0 });
      cut(line({ text: "b", voice: { speaker: 1 } }), { after: 0.5 });
    `;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "a" }, { text: "b", voice: { speaker: 1 } }],
      silent: 0,
    });
  });

  it("正常系: reading (リテラル) を読む", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "{浄土平|じょうどだいら}", reading: "浄土平です" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "{浄土平|じょうどだいら}", reading: "浄土平です" }],
      silent: 0,
    });
  });

  it("正常系: reading が文字列リテラルの配列なら改行で結合する", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", reading: ["a", "b"] });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "a", reading: "a\nb" }],
      silent: 0,
    });
  });

  it("reading が変数参照 (非リテラル) なら位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nconst r = "a"; line({ text: "x", reading: r });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*リテラル/,
    );
  });

  it("reading が空文字なら位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "x", reading: "" });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*line\(\)\.reading を空文字にはできません \(声無しは voice: null で書いてください\)/,
    );
  });

  it("voice: null と reading を同時に指定すると位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", reading: "エー", voice: null });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*声無しの行 \(voice: null\) に reading は書けません/,
    );
  });

  it("voice: null の line() は抽出結果から除外する (声無し)", async () => {
    const source = `${LINE_IMPORT}
      cut(line({ text: "a" }), { at: 0 });
      cut(line({ text: "b", voice: null }), { at: 1, duration: 1 });
    `;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "a" }],
      silent: 1,
    });
  });

  it("text の {漢字|よみ} 記法が壊れていれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "{浄土平|}" });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*\{漢字\|よみ\} の形で書いてください/,
    );
  });

  it("reading の {漢字|よみ} 記法が壊れていれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", reading: "{|じょうどだいら}" });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*\{漢字\|よみ\} の形で書いてください/,
    );
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

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは" }],
      silent: 0,
    });
  });

  it("正常系: text が文字列リテラルの配列なら改行で結合する", async () => {
    const source = `${LINE_IMPORT}\nline({ text: ["こんにちは", "今日も晴れ"] });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "こんにちは\n今日も晴れ" }],
      silent: 0,
    });
  });

  it("text が配列で要素に非リテラルを含むと位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nconst t = "a"; line({ text: ["こんにちは", t] });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*リテラル/,
    );
  });

  it("text が空配列なら位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: [] });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*空にできません/,
    );
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
    await expect(extractLines("const x = 1;", FILE)).resolves.toEqual({
      lines: [],
      silent: 0,
    });
  });

  it("import の別名 (line as l) も拾う", async () => {
    const source = `${lineImportFor(FILE_DIR, "l")}\nl({ text: "alias" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "alias" }],
      silent: 0,
    });
  });

  it("namespace import (import * as n) 経由の n.line() も拾う", async () => {
    const source = `import * as n from "${lineSpecifierFor(FILE_DIR)}";\nn.line({ text: "namespace" });`;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [{ text: "namespace" }],
      silent: 0,
    });
  });

  it("無関係なモジュールの namespace import の同名プロパティ (m.line()) は拾わない", async () => {
    const source = `
      import * as m from "./theme.ts";
      m.line({ text: "unrelated" });
    `;
    const timelinePath = setupProject(source);
    const written = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(written, timelinePath)).resolves.toEqual({
      lines: [],
      silent: 0,
    });
  });

  it("ローカルの line 関数 (import ではない) は拾わない", async () => {
    const source = `
      function line(props: { text: string }) { return props; }
      line({ text: "local" });
    `;

    await expect(extractLines(source, FILE)).resolves.toEqual({
      lines: [],
      silent: 0,
    });
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

    await expect(extractLines(source, timelinePath)).resolves.toEqual({
      lines: [{ text: "a", voice: { speaker: 13, speed: 1, pitch: 0 } }],
      silent: 0,
    });
  });

  it("voice に spread (...narrator) と上書きを渡せる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./theme.ts";
      line({ text: "a", voice: { ...narrator, speed: 0.9 } });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual({
      lines: [{ text: "a", voice: { speaker: 13, speed: 0.9, pitch: 0 } }],
      silent: 0,
    });
  });

  it("voice に同じファイルの top-level const を渡せる", async () => {
    const timelinePath = setupProject(`
      import { narrator } from "./theme.ts";
      const calm = { ...narrator, volume: 0.8 };
      line({ text: "a", voice: calm });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual({
      lines: [
        { text: "a", voice: { speaker: 13, speed: 1, pitch: 0, volume: 0.8 } },
      ],
      silent: 0,
    });
  });

  it("voice にプロパティアクセス (speeds.slow) を渡せる", async () => {
    const timelinePath = setupProject(`
      import { speeds } from "./theme.ts";
      line({ text: "a", voice: speeds.slow });
    `);
    const source = fs.readFileSync(timelinePath, "utf-8");

    await expect(extractLines(source, timelinePath)).resolves.toEqual({
      lines: [{ text: "a", voice: { speaker: 13, speed: 0.8 } }],
      silent: 0,
    });
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

  it("line() に未知のプロパティがあれば位置付きエラーになる", async () => {
    const source = `${LINE_IMPORT}\nline({ text: "a", foo: 1 });`;

    await expect(extractLines(source, FILE)).rejects.toThrow(
      /timeline\.ts:2:\d+.*未知のプロパティ/,
    );
  });

  describe("by (ADR-0011)", () => {
    const CHARACTER_IMPORT = characterImportFor(FILE_DIR);

    it("同じファイルの const (character() の呼び出し) の voice を読み、expressions は評価しない", async () => {
      // unresolved() は評価すれば throw する関数呼び出し。expressions に
      // 置いても読み飛ばされ (voice しか読まない)、エラーにならないことで
      // expressions を評価していないことを示す。
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({
          voice: { speaker: 13 },
          expressions: { normal: [unresolved()] },
        });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13 } }],
        silent: 0,
      });
    });

    it("同じファイルの const の voice に theme からの spread を渡せる", async () => {
      const timelinePath = setupProject(
        (dir) => `
          ${characterImportFor(dir)}
          import { narrator } from "./theme.ts";
          const hero = character({
            voice: { ...narrator, speed: 0.9 },
            expressions: { normal: [] },
          });
          line({ text: "a", by: hero });
        `,
      );
      const source = fs.readFileSync(timelinePath, "utf-8");

      await expect(extractLines(source, timelinePath)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13, speed: 0.9, pitch: 0 } }],
        silent: 0,
      });
    });

    it("import した character (別モジュールの export) の voice を読む", async () => {
      const timelinePath = setupProject(
        `
          import { hero } from "./characters.ts";
          line({ text: "a", by: hero });
        `,
        {
          "characters.ts": (dir) => `
            ${characterImportFor(dir)}
            export const hero = character({
              voice: { speaker: 20 },
              expressions: { normal: ["body.png"] },
            });
          `,
        },
      );
      const source = fs.readFileSync(timelinePath, "utf-8");

      await expect(extractLines(source, timelinePath)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 20 } }],
        silent: 0,
      });
    });

    it("line().voice が by.voice を上書きする", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({
          voice: { speaker: 13, speed: 1 },
          expressions: { normal: [] },
        });
        line({ text: "a", by: hero, voice: { speed: 0.9 } });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13, speed: 0.9 } }],
        silent: 0,
      });
    });

    it("by に voice が無ければ line() に voice が付かない", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({ expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a" }],
        silent: 0,
      });
    });

    it("character 経由の import エイリアスでも通る", async () => {
      const source = `${LINE_IMPORT}
        import { character as c } from "${characterSpecifierFor(FILE_DIR)}";
        const hero = c({ voice: { speaker: 13 }, expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13 } }],
        silent: 0,
      });
    });

    it("character() の voice を shorthand ({ voice }) で書いても読める (#4)", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const voice = { speaker: 13 };
        const hero = character({ voice, expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13 } }],
        silent: 0,
      });
    });

    it('character() の voice を文字列リテラルキー ("voice": ...) で書いても読める (#4)', async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({ "voice": { speaker: 13 }, expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13 } }],
        silent: 0,
      });
    });

    it("character() の引数に spread があれば位置付きエラーになる (#4)", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const base = { voice: { speaker: 13 } };
        const hero = character({ ...base, expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /character\(\) の引数は voice を「voice: 式」か「voice」の形で書き、spread と computed key は使えません/,
      );
    });

    it('character() の引数の voice が computed property name (["voice"]: ...) なら位置付きエラーになる (#16)', async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({ ["voice"]: { speaker: 13 }, expressions: { normal: [] } });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /character\(\) の引数は voice を「voice: 式」か「voice」の形で書き、spread と computed key は使えません/,
      );
    });

    it("character() の引数の voice が getter の形なら専用のエラーになる (#18)", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({
          get voice() { return { speaker: 13 }; },
          expressions: { normal: [] },
        });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /character\(\) の引数の voice はメソッド・getter の形では書けません \(「voice: 式」か「voice」で書いてください\)/,
      );
    });

    it("character() の引数の voice がメソッドの形なら専用のエラーになる (#18)", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({
          voice() { return { speaker: 13 }; },
          expressions: { normal: [] },
        });
        line({ text: "a", by: hero });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /character\(\) の引数の voice はメソッド・getter の形では書けません \(「voice: 式」か「voice」で書いてください\)/,
      );
    });

    it("expression (文字列リテラル) は読み飛ばされ、出力に含まれない", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({
          voice: { speaker: 13 },
          expressions: { normal: [] },
        });
        line({ text: "a", by: hero, expression: "normal" });
      `;

      await expect(extractLines(source, FILE)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 13 } }],
        silent: 0,
      });
    });

    it("expression が非リテラルなら位置付きエラーになる", async () => {
      const source = `${LINE_IMPORT}
        ${CHARACTER_IMPORT}
        const hero = character({ expressions: { normal: [] } });
        const e = "normal";
        line({ text: "a", by: hero, expression: e });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(/リテラル/);
    });

    it("by が識別子でなければ位置付きエラーになる", async () => {
      const source = `${LINE_IMPORT}\nline({ text: "a", by: { voice: {} } });`;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /line\(\)\.by は識別子で書いてください/,
      );
    });

    it("by が指す const が character() の呼び出しでなければ位置付きエラーになる", async () => {
      const source = `${LINE_IMPORT}
        const notACharacter = { voice: { speaker: 13 } };
        line({ text: "a", by: notACharacter });
      `;

      await expect(extractLines(source, FILE)).rejects.toThrow(
        /character\(\) の呼び出しで書いてください/,
      );
    });
  });

  describe("loadModule のキャッシュバスト (#1)", () => {
    it("import 先のファイルを書き換えて mtime が変われば、再抽出で新しい voice を読む", async () => {
      const characterSource = (voice: number) => (dir: string) => `
        ${characterImportFor(dir)}
        export const hero = character({
          voice: { speaker: ${voice} },
          expressions: { normal: ["body.png"] },
        });
      `;

      const timelinePath = setupProject(
        `
          import { hero } from "./characters.ts";
          line({ text: "a", by: hero });
        `,
        { "characters.ts": characterSource(1) },
      );
      const source = fs.readFileSync(timelinePath, "utf-8");

      await expect(extractLines(source, timelinePath)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 1 } }],
        silent: 0,
      });

      const charactersPath = path.join(
        path.dirname(timelinePath),
        "characters.ts",
      );
      fs.writeFileSync(
        charactersPath,
        characterSource(2)(path.dirname(timelinePath)),
      );

      // 同一プロセス内の書き込みは mtime が変わらないことがある (整数秒
      // 粒度のファイルシステム等) ため、明示的に未来へずらす (dev 中の
      // 実際の再保存でも mtime さえ変われば再読み込みされることの確認)。
      const futureEpochSeconds =
        Temporal.Now.instant().epochMilliseconds / 1000 + 60;
      fs.utimesSync(charactersPath, futureEpochSeconds, futureEpochSeconds);

      await expect(extractLines(source, timelinePath)).resolves.toEqual({
        lines: [{ text: "a", voice: { speaker: 2 } }],
        silent: 0,
      });
    });
  });
});
