// projects/<slug>/timeline.ts を TypeScript の compiler API で静的解析し、
// line({ text, voice? }) 呼び出しの text と voice を集める (ADR-0010)。
//
// watcher (scripts/voice.ts --watch) が timeline.ts の変更ごとに実行時
// import せずこれを使う理由: 実行時 import は narration() の
// 音声キャッシュ待ち (Studio の delayRender 相当) を伴い、watcher 自身が
// 生成元になる構造と噛み合わない。
//
// text は文字列リテラルまたは置換無しテンプレートリテラルに限る
// (narration.ts の line() の JSDoc)。voice は次の式だけを読める。
// - リテラル (文字列・数値・真偽・null・置換無しテンプレート)
// - オブジェクトリテラル (キーはリテラルのみ。値は再帰的に評価。
//   spread (...expr) は評価結果のオブジェクトを展開する)
// - 識別子 (同じファイルの top-level const、または import の binding。
//   import は timeline.ts からの相対パスを Node の動的 import() で読む)
// - プロパティアクセス (a.b)
// それ以外 (関数呼び出し・条件式・置換ありテンプレート・計算式等) は
// timeline.ts 内の位置 (行:列) 付きで throw する。

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ts from "typescript";
import { VOICE_KEYS } from "../../src/voice/cache.ts";
import type { VoiceOptions } from "../../src/voice/cache.ts";

// narration() の line() の実体 (src/compositions/narration.ts) の絶対パス。
// findLineCalls() は import がここに解決されるものだけを発話の呼び出しと
// 見なす (単なる識別子名 "line" の一致では、import の別名や無関係な同名の
// ローカル関数を誤検出するため)。
const NARRATION_MODULE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/compositions/narration.ts",
);

/** extractLines() が返す 1 件 (line() 呼び出し 1 回分)。 */
export type ExtractedLine = { text: string; voice?: VoiceOptions };

class ExtractLineError extends Error {}

const positionOf = (sourceFile: ts.SourceFile, node: ts.Node): string => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
};

/** voice の評価器が読める import の束縛。 */
type ImportBinding =
  | { kind: "named"; specifier: string; importedName: string }
  | { kind: "default"; specifier: string }
  | { kind: "namespace"; specifier: string };

/** 1 ファイル分の評価コンテキスト (top-level const・import・import 先の module cache)。 */
type EvalContext = {
  sourceFile: ts.SourceFile;
  fileName: string;
  consts: Map<string, ts.Expression>;
  imports: Map<string, ImportBinding>;
  moduleCache: Map<string, Promise<unknown>>;
  /** resolveIdentifier() が現在解決中の const 名 (循環参照の検出用)。 */
  resolvingConsts: Set<string>;
};

const buildContext = (sourceFile: ts.SourceFile): EvalContext => {
  const consts = new Map<string, ts.Expression>();
  const imports = new Map<string, ImportBinding>();

  for (const stmt of sourceFile.statements) {
    if (
      ts.isVariableStatement(stmt) &&
      (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0
    ) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          consts.set(decl.name.text, decl.initializer);
        }
      }
      continue;
    }

    if (
      ts.isImportDeclaration(stmt) &&
      stmt.importClause &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const specifier = stmt.moduleSpecifier.text;
      const clause = stmt.importClause;

      if (clause.name) {
        imports.set(clause.name.text, { kind: "default", specifier });
      }

      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          imports.set(clause.namedBindings.name.text, {
            kind: "namespace",
            specifier,
          });
        } else if (ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            const importedName = (el.propertyName ?? el.name).text;
            imports.set(el.name.text, {
              kind: "named",
              specifier,
              importedName,
            });
          }
        }
      }
    }
  }

  return {
    sourceFile,
    fileName: sourceFile.fileName,
    consts,
    imports,
    moduleCache: new Map(),
    resolvingConsts: new Set(),
  };
};

// import 先を timeline.ts (fileName) からの相対パスとして解決し、Node の
// 動的 import() で読む。同じ specifier は 1 度しか読み込まない。
const loadModule = async (
  context: EvalContext,
  specifier: string,
  node: ts.Node,
): Promise<unknown> => {
  const resolved = path.resolve(path.dirname(context.fileName), specifier);
  const url = pathToFileURL(resolved).href;

  let cached = context.moduleCache.get(url);

  if (!cached) {
    cached = import(/* @vite-ignore */ url).catch((error: unknown) => {
      throw new ExtractLineError(
        `${positionOf(context.sourceFile, node)}: ${specifier} を読み込めません: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    context.moduleCache.set(url, cached);
  }

  return cached;
};

const resolveIdentifier = async (
  node: ts.Identifier,
  context: EvalContext,
  label: string,
): Promise<unknown> => {
  const { sourceFile, consts, imports, resolvingConsts } = context;
  const name = node.text;

  const constInit = consts.get(name);

  if (constInit) {
    if (resolvingConsts.has(name)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${name} の定義が循環参照しています`,
      );
    }

    resolvingConsts.add(name);

    try {
      return await evaluateExpr(constInit, context, name);
    } finally {
      resolvingConsts.delete(name);
    }
  }

  const binding = imports.get(name);

  if (binding) {
    const mod = await loadModule(context, binding.specifier, node);

    if (binding.kind === "namespace") {
      return mod;
    }

    const exportName =
      binding.kind === "default" ? "default" : binding.importedName;

    if (typeof mod !== "object" || mod === null || !(exportName in mod)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${binding.specifier} に export ${exportName} がありません`,
      );
    }

    return (mod as Record<string, unknown>)[exportName];
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: ${label} は同じファイルの const か import の識別子で書いてください (${name} は見つかりません)`,
  );
};

/**
 * voice に書ける式を評価する。リテラル・オブジェクトリテラル (spread 込み)・
 * 識別子 (同じファイルの top-level const か import)・プロパティアクセスだけ
 * を扱う。それ以外 (関数呼び出し・条件式・置換ありテンプレート等) は
 * throw する。
 */
const evaluateExpr = async (
  node: ts.Expression,
  context: EvalContext,
  label: string,
): Promise<unknown> => {
  const { sourceFile } = context;

  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluateExpr(node.expression, context, label);
  }

  if (ts.isParenthesizedExpression(node)) {
    return evaluateExpr(node.expression, context, label);
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken ||
      node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const value = Number(node.operand.text);

    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    const seen = new Set<string>();

    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) {
        const spread = await evaluateExpr(
          prop.expression,
          context,
          `${label} の展開式`,
        );

        if (
          typeof spread !== "object" ||
          spread === null ||
          Array.isArray(spread)
        ) {
          throw new ExtractLineError(
            `${positionOf(sourceFile, prop)}: ${label} の ... はオブジェクトに展開できる式で書いてください`,
          );
        }

        Object.assign(result, spread);
        continue;
      }

      if (!ts.isPropertyAssignment(prop)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: ${label} のプロパティは識別子 = 式か ... の形で書いてください`,
        );
      }

      const key = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined;

      if (key === undefined) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: ${label} のプロパティキーはリテラルで書いてください`,
        );
      }

      if (seen.has(key)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: ${label}.${key} が重複しています`,
        );
      }

      seen.add(key);
      result[key] = await evaluateExpr(
        prop.initializer,
        context,
        `${label}.${key}`,
      );
    }

    return result;
  }

  if (ts.isIdentifier(node)) {
    return resolveIdentifier(node, context, label);
  }

  if (ts.isPropertyAccessExpression(node)) {
    const base = await evaluateExpr(node.expression, context, label);

    if (typeof base !== "object" || base === null) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${label} はオブジェクトのプロパティにアクセスできません`,
      );
    }

    const propName = node.name.text;

    if (!(propName in base)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${label} に ${propName} がありません`,
      );
    }

    return (base as Record<string, unknown>)[propName];
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: ${label} は評価できません (関数呼び出し・条件式・置換ありテンプレート・計算式等は使えません)`,
  );
};

const readTextLiteral = (
  sourceFile: ts.SourceFile,
  node: ts.Expression,
  label: string,
): string => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: ${label} はリテラル (文字列・置換無しテンプレート) で書いてください`,
  );
};

const readLineCall = async (
  sourceFile: ts.SourceFile,
  call: ts.CallExpression,
  context: EvalContext,
): Promise<ExtractedLine> => {
  const [arg, ...rest] = call.arguments;

  if (!arg || rest.length > 0 || !ts.isObjectLiteralExpression(arg)) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, call)}: line() はオブジェクトリテラル 1 個で呼び出してください`,
    );
  }

  const seen = new Set<string>();
  let text: string | undefined;
  let voice: VoiceOptions | undefined;

  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, prop)}: line() のプロパティは識別子 = 式の形で書いてください`,
      );
    }

    const key = prop.name.text;

    if (seen.has(key)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, prop)}: line() の ${key} が重複しています`,
      );
    }

    seen.add(key);

    if (key === "text") {
      text = readTextLiteral(sourceFile, prop.initializer, "line().text");
      continue;
    }

    if (key === "voice") {
      const value = await evaluateExpr(
        prop.initializer,
        context,
        "line().voice",
      );

      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: line().voice はオブジェクトで書いてください`,
        );
      }

      for (const [voiceKey, voiceValue] of Object.entries(value)) {
        if (!(VOICE_KEYS as readonly string[]).includes(voiceKey)) {
          throw new ExtractLineError(
            `${positionOf(sourceFile, prop)}: line().voice に未知のキー ${voiceKey} があります (使えるのは ${VOICE_KEYS.join("・")})`,
          );
        }

        if (!Number.isFinite(voiceValue)) {
          throw new ExtractLineError(
            `${positionOf(sourceFile, prop)}: line().voice.${voiceKey} は有限の数値で書いてください (${String(voiceValue)})`,
          );
        }
      }

      voice = value as VoiceOptions;
      continue;
    }

    throw new ExtractLineError(
      `${positionOf(sourceFile, prop)}: line() に未知のプロパティ ${key} があります`,
    );
  }

  if (text === undefined) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, call)}: line() に text がありません`,
    );
  }

  return voice === undefined ? { text } : { text, voice };
};

// specifier が narration.ts (line の実体) を指すかどうかを見る。
const specifierIsNarrationModule = (
  context: EvalContext,
  specifier: string,
): boolean =>
  path.resolve(path.dirname(context.fileName), specifier) === NARRATION_MODULE;

// call の callee が narration.ts の line (import の別名を含む) を指す import
// の binding に解決されるかどうかを見る。ローカルの const/関数宣言の
// "line" や、無関係なモジュールからの同名 import は拾わない。named import
// (`import { line } from "..."`) の別名呼び出しに加え、namespace import
// (`import * as n from "..."; n.line({...})`) 経由の呼び出しも拾う。
const isNarrationLineCall = (
  node: ts.CallExpression,
  context: EvalContext,
): boolean => {
  const { expression } = node;

  if (ts.isIdentifier(expression)) {
    const binding = context.imports.get(expression.text);

    return (
      binding !== undefined &&
      binding.kind === "named" &&
      binding.importedName === "line" &&
      specifierIsNarrationModule(context, binding.specifier)
    );
  }

  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.name.text === "line"
  ) {
    const binding = context.imports.get(expression.expression.text);

    return (
      binding !== undefined &&
      binding.kind === "namespace" &&
      specifierIsNarrationModule(context, binding.specifier)
    );
  }

  return false;
};

/**
 * timeline.ts のソースを解析し、line({...}) 呼び出しの text・voice をすべて
 * 集める。line() は src/compositions/narration.ts からの import (別名を
 * 含む) に解決されるものだけを対象にする。text はリテラル (文字列・置換無し
 * テンプレート) 限定、voice は上記の評価器が読める式限定で、それ以外が
 * あれば位置情報付きのエラーを投げる。voice の import 解決のため、
 * timeline.ts と同じディレクトリを起点に Node の動的 import() を行う。
 */
export const extractLines = async (
  sourceText: string,
  fileName: string,
): Promise<ExtractedLine[]> => {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2018,
    true,
    ts.ScriptKind.TS,
  );

  const context = buildContext(sourceFile);

  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isNarrationLineCall(node, context)) {
      calls.push(node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const lines: ExtractedLine[] = [];

  for (const call of calls) {
    lines.push(await readLineCall(sourceFile, call, context));
  }

  return lines;
};
