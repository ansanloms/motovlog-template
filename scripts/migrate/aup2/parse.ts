// AviUtl ExEdit2 の project ファイル (.aup2) を読む純粋関数 (#5)。
//
// .aup2 は INI 風のテキストで、セクション見出しが 3 種類ある。
// - `[project]`・`[scene.N]`: ファイル全体とシーンの設定 (header)
// - `[N]`: オブジェクト 1 つ (layer・frame・group・name)
// - `[N.M]`: オブジェクト N の M 番目のフィルタ (先頭が effect.name)
//
// 値は `キー=値` の 1 行で、キーもフィルタ名も日本語。改行は CRLF。ここでは
// 意味の解釈をせず、文字列のまま構造化するだけに留める (どのフィルタの
// どのパラメータを DSL の何に写すかは plan.ts が決める)。

/** オブジェクトに掛かるフィルタ 1 つ (`[N.M]` セクション)。 */
export type Aup2Filter = {
  /** `effect.name` の値 (例 "動画ファイル"・"標準描画")。 */
  readonly name: string;
  /** `effect.name` 以外のキーと値 (文字列のまま)。 */
  readonly params: Readonly<Record<string, string>>;
};

/** オブジェクト 1 つ (`[N]` セクション)。 */
export type Aup2Object = {
  /** セクション見出しの番号。 */
  readonly id: number;
  /** 置かれている layer (0 起点、大きいほど上)。 */
  readonly layer: number;
  /** 占有するフレームの範囲 (両端を含む)。 */
  readonly frame: readonly [number, number];
  /** グループ番号 (`group`)。同じ値のオブジェクトが 1 組。無ければ undefined。 */
  readonly group?: number;
  /** オブジェクト名 (`name`)。無ければ undefined。 */
  readonly name?: string;
  /** 掛かっているフィルタ (`[N.M]` の順)。 */
  readonly filters: readonly Aup2Filter[];
};

/** .aup2 1 ファイル分。 */
export type Aup2 = {
  /** `[project]`・`[scene.N]` 等、オブジェクト以外のセクション (セクション名 → キーと値)。 */
  readonly header: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** オブジェクト (ファイルに現れた順)。 */
  readonly objects: readonly Aup2Object[];
};

/** 組み立て途中のオブジェクト (filters を後から足すため mutable)。 */
type ObjectDraft = {
  id: number;
  layer?: number;
  frame?: [number, number];
  group?: number;
  name?: string;
  filters: { name: string; params: Record<string, string> }[];
};

const OBJECT_SECTION = /^\[(\d+)\]$/;
const FILTER_SECTION = /^\[(\d+)\.(\d+)\]$/;
const HEADER_SECTION = /^\[([^\]]+)\]$/;

/** `frame=開始,終了` を数値の組に直す。 */
const parseFrameRange = (value: string, id: number): [number, number] => {
  const parts = value.split(",");

  if (parts.length !== 2) {
    throw new Error(`aup2: [${id}] の frame の形が不正です: ${value}`);
  }

  const start = Number(parts[0]);
  const end = Number(parts[1]);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    throw new Error(`aup2: [${id}] の frame の値が不正です: ${value}`);
  }

  return [start, end];
};

/**
 * .aup2 のテキストを { header, objects } に読む。CRLF・LF のどちらでも
 * 読める。`キー=値` は最初の `=` で分け、値に含まれる `=` はそのまま残す
 * (`再生位置=...` のようにカンマ区切りの値がある)。フィルタの外に現れた
 * `effect.name` や、オブジェクトの外に現れた `[N.M]` は不正として throw
 * する。オブジェクトに layer・frame が無い場合も throw する。
 */
export const parseAup2 = (text: string): Aup2 => {
  const header: Record<string, Record<string, string>> = {};
  const drafts: ObjectDraft[] = [];
  const byId = new Map<number, ObjectDraft>();

  let currentHeader: Record<string, string> | undefined;
  let currentObject: ObjectDraft | undefined;
  let currentFilter: ObjectDraft["filters"][number] | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      continue;
    }

    const objectMatch = OBJECT_SECTION.exec(trimmed);

    if (objectMatch) {
      const id = Number(objectMatch[1]);

      if (byId.has(id)) {
        throw new Error(`aup2: オブジェクト [${id}] が重複しています`);
      }

      const draft: ObjectDraft = { id, filters: [] };

      drafts.push(draft);
      byId.set(id, draft);
      currentHeader = undefined;
      currentObject = draft;
      currentFilter = undefined;
      continue;
    }

    const filterMatch = FILTER_SECTION.exec(trimmed);

    if (filterMatch) {
      const id = Number(filterMatch[1]);
      const owner = byId.get(id);

      if (owner === undefined) {
        throw new Error(
          `aup2: フィルタ [${trimmed}] の親オブジェクト [${id}] がありません`,
        );
      }

      const filter: ObjectDraft["filters"][number] = { name: "", params: {} };

      owner.filters.push(filter);
      currentHeader = undefined;
      currentObject = owner;
      currentFilter = filter;
      continue;
    }

    const headerMatch = HEADER_SECTION.exec(trimmed);

    if (headerMatch) {
      const section: Record<string, string> = {};

      header[headerMatch[1]] = section;
      currentHeader = section;
      currentObject = undefined;
      currentFilter = undefined;
      continue;
    }

    const separator = raw.indexOf("=");

    if (separator === -1) {
      throw new Error(`aup2: セクションでも キー=値 でもない行です: ${raw}`);
    }

    const key = raw.slice(0, separator).trim();
    const value = raw.slice(separator + 1);

    if (currentFilter) {
      if (key === "effect.name") {
        currentFilter.name = value;
      } else {
        currentFilter.params[key] = value;
      }
      continue;
    }

    if (currentObject) {
      if (key === "layer") {
        currentObject.layer = Number(value);
      } else if (key === "frame") {
        currentObject.frame = parseFrameRange(value, currentObject.id);
      } else if (key === "group") {
        currentObject.group = Number(value);
      } else if (key === "name") {
        currentObject.name = value;
      }
      continue;
    }

    if (currentHeader) {
      currentHeader[key] = value;
      continue;
    }

    throw new Error(`aup2: セクションの外に キー=値 があります: ${raw}`);
  }

  const objects = drafts.map((draft) => {
    if (draft.layer === undefined || !Number.isInteger(draft.layer)) {
      throw new Error(`aup2: [${draft.id}] に layer がありません`);
    }

    if (draft.frame === undefined) {
      throw new Error(`aup2: [${draft.id}] に frame がありません`);
    }

    for (const filter of draft.filters) {
      if (filter.name === "") {
        throw new Error(
          `aup2: [${draft.id}] に effect.name の無いフィルタがあります`,
        );
      }
    }

    return {
      id: draft.id,
      layer: draft.layer,
      frame: draft.frame,
      ...(draft.group !== undefined ? { group: draft.group } : {}),
      ...(draft.name !== undefined ? { name: draft.name } : {}),
      filters: draft.filters,
    } satisfies Aup2Object;
  });

  return { header, objects };
};

/** オブジェクトから name のフィルタを探す (無ければ undefined)。 */
export const findFilter = (
  object: Aup2Object,
  name: string,
): Aup2Filter | undefined => object.filters.find((f) => f.name === name);

/**
 * フィルタのパラメータを数値で読む。フィルタもキーも無い場合は fallback を
 * 返す。値が数値にならない場合は throw する。
 */
export const numberParam = (
  filter: Aup2Filter | undefined,
  key: string,
  fallback: number,
): number => {
  const raw = filter?.params[key];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(
      `aup2: ${filter?.name ?? "?"} の ${key} が数値ではありません: ${raw}`,
    );
  }

  return value;
};
