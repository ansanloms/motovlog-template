// T&M (docs/design/tone-and-manner.md) の値を定数で持つ (ADR-0004, ADR-0005)。
// すべて 1920×1080 換算の px。

/**
 * T&M「カラー」節のパレットの形 (ADR-0012)。値は利用側の theme/index.ts が
 * 持つ。キー名は design の `:root` と同名にし、themeCssVars() が
 * `--<kebab-case>` の CSS 変数に流す。
 */
export type Palette = {
  /** 背景 */
  readonly bg: string;
  /** 面 (帯・カード) */
  readonly surface: string;
  /** 本文 */
  readonly ink: string;
  /** 弱い本文 */
  readonly inkDim: string;
  /** さらに弱い本文 */
  readonly inkFaint: string;
  /** 罫線 */
  readonly line: string;
  /** 強い罫線 */
  readonly lineStrong: string;
  /** 差し色 */
  readonly accent: string;
  /** 淡い差し色 */
  readonly accentSoft: string;
  /** 注意 */
  readonly warn: string;
  /** 映像の上に乗る文字 (パレットに依存しない) */
  readonly inkVideo: string;
  /** OP のフェード元に使う純黒 (design の :root には無い) */
  readonly black: string;
};

/**
 * Palette の項目名の一覧。configure() (src/setup.ts) が利用側の palette に
 * 全項目が揃っているかを見るのに使う。`satisfies Record<keyof Palette, true>`
 * で Palette と 1 対 1 に縛っており、Palette に項目を足してここに書き忘れると
 * 型検査で止まる。
 */
export const PALETTE_KEYS = Object.keys({
  bg: true,
  surface: true,
  ink: true,
  inkDim: true,
  inkFaint: true,
  line: true,
  lineStrong: true,
  accent: true,
  accentSoft: true,
  warn: true,
  inkVideo: true,
  black: true,
} satisfies Record<keyof Palette, true>) as readonly (keyof Palette)[];

// T&M「タイポグラフィ」節。
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * T&M「タイポグラフィ」節の 6 段 (映像上の文字サイズ。design の :root と同名:
 * --title・--chapter・--subtitle・--badge・--label・--note)。
 */
export const typeScale = {
  title: 96, // サムネの地名
  chapter: 56, // 章タイトルの題名
  subtitle: 44, // 字幕
  badge: 32, // サムネの話数、ED の値
  label: 26, // CHAPTER n、ED のラベル・上段・下段
  note: 28, // サンプルの :root は 24px だが本文の注釈は 28px。本文を採る
} as const;

// T&M「画面配置」節 (字幕)。
export const subtitleLayout = {
  lineHeight: 1.45,
  bottomOffset: 86,
  maxWidth: 1040, // 左右 440px を空ける (1920 - 440 * 2)
} as const;

// T&M「画面配置」「字幕の出し方」節。
export const scrim = {
  height: 348, // 134 + 44 * 1.45 * 2 + 86 (字幕 2 行分)
  bottom:
    "linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0))",
} as const;

/** 章タイトル (T&M「章タイトル」節)。暗がりブロック内の padding 134px 115px 126px。 */
export const chapterLayout = {
  paddingTop: 134,
  paddingSide: 115,
  paddingBottom: 126, // 字幕より 40px 上
  gap: 14,
  ruleWidth: 40,
  ruleThickness: 2,
  ruleGap: 16,
  labelLetterSpacing: "0.12em",
  titleLetterSpacing: "0.02em",
  titleIndent: 56, // 章番号の線ぶん (ruleWidth 40 + ruleGap 16)。題名を "CHAPTER n" の文字の頭に揃える
} as const;

/** 右上の注釈 (T&M「画面配置」節)。値は design の実寸 px に合わせる。 */
export const noteLayout = {
  right: 67,
  top: 67,
  maxWidth: 760,
  paddingY: 18,
  paddingX: 28,
  backgroundAlpha: 0.62,
  lineHeight: 1.6,
} as const;

/** 写真紹介 (T&M「写真紹介」節)。列数に関わらず 1 つの枠を CSS の grid で並べる。 */
export const photoLayout = {
  top: 96,
  bottom: 288,
  singleWidth: 960, // 1 枚のときの列幅 (左右 480px 分)
  cellWidth: 696, // 2 枚以上のときの列幅
  gap: 19,
} as const;

/** OP / サムネ用フレーム (T&M「サムネ」節 + 画面サンプル C の 1 例目の実寸 px)。 */
export const thumbLayout = {
  padding: 58,
  gap: 15,
  badgeRadius: 6,
  badgePaddingY: 8,
  badgePaddingX: 17,
  badgeLetterSpacing: "0.08em",
  badgeAlpha: 0.85,
  titleLineHeight: 1.2,
  titleShadowBlur: 12, // design サンプルの text-shadow
  titleShadowAlpha: 0.9,
  scrimAlpha: 0.92,
  // 立ち絵 (画面サンプル C の 1 例目の配置。サムネ配置専用)。
  // 画面 1920x1080、PNG は 480x1553 (上端の透明余白 12px、足の付け根は全体の 58.3%)。枠は
  // 切り取らず、立ち絵の右上を画面の右上から測った位置に置くだけ (幅は高さから決まる)。
  // 現在値では立ち絵は x 1298〜1838.9、髪の先が y 93.5、画面の下端は立ち絵の 57.1%
  // (足の付け根の直前) で切れる。影 (ぼかし 28px) の縁は左右上の三方で画面内に収まるが、
  // 下は立ち絵が画面外へ続くため縁が無く、腰から下の切り落としは画面の下端が行う。
  characterRight: 81, // 画面の右端から立ち絵の右端まで。Claude Design の実寸ではなく Studio で見て決めた値
  characterTop: 80, // 画面の上端から立ち絵の上端 (PNG の上端) まで
  characterHeight: 1750,
} as const;

/** ED (T&M「OP・ED・サムネ用フレーム」節 + 画面サンプル E の実寸 px)。 */
export const endingLayout = {
  paddingY: 115,
  paddingX: 134,
  headerLetterSpacing: "0.24em",
  headerPaddingBottom: 27,
  promptGap: 20, // 「>」「$」とラベルの間隔
  rowHeight: 92,
  rowPaddingY: 21,
  rowRuleAlpha: 0.9, // rgba(surface, 0.9)
  labelLetterSpacing: "0.12em",
  valueLineHeightPx: 48,
  routeRowHeight: 92,
  routeLineHeightPx: 48,
  footerLineHeight: 1.5,
  footerGap: 77,
  footerPaddingTop: 28,
  blockGap: 48, // 上段・中段・下段の間隔 (縦中央寄せ)
} as const;

/** 走行中の立ち絵の配置 (design 面 A の実寸)。 */
export const figureLayout = {
  inset: 10, // 枠の左端 (または右端) からの距離
  boxWidth: 513,
  boxHeight: 720, // 画像の上から約 52% (足の付け根) で切る
  imageOffset: 48, // 枠内での画像の左オフセット
  imageHeight: 1379,
} as const;

/** 立ち絵・写真の影 (T&M「画面配置」「写真紹介」節)。design の :root と同名。 */
export const shadow = {
  figure: "0 0 28px rgba(0, 0, 0, 0.7)",
  figureEdge: "0 0 2px rgba(0, 0, 0, 0.9)", // 輪郭を締める影
  photo: "0 8px 20px rgba(0, 0, 0, 0.55)",
} as const;
