// 秒 <-> フレーム換算の共有ヘルパー。
//
// 各トラックが個別に Math.round(秒 * fps) していると、開始秒と終了秒を
// それぞれ丸めた際に隣接区間の間で 1 フレームの隙間や重複が生じ得る。
// このヘルパーは終端 (start + duration) を先に丸めてから開始との差分で
// durationInFrames を求めることで、それを防ぐ。

// 秒をフレームへ変換する (スカラ値用)。区間の開始/終了双方を丸める必要がある
// 場合は toFrameSpan を使うこと。
export const secondsToFrames = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);

// 秒区間をフレーム区間へ変換する。終端基準で丸め、隣接区間の隙間/重複を防ぐ。
export const toFrameSpan = (
  startSec: number,
  durationSec: number,
  fps: number,
): { from: number; durationInFrames: number } => {
  const from = Math.round(startSec * fps);
  const durationInFrames = Math.max(
    1,
    Math.round((startSec + durationSec) * fps) - from,
  );
  return { from, durationInFrames };
};

// フェードの包絡線 (0 -> peak -> 0) を interpolate を使わず min 方式で求める。
//
// - 任意の非負の fadeInFrames/fadeOutFrames/durationInFrames で例外を投げない
//   (interpolate は keyframes が単調増加でないと例外を投げるため、fadeIn +
//   fadeOut が durationInFrames を超える退化ケースを扱えない)。
// - fadeInFrames > 0 のとき frame=0 で 0、fadeOutFrames > 0 のとき
//   frame=durationInFrames-1 で 0 になる。
// - フェード区間の外側 (中間) は peak を返す。
export const fadeEnvelope = (params: {
  frame: number;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  peak?: number;
}): number => {
  const { frame, durationInFrames, fadeInFrames, fadeOutFrames } = params;
  const peak = params.peak ?? 1;

  const inRamp = fadeInFrames > 0 ? frame / fadeInFrames : 1;
  const outRamp =
    fadeOutFrames > 0 ? (durationInFrames - 1 - frame) / fadeOutFrames : 1;

  const ratio = Math.min(inRamp, outRamp);
  const clamped = Math.min(1, Math.max(0, ratio));

  return clamped * peak;
};
