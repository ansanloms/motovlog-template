// T&M (docs/design/tone-and-manner.md) の値を定数で持つ (ADR-0007, ADR-0008)。
// すべて 1920×1080 換算の px。

// T&M「カラー」節。design の :root と同名。値は design と一致させる。
export const palette = {
  bg: "#0f1a14",
  surface: "#1a2c22",
  ink: "#edf3ed",
  inkDim: "#9db0a3",
  inkFaint: "#7f9686",
  line: "#223529",
  lineStrong: "#2f4638",
  accent: "#74c48a",
  accentSoft: "#9ed9ac",
  warn: "#c4705f",
  inkVideo: "#f2f4ef", // 映像の上に乗る文字 (パレットに依存しない)
  black: "#000000", // design の :root には無い。OP のフェード元と注釈の縁取りに使う純黒
} as const;

/** design の `--bg-rgb`・`--surface-rgb` と同名。rgba() の合成用。 */
export const paletteRgb = {
  bg: "15, 26, 20",
  surface: "26, 44, 34",
} as const;

// T&M「タイポグラフィ」節。
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

// T&M「タイポグラフィ」節の 6 段 (映像上の文字サイズ。design の :root と同名:
// --title・--chapter・--subtitle・--badge・--label・--note)。
export const typeScale = {
  title: 96, // サムネの地名
  chapter: 56, // 章タイトルの題名
  subtitle: 44, // 字幕
  badge: 32, // サムネの話数、ED の値
  label: 26, // CHAPTER n、ED のラベル・上段・下段
  note: 24, // 縦書きの注釈
} as const;

// T&M「画面配置」節 (字幕)。
export const subtitleLayout = {
  lineHeight: 1.45,
  bottomOffset: 86,
  maxWidth: 1690, // 暗がりの左右余白 115px いっぱい (1920 - 115 * 2)
} as const;

// T&M「画面配置」「字幕の出し方」節。
export const scrim = {
  height: 348, // 134 + 44 * 1.45 * 2 + 86 (字幕 2 行分)
  bottom:
    "linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0))",
} as const;

/** 章タイトル (T&M「章タイトル」節)。暗がりブロック内の padding 134px 115px 86px。 */
export const chapterLayout = {
  paddingTop: 134,
  paddingSide: 115,
  paddingBottom: 86,
  gap: 8,
  labelLetterSpacing: "0.12em",
} as const;

/** 右端の縦書き注釈 (T&M「画面配置」節)。値は design の実寸 px に合わせる。 */
export const noteLayout = {
  right: 67,
  top: 77,
  maxHeight: 768,
  letterSpacing: "0.04em",
  lineHeight: 1.7,
  strokeWidth: 4,
} as const;

/** 写真紹介 (T&M「写真紹介」節)。 */
export const photoLayout = {
  top: 96,
  bottom: 288,
  singleSide: 480,
  pairSide: 254,
  pairGap: 19,
} as const;

/** OP / サムネ用フレーム (T&M「サムネ」節 + design サンプル C の cqw 換算)。 */
export const thumbLayout = {
  padding: 58, // 3cqw
  gap: 15, // 0.8cqw
  badgeRadius: 6,
  badgePaddingY: 8, // 0.4cqw
  badgePaddingX: 17, // 0.9cqw
  badgeLetterSpacing: "0.08em",
  badgeAlpha: 0.85,
  titleLineHeight: 1.2,
  titleShadowBlur: 12, // 0.6cqw。design サンプルの text-shadow
  titleShadowAlpha: 0.9,
  scrimAlpha: 0.92,
} as const;

/** ED (T&M「OP・ED・サムネ用フレーム」節 + design サンプル E の cqw 換算)。 */
export const endingLayout = {
  paddingY: 115, // 6cqw
  paddingX: 134, // 7cqw
  headerLetterSpacing: "0.24em",
  headerPaddingBottom: 27, // 1.4cqw
  rowHeight: 92,
  rowPaddingY: 21, // 1.1cqw
  rowRuleAlpha: 0.9, // rgba(surface, 0.9)
  labelLetterSpacing: "0.12em",
  valueLineHeightPx: 48,
  routeRowHeight: 92,
  routeLineHeightPx: 48,
  footerLineHeight: 1.5,
  footerGap: 77, // 4cqw
  footerPaddingTop: 28,
  blockGap: 48, // 上段・中段・下段の間隔 (縦中央寄せ)
} as const;

// 立ち絵・写真の影 (T&M「画面配置」「写真紹介」節)。design の :root と同名。
export const shadow = {
  figure: "0 0 24px rgba(0, 0, 0, 0.5)",
  photo: "0 8px 20px rgba(0, 0, 0, 0.55)",
} as const;

// グラデーション文字列は色を合成して作る (リテラルの重複を避ける)。
export const thumbScrim = `linear-gradient(to top, rgba(${paletteRgb.bg}, ${thumbLayout.scrimAlpha}), transparent)`;
