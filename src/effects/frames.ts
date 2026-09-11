// 秒 <-> フレーム換算の共有ヘルパー。
//
// 各アイテムが個別に秒をフレームへ丸めていると、開始秒と終了秒を
// それぞれ丸めた際に隣接区間の間で 1 フレームの隙間や重複が生じ得る。
// toFrameSpan は終端 (start + duration) を先に丸めてから開始との差分で
// durationInFrames を求めることで、それを防ぐ。

/**
 * 秒をフレーム番号へ変換する。秒からフレームへの丸めは四捨五入で統一し、
 * この関数だけが行う (同じ秒が場所によって別のフレームに落ちるのを防ぐ)。
 * 区間 (開始 + 尺) の換算にはこれを直接使わず toFrameSpan を使う。尺を
 * 単独で丸めると、開始と終端をそれぞれ丸めた場合と同じ隙間/重複が出る。
 */
export const toFrame = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);

/** 秒区間をフレーム区間へ変換する。終端基準で丸め、隣接区間の隙間/重複を防ぐ。 */
export const toFrameSpan = (
  startSec: number,
  durationSec: number,
  fps: number,
): { from: number; durationInFrames: number } => {
  const from = toFrame(startSec, fps);
  const durationInFrames = Math.max(
    1,
    toFrame(startSec + durationSec, fps) - from,
  );

  return { from, durationInFrames };
};

/**
 * 遷移 (crossfade) の尺をフレーム数に変換する。`at` は直後の item の開始秒
 * (= 直前の item の終端 − duration)、`duration` は遷移の尺 (秒)。終端基準
 * で丸めてから開始との差分を取り、toFrameSpan と同じ丸め方にする。
 */
export const transitionFrames = (params: {
  /** 直後の item の開始秒 (= 直前の item の終端 − duration)。 */
  at: number;
  /** 遷移の尺 (秒)。 */
  duration: number;
  /** フレームレート。 */
  fps: number;
}): number => {
  const { at, duration, fps } = params;

  return toFrame(at + duration, fps) - toFrame(at, fps);
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
  /** 区間先頭からのフレーム番号 (0 起点)。 */
  frame: number;
  /** 区間の尺 (フレーム数)。 */
  durationInFrames: number;
  /** フェードインの尺 (フレーム数)。0 ならフェードなし。 */
  inFrames: number;
  /** フェードアウトの尺 (フレーム数)。0 ならフェードなし。 */
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
  /** 現在のフレーム番号 (0 起点、動画先頭から)。 */
  frame: number;
  /** フレームレート。 */
  fps: number;
  /** frame() の item の列 (同じ layer 内で時間は重ならない)。 */
  items: readonly {
    /** item の開始秒。 */
    at: number;
    /** item の尺 (秒)。 */
    duration: number;
    /** フェードインの尺 (秒)。 */
    in: number;
    /** フェードアウトの尺 (秒)。 */
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
    inFrames: toFrame(active.in, fps),
    outFrames: toFrame(active.out, fps),
  });
};
