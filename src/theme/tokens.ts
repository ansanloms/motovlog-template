// T&M (docs/design/tone-and-manner.md) の値を定数で持つ (ADR-0004, ADR-0005)。
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

/** 写真紹介 (T&M「写真紹介」節)。列数に関わらず 1 つの枠を CSS の grid で並べる。 */
export const photoLayout = {
  top: 96,
  bottom: 288,
  singleWidth: 960, // 1 枚のときの列幅 (左右 480px 分)
  cellWidth: 696, // 2 枚以上のときの列幅
  gap: 19,
} as const;

/** OP / サムネ用フレーム (T&M「サムネ」節 + design 第 7 版の実寸 px)。 */
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
  // 立ち絵 (design サンプル C の配置。サムネ配置専用)。
  characterRight: 10,
  characterBoxWidth: 624,
  characterBoxHeight: 1037,
  characterOffset: 48,
  characterHeight: 1937,
} as const;

/** ED (T&M「OP・ED・サムネ用フレーム」節 + design 第 7 版の実寸 px)。 */
export const endingLayout = {
  paddingY: 115,
  paddingX: 134,
  headerLetterSpacing: "0.24em",
  headerPaddingBottom: 27,
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
  breathHeadroom: 12, // 呼吸で上へ動く分の余白 (px)。breathLift + boxHeight × breathScale 以上にする
} as const;

/**
 * 立ち絵の呼吸の振幅 (T&M には無い、揺らぎの演出値)。CSS 変数には流さず
 * (ADR-0005 の「フレームごとに変わる値はインラインスタイルで渡す」)、
 * `figure()` がインラインの transform に直接使う。
 * breathScale は scaleY の増分 (無次元)、breathLift は上方向の移動 (px)。
 */
export const figureMotion = { breathScale: 0.012, breathLift: 3 } as const;

/** 立ち絵・写真の影 (T&M「画面配置」「写真紹介」節)。design の :root と同名。 */
export const shadow = {
  figure: "0 0 24px rgba(0, 0, 0, 0.5)",
  photo: "0 8px 20px rgba(0, 0, 0, 0.55)",
} as const;

/** OP / サムネ用フレームの暗がり。グラデーション文字列は色を合成して作る (リテラルの重複を避ける)。 */
export const thumbScrim = `linear-gradient(to top, rgba(${paletteRgb.bg}, ${thumbLayout.scrimAlpha}), transparent)`;
