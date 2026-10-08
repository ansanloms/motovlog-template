// timeline.ts から各コンポーネントを関数呼び出しで並べるための要素ファクトリ
// の入口。実体は modules/<name>/ に置き (ADR-0015)、ここは互換のための
// 再エクスポートだけを持つ (root の deno.json の exports の "./components")。
// thumbnail() は表情名の解決を伴うため src/compositions/thumbnail.ts に置く
// (ADR-0011)。
export { annotation } from "@motovlog/annotation";
export { audio } from "@motovlog/audio";
export { chapter } from "@motovlog/chapter";
export { ending } from "@motovlog/ending";
export { photoShowcase } from "@motovlog/photo-showcase";
export { subtitleBand } from "@motovlog/subtitle";
export { video } from "@motovlog/video";
