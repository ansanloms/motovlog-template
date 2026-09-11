// 立ち絵のキャラクター定義 (ADR-0011)。characters/<name>.ts が character() で
// 組み立て、line() の by に渡して figure() と結び付ける。
//
// expressions は表情名から画像レイヤーの列 (下から上の順) への対応。レイヤーは
// 次の 3 種で、画像のパスはすべて public/ 相対の文字列で書く (figure() が
// staticFile() を掛ける)。
// - 静止画 (文字列)。体・腕・眉・小物・顔色効果。
// - 目 `{ eyes: { open, closed } }`。figure() が目パチで開閉を切り替える。
// - 口 `{ mouth: { a, i, u, e, o, n } }`。figure() が口パクで母音を切り替える。
// 目・口の切り替えをしない表情は、目・口も静止画 (文字列) で書いてよい。
//
// すべてのレイヤー画像は同一キャンバスの画像 (PNG・SVG) とし、character()・figure() は
// 座標計算をしない。素材の切り出し (PSD からの書き出し等) はテンプレートの
// 外で行う。
//
// このファイル自体は Node からそのまま import できる純粋な値のモジュールと
// する (remotion・CSS・src/components を import しない。watcher
// (scripts/voice/extract.ts) が line().by から voice だけを読むため)。

import type { VoiceOptions } from "../voice/cache.ts";

/** 口の形の識別子 (母音 5 種 + 無音)。 */
export type MouthKey = "a" | "i" | "u" | "e" | "o" | "n";

/** 目 (開眼・閉眼) のレイヤー。 */
export type EyesLayer = {
  readonly eyes: { readonly open: string; readonly closed: string };
};

/** 口 (母音ごと) のレイヤー。 */
export type MouthLayer = { readonly mouth: Readonly<Record<MouthKey, string>> };

/** expressions の 1 レイヤー。静止画 (文字列) か、目・口の切り替えレイヤー。 */
export type FigureLayer = string | EyesLayer | MouthLayer;

/** 表情名から画像レイヤーの列 (下から上の順) への対応。 */
export type Expressions = Readonly<Record<string, readonly FigureLayer[]>>;

/** character() が受ける定義・返す値。voice は line() の by から実効の声質を求めるのに使う既定値。 */
export type Character = {
  /** line() の by から実効の声質を求めるのに使う既定値。省略時は theme の既定話者のみを使う。 */
  readonly voice?: VoiceOptions;
  /** 表情名から画像レイヤーの列への対応。1 つ以上必要。 */
  readonly expressions: Expressions;
};

/**
 * line()・thumbnail() の by に渡せる値。character() の参照 (表情は既定) か、
 * `{ character, expression? }` の形 (表情を明示する) のどちらか。
 */
export type ByRef =
  Character | { readonly character: Character; readonly expression?: string };

/** layer が EyesLayer かどうかを判定する。 */
export const isEyesLayer = (layer: FigureLayer): layer is EyesLayer =>
  typeof layer === "object" && layer !== null && "eyes" in layer;

/** layer が MouthLayer かどうかを判定する。 */
export const isMouthLayer = (layer: FigureLayer): layer is MouthLayer =>
  typeof layer === "object" && layer !== null && "mouth" in layer;

/**
 * キャラクターを定義する。戻り値をそのまま (同じオブジェクトの参照として)
 * line() の by・figure() の第 1 引数に渡すこと (identity が結び付けの唯一の
 * 手段、ADR-0011)。expressions が空、またはいずれかの表情のレイヤー列が空なら
 * throw する。
 */
export const character = (definition: Character): Character => {
  const names = Object.keys(definition.expressions);

  if (names.length === 0) {
    throw new Error("character(): expressions には 1 つ以上の表情が要ります");
  }

  for (const name of names) {
    if (definition.expressions[name].length === 0) {
      throw new Error(
        `character(): expressions.${name} には 1 つ以上のレイヤーが要ります`,
      );
    }
  }

  return definition;
};

/** resolveBy() が by の形を認識できないときに throw するエラーメッセージ。 */
const INVALID_BY_MESSAGE =
  "by は character() の戻り値か { character, expression? } の形で書いてください";

/** value が Character (expressions を持つオブジェクト) かどうかを判定する。 */
const looksLikeCharacter = (value: unknown): value is Character =>
  typeof value === "object" && value !== null && "expressions" in value;

/**
 * ByRef を `{ character, expression? }` に正規化する。character() の参照
 * (Character、必ず expressions を持つ) をそのまま渡した場合は expression
 * 無しとして扱う。by が null・非オブジェクト、またはオブジェクト形で
 * character が Character でない場合は、型では弾けない JS からの誤用として
 * 生の TypeError ではなく Error を throw する。
 */
export const resolveBy = (
  by: ByRef,
): { character: Character; expression?: string } => {
  if (looksLikeCharacter(by)) {
    return { character: by };
  }

  if (
    typeof by === "object" &&
    by !== null &&
    "character" in by &&
    looksLikeCharacter(by.character)
  ) {
    return by;
  }

  throw new Error(INVALID_BY_MESSAGE);
};
