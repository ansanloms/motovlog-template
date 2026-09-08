import {
  chapterLayout,
  endingLayout,
  figureLayout,
  fontWeight,
  noteLayout,
  palette,
  paletteRgb,
  photoLayout,
  scrim,
  shadow,
  subtitleLayout,
  thumbLayout,
  thumbScrim,
  typeScale,
} from "./tokens.ts";

// PascalCase/camelCase のキーを CSS 変数名の kebab-case に変える。
const toKebabCase = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * px を付けず値をそのまま文字列化するキー (無単位の数値、または元から文字列の値)。
 * 接尾辞の判定は大文字小文字を区別しない (先頭が小文字の "alpha" 等も拾う)。
 */
const isRawValueKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return (
    lower.endsWith("lineheight") ||
    lower.endsWith("letterspacing") ||
    lower.endsWith("alpha") ||
    key === "shadow"
  );
};

/**
 * layout トークン (数値/文字列の map) を `--<prefix>-<kebab>` の CSS 変数に
 * 流し込む。isRawValueKey に当たるキーはそのまま、それ以外は px を付ける。
 */
const addLayoutVars = (
  vars: Record<string, string>,
  prefix: string,
  layout: Record<string, string | number>,
): void => {
  for (const [key, value] of Object.entries(layout)) {
    vars[`--${prefix}-${toKebabCase(key)}`] = isRawValueKey(key)
      ? `${value}`
      : `${value}px`;
  }
};

// tokens (TS の値) から CSS 変数の map を作る。ThemeRoot がこれを AbsoluteFill
// の style に流し込み、各コンポーネントの CSS は var(--...) で参照する。
// design の :root と同名の変数名にし、design の :root と 1 対 1 で突き合わせられるようにする。
export const themeCssVars = (fontFamily: string): Record<string, string> => {
  const vars: Record<string, string> = {
    "--font": fontFamily,
    "--scrim-height": `${scrim.height}px`,
    "--scrim-bottom": scrim.bottom,
    "--subtitle-line-height": `${subtitleLayout.lineHeight}`,
    "--subtitle-bottom-offset": `${subtitleLayout.bottomOffset}px`,
    "--subtitle-max-width": `${subtitleLayout.maxWidth}px`,
    "--thumb-scrim": thumbScrim,
    "--shadow-figure": shadow.figure,
    "--shadow-photo": shadow.photo,
  };

  for (const [key, value] of Object.entries(palette)) {
    vars[`--${toKebabCase(key)}`] = value;
  }

  for (const [key, value] of Object.entries(paletteRgb)) {
    vars[`--${toKebabCase(key)}-rgb`] = value;
  }

  for (const [key, value] of Object.entries(fontWeight)) {
    vars[`--w-${toKebabCase(key)}`] = `${value}`;
  }

  for (const [key, value] of Object.entries(typeScale)) {
    vars[`--${toKebabCase(key)}`] = `${value}px`;
  }

  addLayoutVars(vars, "chapter", chapterLayout);
  addLayoutVars(vars, "note", noteLayout);
  addLayoutVars(vars, "photo", photoLayout);
  addLayoutVars(vars, "figure", figureLayout);
  addLayoutVars(vars, "thumb", thumbLayout);
  addLayoutVars(vars, "ending", endingLayout);

  return vars;
};
