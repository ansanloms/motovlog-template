// projects/<slug>/timeline.ts を TypeScript の compiler API で静的解析し、
// line({ text, reading?, voice?, by?, expression? }) 呼び出しの text・reading
// と実効の voice を集める (ADR-0010, ADR-0011)。
//
// watcher (scripts/voice.ts --watch) が timeline.ts の変更ごとに実行時
// import せずこれを使う理由: 実行時 import は narration() の
// 音声キャッシュ待ち (Studio の delayRender 相当) を伴い、watcher 自身が
// 生成元になる構造と噛み合わない。
//
// text・reading は文字列リテラルまたは置換無しテンプレートリテラル、あるいは
// それらの配列 (空配列は不可、`\n` で結合する) に限る (narration.ts の
// line() の JSDoc)。どちらも結合した文字列が {漢字|よみ} 記法が壊れて
// いれば (assertReadingNotation()) 位置付きで throw する。voice は次の式
// だけを読める。
// - リテラル (文字列・数値・真偽・null・置換無しテンプレート)
// - オブジェクトリテラル (キーはリテラルのみ。値は再帰的に評価。
//   spread (...expr) は評価結果のオブジェクトを展開する)
// - 識別子 (同じファイルの top-level const、または import の binding。
//   import は timeline.ts からの相対パスを Node の動的 import() で読む)
// - プロパティアクセス (a.b)
// それ以外 (関数呼び出し・条件式・置換ありテンプレート・計算式等) は
// timeline.ts 内の位置 (行:列) 付きで throw する。voice が null リテラルに
// 評価されれば声無し (wav・lipsync を作らない) として、その行を
// extractLines() の lines から除外し、件数を silent に集計する (reading と
// voice: null を同時に指定すると位置付きで throw する)。
//
// by は識別子に限る。次のいずれかに解決し、その voice プロパティ (無ければ
// undefined) だけを読む (expressions は評価しない)。
// - 同じファイルの top-level const で、初期化式が character() の呼び出し
//   (character() の実体、src/compositions/character.ts の export を指す
//   import に解決されるものに限る)。
// - import の binding (character() の呼び出し結果を export しているモジュール
//   を動的 import() で読む)。
// expression は文字列リテラル・置換無しテンプレートリテラルに限り、値は
// 読み飛ばす (extractLines() の出力には含めない)。
// 実効の voice は mergeVoice(by の voice, line() 自身の voice) (実行時の
// narration.ts と同じ関数を使い、静的解析側と実行時側で結果を一致させる)。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ts from "typescript";
import { VOICE_KEYS } from "../../src/voice/cache.ts";
import type { VoiceOptions } from "../../src/voice/cache.ts";
import { mergeVoice } from "../../src/voice/key.ts";
import { assertReadingNotation } from "../../src/voice/reading.ts";

const LIB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src",
);

// lib を bare specifier で参照する利用側 (外部リポジトリ) の import 元
// (package.json の exports、ADR-0012)。同じリポジトリ内の利用側は相対 import
// で下の絶対パスに解決される。
const LIB_PACKAGE_SPECIFIERS = [
  "motovlog-template",
  "motovlog-template/compositions",
];

// line() を export する lib のモジュール (実体と、そこへ再 export する入口)
// の絶対パス。findLineCalls() は import がこのいずれかに解決されるものだけを
// 発話の呼び出しと見なす (単なる識別子名 "line" の一致では、import の別名や
// 無関係な同名のローカル関数を誤検出するため)。
const NARRATION_MODULES = [
  path.join(LIB_DIR, "compositions/narration.ts"),
  path.join(LIB_DIR, "compositions/index.ts"),
  path.join(LIB_DIR, "index.ts"),
];

// character() を export する lib のモジュールの絶対パス。isCharacterCall() は
// import がこのいずれかに解決されるものだけを character() の呼び出しと見なす
// (isNarrationLineCall() と同じ理由)。
const CHARACTER_MODULES = [
  path.join(LIB_DIR, "compositions/character.ts"),
  path.join(LIB_DIR, "compositions/index.ts"),
  path.join(LIB_DIR, "index.ts"),
];

/**
 * import の specifier が lib の入口を指すかどうかを見る。bare specifier
 * (外部リポジトリからの依存) は文字列一致、相対 specifier は timeline.ts の
 * ディレクトリを起点に解決した絶対パスで突き合わせる。
 */
const specifierIsLibModule = (
  context: EvalContext,
  specifier: string,
  modules: readonly string[],
): boolean =>
  LIB_PACKAGE_SPECIFIERS.includes(specifier) ||
  modules.includes(path.resolve(path.dirname(context.fileName), specifier));

/** extractLines() が返す 1 件 (line() 呼び出し 1 回分)。 */
export type ExtractedLine = {
  /** line() の text (リテラル、配列なら結合済み)。 */
  text: string;
  /** line() の reading (リテラル、配列なら結合済み)。省略時は undefined (合成には text をそのまま使う)。 */
  reading?: string;
  /** line() の実効の voice (mergeVoice(by の voice, line() 自身の voice))。省略時は undefined。 */
  voice?: VoiceOptions;
};

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
// 動的 import() で読む。同じ specifier は 1 度しか読み込まない。URL に
// ファイルの mtime をクエリとして付ける (dev 中に characters/<name>.ts 等を
// 書き換えたときに Node の ESM キャッシュが古いモジュールを返すのを防ぐ。
// `Date` は ESLint で禁止のため mtimeMs (fs.statSync) を使う)。
const loadModule = async (
  context: EvalContext,
  specifier: string,
  node: ts.Node,
): Promise<unknown> => {
  const resolved = path.resolve(path.dirname(context.fileName), specifier);

  let mtimeMs: number;

  try {
    mtimeMs = fs.statSync(resolved).mtimeMs;
  } catch (error) {
    throw new ExtractLineError(
      `${positionOf(context.sourceFile, node)}: ${specifier} を読み込めません: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const url = `${pathToFileURL(resolved).href}?mtime=${mtimeMs}`;

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

/**
 * import の binding が指す export を動的 import() で読んで返す。
 * resolveIdentifier() (voice の評価器) と resolveByVoice() (line().by の
 * 解決) の両方が使う。
 */
const resolveImportedValue = async (
  binding: ImportBinding,
  context: EvalContext,
  node: ts.Node,
): Promise<unknown> => {
  const mod = await loadModule(context, binding.specifier, node);

  if (binding.kind === "namespace") {
    return mod;
  }

  const exportName =
    binding.kind === "default" ? "default" : binding.importedName;

  if (typeof mod !== "object" || mod === null || !(exportName in mod)) {
    throw new ExtractLineError(
      `${positionOf(context.sourceFile, node)}: ${binding.specifier} に export ${exportName} がありません`,
    );
  }

  return (mod as Record<string, unknown>)[exportName];
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
    return resolveImportedValue(binding, context, node);
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: ${label} は同じファイルの const か import の識別子で書いてください (${name} は見つかりません)`,
  );
};

// unwrap しても character() の呼び出しかどうかを見るための括弧・as・
// satisfies の除去。evaluateExpr() の同種の分岐と役割は同じだが、こちらは
// 式を評価せず ts.Expression のまま返す (character() 呼び出しの形を見る
// ためだけに使う)。
const unwrapExpr = (node: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(node)) {
    return unwrapExpr(node.expression);
  }

  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrapExpr(node.expression);
  }

  return node;
};

// specifier が character() を export する lib のモジュールを指すかどうかを見る。
const specifierIsCharacterModule = (
  context: EvalContext,
  specifier: string,
): boolean => specifierIsLibModule(context, specifier, CHARACTER_MODULES);

/**
 * call の callee が character.ts の character (import の別名・namespace
 * import 経由を含む) を指す import の binding に解決されるかどうかを見る。
 * isNarrationLineCall() と同じ考え方。
 */
const isCharacterCall = (
  node: ts.Node,
  context: EvalContext,
): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  const { expression } = node;

  if (ts.isIdentifier(expression)) {
    const binding = context.imports.get(expression.text);

    return (
      binding !== undefined &&
      binding.kind === "named" &&
      binding.importedName === "character" &&
      specifierIsCharacterModule(context, binding.specifier)
    );
  }

  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.name.text === "character"
  ) {
    const binding = context.imports.get(expression.expression.text);

    return (
      binding !== undefined &&
      binding.kind === "namespace" &&
      specifierIsCharacterModule(context, binding.specifier)
    );
  }

  return false;
};

/**
 * line().voice・character().voice の値 (evaluateExpr() の結果) を、
 * VOICE_KEYS にあるキーだけを持つ有限数値のオブジェクトかどうか検査する。
 * line().voice も character().voice も同じ規則で検査するため、ここに
 * まとめる。
 */
const validateVoice = (
  value: unknown,
  label: string,
  node: ts.Node,
): VoiceOptions => {
  const sourceFile = node.getSourceFile();

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, node)}: ${label} はオブジェクトで書いてください`,
    );
  }

  for (const [voiceKey, voiceValue] of Object.entries(value)) {
    if (!(VOICE_KEYS as readonly string[]).includes(voiceKey)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${label} に未知のキー ${voiceKey} があります (使えるのは ${VOICE_KEYS.join("・")})`,
      );
    }

    if (!Number.isFinite(voiceValue)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${label}.${voiceKey} は有限の数値で書いてください (${String(voiceValue)})`,
      );
    }
  }

  return value as VoiceOptions;
};

// character() の引数の property の名前 (PropertyName) が "voice" かどうかを
// 見る。識別子・文字列リテラルのキーだけを対象にする (resolveByVoice() の
// 検査と解決の両方が使う)。
const propertyKeyIsVoice = (name: ts.PropertyName): boolean =>
  (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === "voice";

/**
 * line().by (識別子) が指す character() の voice を解決する。
 * - 同じファイルの top-level const: 初期化式 (括弧・as・satisfies は
 *   unwrap) が character() の呼び出しでなければ throw。呼び出しの引数
 *   (オブジェクトリテラル 1 個) から voice プロパティだけを読み、
 *   expressions は評価しない。voice は `voice: 式` (識別子・文字列リテラル
 *   キー) か shorthand (`{ voice }`、識別子として解決する) の形に限る。
 *   引数に spread があるか、voice がそれ以外の形 (メソッド・getter 等) で
 *   あれば throw する (静的解析が実行時の key と食い違うのを防ぐ)。
 * - import の binding: 動的 import() で export を読み、その voice
 *   プロパティを読む (export 自体がオブジェクトでなければ throw)。
 * どちらの経路でも voice が無ければ undefined を返す。
 */
const resolveByVoice = async (
  node: ts.Identifier,
  context: EvalContext,
): Promise<VoiceOptions | undefined> => {
  const { sourceFile, consts, imports } = context;
  const name = node.text;

  const constInit = consts.get(name);

  if (constInit) {
    const unwrapped = unwrapExpr(constInit);

    if (!isCharacterCall(unwrapped, context)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: line().by が指す const は character() の呼び出しで書いてください`,
      );
    }

    const [arg, ...rest] = unwrapped.arguments;

    if (!arg || rest.length > 0 || !ts.isObjectLiteralExpression(arg)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: line().by が指す const は character() の呼び出しで書いてください`,
      );
    }

    let voiceProp:
      ts.PropertyAssignment | ts.ShorthandPropertyAssignment | undefined;

    for (const prop of arg.properties) {
      if (ts.isSpreadAssignment(prop)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: character() の引数は voice を「voice: 式」か「voice」の形で書き、spread と computed key は使えません`,
        );
      }

      // computed property name (["voice"]: ...) は静的に "voice" かどうか
      // 判定できず、propertyKeyIsVoice() が false を返して黙って読み飛ばすと
      // 静的解析側の key と実行時の key (character() が実際に読むプロパティ)
      // が食い違う (#16)。spread と同じく throw で弾く。
      if (ts.isComputedPropertyName(prop.name)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: character() の引数は voice を「voice: 式」か「voice」の形で書き、spread と computed key は使えません`,
        );
      }

      if (!propertyKeyIsVoice(prop.name)) {
        continue;
      }

      if (
        !ts.isPropertyAssignment(prop) &&
        !ts.isShorthandPropertyAssignment(prop)
      ) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: character() の引数の voice はメソッド・getter の形では書けません (「voice: 式」か「voice」で書いてください)`,
        );
      }

      voiceProp = prop;
    }

    if (!voiceProp) {
      return undefined;
    }

    const value = ts.isShorthandPropertyAssignment(voiceProp)
      ? await resolveIdentifier(voiceProp.name, context, "character().voice")
      : await evaluateExpr(voiceProp.initializer, context, "character().voice");

    return validateVoice(value, "character().voice", voiceProp);
  }

  const binding = imports.get(name);

  if (binding) {
    const exported = await resolveImportedValue(binding, context, node);

    if (typeof exported !== "object" || exported === null) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: line().by はオブジェクトで書いてください`,
      );
    }

    const voice = (exported as Record<string, unknown>).voice;

    return voice === undefined
      ? undefined
      : validateVoice(voice, "line().by.voice", node);
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: line().by は同じファイルの const か import の識別子で書いてください (${name} は見つかりません)`,
  );
};

/**
 * voice に書ける式を評価する。リテラル・オブジェクトリテラル (spread 込み)・
 * 識別子 (同じファイルの top-level const か import)・プロパティアクセスだけ
 * を扱う。それ以外 (関数呼び出し・条件式・置換ありテンプレート等) は
 * throw する。括弧・as・satisfies の除去は unwrapExpr() に任せる
 * (character() の呼び出し判定と二重実装しない)。
 */
const evaluateExpr = async (
  node: ts.Expression,
  context: EvalContext,
  label: string,
): Promise<unknown> => {
  const { sourceFile } = context;
  const expr = unwrapExpr(node);

  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }

  if (ts.isNumericLiteral(expr)) {
    return Number(expr.text);
  }

  if (
    ts.isPrefixUnaryExpression(expr) &&
    (expr.operator === ts.SyntaxKind.MinusToken ||
      expr.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(expr.operand)
  ) {
    const value = Number(expr.operand.text);

    return expr.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }

  if (expr.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expr.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isObjectLiteralExpression(expr)) {
    const result: Record<string, unknown> = {};
    const seen = new Set<string>();

    for (const prop of expr.properties) {
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

  if (ts.isIdentifier(expr)) {
    return resolveIdentifier(expr, context, label);
  }

  if (ts.isPropertyAccessExpression(expr)) {
    const base = await evaluateExpr(expr.expression, context, label);

    if (typeof base !== "object" || base === null) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, expr)}: ${label} はオブジェクトのプロパティにアクセスできません`,
      );
    }

    const propName = expr.name.text;

    if (!(propName in base)) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, expr)}: ${label} に ${propName} がありません`,
      );
    }

    return (base as Record<string, unknown>)[propName];
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, expr)}: ${label} は評価できません (関数呼び出し・条件式・置換ありテンプレート・計算式等は使えません)`,
  );
};

// 文字列リテラル・置換無しテンプレートかどうかだけを見る (配列の要素の検査に
// 使う。要素自体を配列にはできない)。
const isTextLiteral = (
  node: ts.Expression,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/**
 * リテラル (文字列・置換無しテンプレート) か、それらの配列 (空配列は不可) を
 * 読む。配列は `\n` で結合する (narration.ts の joinLines() と同じ規則)。
 */
const readTextLiteral = (
  sourceFile: ts.SourceFile,
  node: ts.Expression,
  label: string,
): string => {
  if (isTextLiteral(node)) {
    return node.text;
  }

  if (ts.isArrayLiteralExpression(node)) {
    if (node.elements.length === 0) {
      throw new ExtractLineError(
        `${positionOf(sourceFile, node)}: ${label} の配列は空にできません`,
      );
    }

    return node.elements
      .map((el) => {
        if (!isTextLiteral(el)) {
          throw new ExtractLineError(
            `${positionOf(sourceFile, el)}: ${label} の配列の要素はリテラル (文字列・置換無しテンプレート) で書いてください`,
          );
        }

        return el.text;
      })
      .join("\n");
  }

  throw new ExtractLineError(
    `${positionOf(sourceFile, node)}: ${label} はリテラル (文字列・置換無しテンプレート) か、それらの配列で書いてください`,
  );
};

/** assertReadingNotation() の throw を位置情報付きの ExtractLineError に包み直す。 */
const assertReadingNotationAt = (
  sourceFile: ts.SourceFile,
  node: ts.Node,
  text: string,
): void => {
  try {
    assertReadingNotation(text);
  } catch (error) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, node)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * line() 呼び出し 1 回分を読む。voice に null リテラルが来た (声無し) 場合は
 * undefined を返し、呼び出し側 (extractLines()) が抽出結果から除外する。
 */
const readLineCall = async (
  sourceFile: ts.SourceFile,
  call: ts.CallExpression,
  context: EvalContext,
): Promise<ExtractedLine | undefined> => {
  const [arg, ...rest] = call.arguments;

  if (!arg || rest.length > 0 || !ts.isObjectLiteralExpression(arg)) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, call)}: line() はオブジェクトリテラル 1 個で呼び出してください`,
    );
  }

  const seen = new Set<string>();
  let text: string | undefined;
  let reading: string | undefined;
  let readingNode: ts.Expression | undefined;
  let voice: VoiceOptions | null | undefined;
  let by: ts.Identifier | undefined;

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
      assertReadingNotationAt(sourceFile, prop.initializer, text);
      continue;
    }

    if (key === "reading") {
      reading = readTextLiteral(sourceFile, prop.initializer, "line().reading");
      readingNode = prop.initializer;

      if (reading === "") {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop.initializer)}: line().reading を空文字にはできません (声無しは voice: null で書いてください)`,
        );
      }

      assertReadingNotationAt(sourceFile, prop.initializer, reading);
      continue;
    }

    if (key === "voice") {
      const value = await evaluateExpr(
        prop.initializer,
        context,
        "line().voice",
      );

      voice =
        value === null ? null : validateVoice(value, "line().voice", prop);
      continue;
    }

    if (key === "by") {
      if (!ts.isIdentifier(prop.initializer)) {
        throw new ExtractLineError(
          `${positionOf(sourceFile, prop)}: line().by は識別子で書いてください`,
        );
      }

      by = prop.initializer;
      continue;
    }

    if (key === "expression") {
      // expression の値は読み飛ばす (リテラルであることだけを検査する)。
      readTextLiteral(sourceFile, prop.initializer, "line().expression");
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

  if (voice === null && readingNode !== undefined) {
    throw new ExtractLineError(
      `${positionOf(sourceFile, readingNode)}: 声無しの行 (voice: null) に reading は書けません`,
    );
  }

  if (voice === null) {
    // 声無し: wav・lipsync を作らないため抽出結果から除外する。
    return undefined;
  }

  const byVoice = by ? await resolveByVoice(by, context) : undefined;
  const mergedVoice = mergeVoice(byVoice, voice);

  return {
    text,
    ...(reading !== undefined ? { reading } : {}),
    ...(mergedVoice !== undefined ? { voice: mergedVoice } : {}),
  };
};

// specifier が line() を export する lib のモジュールを指すかどうかを見る。
const specifierIsNarrationModule = (
  context: EvalContext,
  specifier: string,
): boolean => specifierIsLibModule(context, specifier, NARRATION_MODULES);

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

/** extractLines() の戻り値。 */
export type ExtractResult = {
  /** 声のある line() 呼び出し (声無し = voice: null を除く)。 */
  lines: ExtractedLine[];
  /** voice: null で除外した (声無しの) line() 呼び出しの件数。 */
  silent: number;
};

/**
 * timeline.ts のソースを解析し、line({...}) 呼び出しの text・voice をすべて
 * 集める。line() は lib の入口 (src/compositions/narration.ts・
 * src/compositions/index.ts・src/index.ts、または bare specifier の
 * motovlog-template・motovlog-template/compositions) からの import (別名を
 * 含む) に解決されるものだけを対象にする。text はリテラル (文字列・置換無し
 * テンプレート) か、それらの配列限定、voice は上記の評価器が読める式限定
 * で、それ以外があれば位置情報付きのエラーを投げる。voice の import 解決のため、
 * timeline.ts と同じディレクトリを起点に Node の動的 import() を行う。
 * voice: null (声無し) の呼び出しは lines から除外し、件数を silent に
 * 集計する (呼び出し側が「発話が 0 件」を lines.length だけで判定して
 * 誤警告しないため)。
 */
export const extractLines = async (
  sourceText: string,
  fileName: string,
): Promise<ExtractResult> => {
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
  let silent = 0;

  for (const call of calls) {
    const line = await readLineCall(sourceFile, call, context);

    if (line === undefined) {
      silent++;
      continue;
    }

    lines.push(line);
  }

  return { lines, silent };
};
