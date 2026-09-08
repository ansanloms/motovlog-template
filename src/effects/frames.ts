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
 * 遷移 (crossfade) の尺をフレーム数に変換する。`at` は直後の item の開始秒
 * (= 直前の item の終端 − duration)、`duration` は遷移の尺 (秒)。終端基準
 * で丸めてから開始との差分を取り、toFrameSpan と同じ丸め方にする。
 */
export const transitionFrames = (params: {
  at: number;
  duration: number;
  fps: number;
}): number => {
  const { at, duration, fps } = params;

  return Math.round((at + duration) * fps) - Math.round(at * fps);
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

/**
 * frame() の item (FrameEffects が包む対象) の列から、指定フレームでの
 * 合成 opacity を計算する。同じ layer の frame() の item は時間が重ならな
 * いため、区間内の item は高々 1 つで、その item の fadeOpacity を返す。
 * 区間内に item が無ければ 1 (効果無し)。React に依存しない純粋関数。
 */
export const frameEffectsOpacity = (params: {
  frame: number;
  fps: number;
  items: readonly {
    at: number;
    duration: number;
    in: number;
    out: number;
  }[];
}): number => {
  const { frame, fps, items } = params;

  const active = items.find((item) => {
    const { from, durationInFrames } = toFrameSpan(item.at, item.duration, fps);
    const relativeFrame = frame - from;

    return relativeFrame >= 0 && relativeFrame < durationInFrames;
  });

  if (active === undefined) {
    return 1;
  }

  const { from, durationInFrames } = toFrameSpan(
    active.at,
    active.duration,
    fps,
  );

  return fadeOpacity({
    frame: frame - from,
    durationInFrames,
    inFrames: Math.round(active.in * fps),
    outFrames: Math.round(active.out * fps),
  });
};
