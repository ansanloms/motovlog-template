/** 音量の折れ線の 1 点。at は要素の再生開始 (trimBefore 適用後) からの秒。 */
export type VolumePoint = { readonly at: number; readonly volume: number };

/** 一定値 (数値) または折れ線 (点の配列)。 */
export type Volume = number | readonly VolumePoint[];

/**
 * 折れ線 points 上の seconds における音量を線形補間で求める。最初の点より
 * 前は最初の点の値、最後の点より後は最後の点の値でクランプする。同じ値の
 * 2 点は音量を保持し、違う値の 2 点はフェードになる。
 */
export const volumeAt = (
  points: readonly VolumePoint[],
  seconds: number,
): number => {
  if (points.length === 0) {
    throw new Error("volume: 折れ線が空です");
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (seconds <= first.at) {
    return first.volume;
  }

  if (seconds >= last.at) {
    return last.volume;
  }

  const index = points.findIndex((point) => point.at > seconds);
  const prev = points[index - 1];
  const next = points[index];
  const ratio = (seconds - prev.at) / (next.at - prev.at);

  return prev.volume + (next.volume - prev.volume) * ratio;
};

/**
 * volume の形が正しいことを検証する。数値なら 0 以上 1 以下、配列なら
 * 1 点以上・各点の volume が 0 以上 1 以下・at が 0 以上かつ狭義単調増加
 * であることを要求する。破れば Error を throw する。
 */
export const assertVolume = (volume: Volume): void => {
  if (typeof volume === "number") {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new Error(`volume: 値が不正です (${volume})`);
    }

    return;
  }

  if (volume.length === 0) {
    throw new Error("volume: 折れ線が空です");
  }

  let prevAt: number | undefined;

  volume.forEach((point, index) => {
    if (
      !Number.isFinite(point.volume) ||
      point.volume < 0 ||
      point.volume > 1
    ) {
      throw new Error(
        `volume: ${index} 番目の volume が不正です (${point.volume})`,
      );
    }

    if (!Number.isFinite(point.at) || point.at < 0) {
      throw new Error(`volume: ${index} 番目の at が不正です (${point.at})`);
    }

    if (prevAt !== undefined && point.at <= prevAt) {
      throw new Error(
        `volume: at は狭義単調増加である必要があります (${prevAt} -> ${point.at})`,
      );
    }

    prevAt = point.at;
  });
};

/**
 * volume を @remotion/media の volume prop に渡せる形へ変換する。数値なら
 * そのまま返し、折れ線なら frame (メディア再生開始が 0) を fps で秒に
 * 換算して volumeAt を呼ぶ関数を返す。
 */
export const toVolumeProp = (
  volume: Volume,
  fps: number,
): number | ((frame: number) => number) => {
  if (typeof volume === "number") {
    return volume;
  }

  return (frame: number) => volumeAt(volume, frame / fps);
};
