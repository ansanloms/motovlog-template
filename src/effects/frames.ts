// 秒 <-> フレーム換算の共有ヘルパー (旧 src/timeline/frames.ts から移設)。
//
// 各アイテムが個別に Math.round(秒 * fps) していると、開始秒と終了秒を
// それぞれ丸めた際に隣接区間の間で 1 フレームの隙間や重複が生じ得る。
// toFrameSpan は終端 (start + duration) を先に丸めてから開始との差分で
// durationInFrames を求めることで、それを防ぐ。

/** 秒区間をフレーム区間へ変換する。終端基準で丸め、隣接区間の隙間/重複を防ぐ。 */
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

/**
 * フェードの不透明度 (0〜1)。in 区間は最初のフレーム (frame=0) が
 * 1/inFrames、inFrames 番目のフレームで 1 になる直線、out 区間は最後の
 * フレームが 1/outFrames になる直線で、両者の min を返す (区間長 0 の
 * ときはそちら側を常に 1 とみなす)。Sequence の範囲内では 0 にならない
 * (範囲外は Sequence が unmount する)。
 *
 * interpolate() を使わない理由: inFrames=0 のとき inputRange に同じ値が
 * 並んで throw するのを避けるため。純粋関数なので vitest で直接叩ける。
 */
export const fadeOpacity = (params: {
  frame: number;
  durationInFrames: number;
  inFrames: number;
  outFrames: number;
}): number => {
  const { frame, durationInFrames, inFrames, outFrames } = params;

  const inRatio = inFrames > 0 ? (frame + 1) / inFrames : 1;
  const outRatio = outFrames > 0 ? (durationInFrames - frame) / outFrames : 1;

  const ratio = Math.min(inRatio, outRatio);

  return Math.min(1, Math.max(0, ratio));
};
