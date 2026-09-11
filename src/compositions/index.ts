// compositions の公開面 (ADR-0012)。利用側の timeline.ts はこのファイルか
// motovlog-template/compositions 経由でだけ compositions を import する。
// effects (演出の術) と components (見た目) と違い、compositions は動画の
// ドメイン (発話・立ち絵・サムネ) を組み立てる層。
//
// characters/<name>.ts だけはこの入口を通さず ./character.ts を直に import
// する。この入口は figure()・line() 経由で src/components と CSS Modules を
// 辿るため、素の Node から読めなくなり、ADR-0011 の前提 (watcher が
// characters/<name>.ts をそのまま import して voice を読む) を壊す。
export { character, isEyesLayer, isMouthLayer } from "./character.ts";
export type {
  Character,
  Expressions,
  EyesLayer,
  FigureLayer,
  MouthKey,
  MouthLayer,
} from "./character.ts";
export { figure, figureLayers } from "./figure.ts";
export { line, narration } from "./narration.ts";
export type { Narration, Speech } from "./narration.ts";
export { thumbnail } from "./thumbnail.ts";
