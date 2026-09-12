export {
  chapterLayout,
  endingLayout,
  figureLayout,
  fontWeight,
  noteLayout,
  photoLayout,
  scrim,
  shadow,
  subtitleLayout,
  thumbLayout,
  typeScale,
} from "./tokens.ts";
export type { Palette } from "./tokens.ts";
export {
  bandTiming,
  chapterDurationSec,
  chapterTiming,
  characterTiming,
  endingTiming,
  fps,
  openingTiming,
  subtitleTiming,
} from "./timing.ts";
export type { Narrator } from "./voice.ts";
export { themeCssVars, thumbScrim } from "./cssVars.ts";
export { ThemeRoot } from "./ThemeRoot.tsx";
// palette と narrator の値は利用側 (theme/index.ts) が持ち、configure() で lib
// に渡る (ADR-0012)。Theme 型はその形。
export type { Theme } from "../setup.ts";
