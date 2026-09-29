// modules の共有部品 (ADR-0016)。各 modules/<name> はここだけを経由して
// 他の module と部品を共有する。
export { FadeGainContext, useFadeGain } from "./fadeGain.ts";
export { previewSrc } from "./previewSrc.ts";
export { joinLines } from "./text.ts";
export type { TextLines } from "./text.ts";
export {
  applyGain,
  assertVolume,
  toVolumeProp,
  useVolumeProp,
  volumeAt,
} from "./volume.ts";
export type { Volume, VolumePoint } from "./volume.ts";
