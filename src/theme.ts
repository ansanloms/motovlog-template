// T&M (docs/design/tone-and-manner.md) の値を定数で持つ (ADR-0007, ADR-0008)。
// すべて 1920×1080 換算の px。

// T&M「カラー」節。
export const colors = {
  deepGreen: "#0f1a14", // タイトルカード・ED の下地
  panel: "#1a2c22", // 情報パネル (不透明度 85% まで)
  text: "#edf3ed", // パネル上の見出し・数値
  accent: "#74c48a", // パネル上のアクセント
  accentOnVideo: "#9ed9ac", // 映像上のアクセント (章番号等)
  textMuted: "#7f9686", // 補助文字
  textOnVideo: "#ffffff", // 字幕・注釈
} as const;

// T&M「タイポグラフィ」節。
export const typeScale = {
  titleCard: { fontSize: 96, fontWeight: 600 },
  chapter: { fontSize: 54, fontWeight: 500 },
  subtitle: { fontSize: 44, fontWeight: 400, lineHeight: 1.45 },
  label: { fontSize: 28, fontWeight: 400, letterSpacing: "0.04em" },
} as const;

// T&M「画面配置」節 (字幕)。
export const subtitleLayout = {
  bottomOffset: 86, // 画面下端から字幕ブロック下端まで
  maxWidth: 1690, // 1920 - 115 * 2
  textShadow: "0 5px 13px rgba(0, 0, 0, 0.7)",
} as const;

// T&M「画面配置」「字幕の出し方」節。
export const darkness = {
  height: 348, // 134 + 44 * 1.45 * 2 + 86 (字幕 2 行分)
  gradient:
    "linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0))",
  leadIn: 0.3, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 5, // 無音が何秒続いたら消すか
  fadeOut: 0.5,
} as const;
