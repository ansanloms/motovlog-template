import { loadFont } from "@remotion/google-fonts/NotoSansJP";

// 字幕・立ち絵まわりで使う基本フォント。
const { fontFamily } = loadFont("normal", {
  weights: ["900"],
  subsets: ["japanese"],
});

export { fontFamily };
