import {
  fontWeight,
  palette,
  scrim,
  subtitleLayout,
  videoType,
} from "./tokens";

// PascalCase/camelCase のキーを CSS 変数名の kebab-case に変える。
const toKebabCase = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

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
  };

  for (const [key, value] of Object.entries(palette)) {
    vars[`--${toKebabCase(key)}`] = value;
  }

  for (const [key, value] of Object.entries(fontWeight)) {
    vars[`--w-${toKebabCase(key)}`] = `${value}`;
  }

  for (const [key, value] of Object.entries(videoType)) {
    vars[`--video-${toKebabCase(key)}`] = `${value}px`;
  }

  return vars;
};
