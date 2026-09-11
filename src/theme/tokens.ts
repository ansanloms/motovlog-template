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

/**
 * T&M「タイポグラフィ」節のフォントウェイト (Noto Sans JP)。字幕・章タイトルは
 * bold、他は用途に応じて regular/medium/semibold。
 */
export const fontWeight = {
  /** 通常の本文。 */
  regular: 400,
  /** やや強い本文。 */
  medium: 500,
  /** 見出し級。 */
  semibold: 600,
  /** 字幕・章タイトル。 */
  bold: 700,
} as const;

/**
 * T&M「タイポグラフィ」節の 6 段 (映像上の文字サイズ。design の :root と同名:
 * --title・--chapter・--subtitle・--badge・--label・--note)。
 */
export const typeScale = {
  /** サムネの地名。px。 */
  title: 96,
  /** 章タイトルの題名。px。 */
  chapter: 56,
  /** 字幕。px。 */
  subtitle: 44,
  /** サムネの話数、ED の値。px。 */
  badge: 32,
  /** CHAPTER n、ED のラベル・上段・下段。px。 */
  label: 26,
  /** 右上の注釈。px。サンプルの :root は 24px だが本文の注釈は 28px。本文を採る。 */
  note: 28,
} as const;

/** T&M「画面配置」節 (字幕)。 */
export const subtitleLayout = {
  /** 行間。無単位。 */
  lineHeight: 1.45,
  /** 画面下端からの距離。px。 */
  bottomOffset: 86,
} as const;

/** T&M「画面配置」「字幕の出し方」節。 */
export const scrim = {
  /** 暗がりの高さ。px。134 + 44 * 1.45 * 2 + 86 (字幕 2 行分)。 */
  height: 348,
  /** 暗がりの下地。design の --scrim-bottom と同じグラデーション。 */
  bottom:
    "linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0))",
} as const;

/** 章タイトル (T&M「章タイトル」節)。暗がりブロック内の padding 134px 115px 126px。 */
export const chapterLayout = {
  /** 暗がりブロック内の上余白。px。 */
  paddingTop: 134,
  /** 暗がりブロック内の左右余白。px。 */
  paddingSide: 115,
  /** 暗がりブロック内の下余白。px。字幕より 40px 上。 */
  paddingBottom: 126,
  /** 章番号と題名の間隔。px。 */
  gap: 14,
  /** 章番号の前に置く線の幅。px。 */
  ruleWidth: 40,
  /** 章番号の前に置く線の高さ。px。 */
  ruleThickness: 2,
  /** 線と文字の間隔。px。 */
  ruleGap: 16,
  /** "CHAPTER n" の letter-spacing。 */
  labelLetterSpacing: "0.12em",
  /** タイトルの letter-spacing。 */
  titleLetterSpacing: "0.02em",
  /** 題名の字下げ。px。章番号の線ぶん (ruleWidth 40 + ruleGap 16)。題名を "CHAPTER n" の文字の頭に揃える。 */
  titleIndent: 56,
} as const;

/** 右上の注釈 (T&M「画面配置」節)。値は design の実寸 px に合わせる。 */
export const noteLayout = {
  /** 画面右端からの距離。px。 */
  right: 67,
  /** 画面上端からの距離。px。 */
  top: 67,
  /** 最大幅。px。 */
  maxWidth: 760,
  /** 板の上下 padding。px。 */
  paddingY: 18,
  /** 板の左右 padding。px。 */
  paddingX: 28,
  /** 板の背景の不透明度。無単位 (0〜1)。 */
  backgroundAlpha: 0.62,
  /** 行間。無単位。 */
  lineHeight: 1.6,
} as const;

/** 写真紹介 (T&M「写真紹介」節)。列数に関わらず 1 つの枠を CSS の grid で並べる。 */
export const photoLayout = {
  /** 画面上端からの距離。px。 */
  top: 96,
  /** 画面下端からの距離。px。 */
  bottom: 288,
  /** 1 枚のときの列幅。px (左右 480px 分)。 */
  singleWidth: 960,
  /** 2 枚以上のときの列幅。px。 */
  cellWidth: 696,
  /** 列の間隔。px。 */
  gap: 19,
} as const;

/** OP / サムネ用フレーム (T&M「サムネ」節 + 画面サンプル C の 1 例目の実寸 px)。 */
export const thumbLayout = {
  /** フレーム全体の余白。px。 */
  padding: 58,
  /** バッジ・地名等の要素間の間隔。px。 */
  gap: 15,
  /** バッジの角丸。px。 */
  badgeRadius: 6,
  /** バッジの上下 padding。px。 */
  badgePaddingY: 8,
  /** バッジの左右 padding。px。 */
  badgePaddingX: 17,
  /** バッジ文字の letter-spacing。 */
  badgeLetterSpacing: "0.08em",
  /** バッジ背景の不透明度。無単位 (0〜1)。 */
  badgeAlpha: 0.85,
  /** 地名の行間。無単位。 */
  titleLineHeight: 1.2,
  /** 地名の text-shadow のぼかし半径。px。design サンプルの text-shadow。 */
  titleShadowBlur: 12,
  /** 地名の text-shadow の不透明度。無単位 (0〜1)。 */
  titleShadowAlpha: 0.9,
  /** 下地グラデーションの不透明度。無単位 (0〜1)。 */
  scrimAlpha: 0.92,
  // 立ち絵 (画面サンプル C の 1 例目の配置。サムネ配置専用)。
  // 画面 1920x1080、PNG は 480x1553 (上端の透明余白 12px、足の付け根は全体の 58.3%)。枠は
  // 切り取らず、立ち絵の右上を画面の右上から測った位置に置くだけ (幅は高さから決まる)。
  // 現在値では立ち絵は x 1298〜1838.9、髪の先が y 93.5、画面の下端は立ち絵の 57.1%
  // (足の付け根の直前) で切れる。影 (ぼかし 28px) の縁は左右上の三方で画面内に収まるが、
  // 下は立ち絵が画面外へ続くため縁が無く、腰から下の切り落としは画面の下端が行う。
  /** 画面の右端から立ち絵の右端までの距離。px。Claude Design の実寸ではなく Studio で見て決めた値。 */
  characterRight: 81,
  /** 画面の上端から立ち絵の上端 (PNG の上端) までの距離。px。 */
  characterTop: 80,
  /** 立ち絵の表示高さ (画像を拡縮する基準)。px。 */
  characterHeight: 1750,
} as const;

/** ED (T&M「OP・ED・サムネ用フレーム」節 + 画面サンプル E の実寸 px)。 */
export const endingLayout = {
  /** 上下余白。px。 */
  paddingY: 115,
  /** 左右余白。px。 */
  paddingX: 134,
  /** 上段 "> RIDE LOG" の letter-spacing。 */
  headerLetterSpacing: "0.24em",
  /** 上段の下罫線の下余白。px。 */
  headerPaddingBottom: 27,
  /** 「>」「$」とラベルの間隔。px。 */
  promptGap: 20,
  /** 中段各行の高さ。px。 */
  rowHeight: 92,
  /** 中段各行の上下余白。px。 */
  rowPaddingY: 21,
  /** 中段の下罫線の不透明度。無単位 (0〜1)。rgba(surface, 0.9)。 */
  rowRuleAlpha: 0.9,
  /** ラベルの letter-spacing。 */
  labelLetterSpacing: "0.12em",
  /** 値の行送り。px。 */
  valueLineHeightPx: 48,
  /** ROUTE 行の高さ。px。 */
  routeRowHeight: 92,
  /** ROUTE 行の値の行送り。px。 */
  routeLineHeightPx: 48,
  /** 下段クレジットの行間。無単位。 */
  footerLineHeight: 1.5,
  /** 下段クレジット項目間の間隔。px。 */
  footerGap: 77,
  /** 下段の上罫線の上余白。px。 */
  footerPaddingTop: 28,
  /** 上段・中段・下段の間隔 (縦中央寄せ)。px。 */
  blockGap: 48,
} as const;

/** 走行中の立ち絵の配置 (design 面 A の実寸)。 */
export const figureLayout = {
  /** 枠の左端 (または右端) からの距離。px。 */
  inset: 10,
  /** 枠の幅。px。 */
  boxWidth: 513,
  /** 枠の表示高さ。px。画像の上から約 52% (足の付け根) で切る。 */
  boxHeight: 720,
  /** 枠内での画像の左オフセット。px。 */
  imageOffset: 48,
  /** 画像の拡縮後の高さ。px。 */
  imageHeight: 1379,
} as const;

/** 立ち絵・写真の影 (T&M「画面配置」「写真紹介」節)。design の :root と同名。 */
export const shadow = {
  /** 立ち絵の影。黒 70%・ぼかし 28px。 */
  figure: "0 0 28px rgba(0, 0, 0, 0.7)",
  /** 立ち絵の輪郭を締める影。黒 90%・ぼかし 2px。 */
  figureEdge: "0 0 2px rgba(0, 0, 0, 0.9)",
  /** 写真の影。黒 55%・ぼかし 20px・下方向 8px。 */
  photo: "0 8px 20px rgba(0, 0, 0, 0.55)",
} as const;
