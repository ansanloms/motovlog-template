import { loadFont } from "@remotion/google-fonts/NotoSansJP";

// 字幕・立ち絵まわりで使う基本フォント。
// T&M (docs/design/tone-and-manner.md) の 3 ウェイト。
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600"],
  subsets: ["japanese"],
});

export { fontFamily };
