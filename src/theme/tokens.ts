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
} as const;

// T&M「タイポグラフィ」節。
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// T&M「画面配置」節の注釈と「タイポグラフィ」節の階層 (映像上の文字サイズ。
// design の `--video-*` と同名)。
export const videoType = {
  title: 96,
  chapter: 56,
  subtitle: 44,
  note: 24,
} as const;

// T&M「画面配置」節 (字幕)。
export const subtitleLayout = {
  lineHeight: 1.45,
  bottomOffset: 86,
  maxWidth: 1232, // 1 行 28 文字 × 44px
} as const;

// T&M「画面配置」「字幕の出し方」節。
export const scrim = {
  height: 348, // 134 + 44 * 1.45 * 2 + 86 (字幕 2 行分)
  bottom:
    "linear-gradient(to top, rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0))",
} as const;
