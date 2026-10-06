// timeline.ts から各コンポーネントを関数呼び出しで並べるための要素ファクトリ
// の入口。実体は modules/<name>/ に置き (ADR-0015)、ここは互換のための
// 再エクスポートだけを持つ (package.json の exports の "./components")。
// thumbnail() は表情名の解決を伴うため src/compositions/thumbnail.ts に置く
// (ADR-0011)。
export { annotation } from "../../modules/annotation/index.ts";
export { audio } from "../../modules/audio/index.ts";
export { chapter } from "../../modules/chapter/index.ts";
export { ending } from "../../modules/ending/index.ts";
export { photoShowcase } from "../../modules/photo-showcase/index.ts";
export { subtitleBand } from "../../modules/subtitle/index.ts";
export { video } from "../../modules/video/index.ts";
