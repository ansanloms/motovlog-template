import { loadFont } from "@remotion/google-fonts/NotoSansJP";

// 字幕・立ち絵まわりで使う基本フォント。ED の計器表示も同じ書体を使う。
// T&M (docs/design/tone-and-manner.md) の 4 ウェイト (Bold は字幕のみ)。
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["japanese"],
});

export { fontFamily };
