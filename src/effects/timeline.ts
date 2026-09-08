import { fps } from "../theme/timing.ts";
import type { Layer, ResolvedItem, Timeline } from "./types.ts";

/** timeline() の幅の既定値 (px)。 */
export const DEFAULT_WIDTH = 1920;

/** timeline() の高さの既定値 (px)。 */
export const DEFAULT_HEIGHT = 1080;

/** timeline() に渡すオプション。 */
type TimelineOptions = {
  /** 幅 (px)。既定は DEFAULT_WIDTH。 */
  width?: number;
  /** 高さ (px)。既定は DEFAULT_HEIGHT。 */
  height?: number;
};

/**
 * layer ごとに item の位置を解決する。`at` (絶対秒)・`after` (直前の終端
 * からの相対秒)・省略 (直前の終端に連結) のいずれかで解決する。`at` と
 * `after` の同時指定、at/after の不正値 (非有限・負)、直前の item との
 * 時間順違反があれば throw する。duration は有限の正で、フレームに丸めた
 * 終端が開始より後になる長さでなければならない。重なり判定はフレーム単位
 * (round(秒 × fps)) で行い、秒の丸め誤差による誤検出を避ける。
 */
const resolveLayer = (layer: Layer, layerIndex: number): ResolvedItem[] => {
  let cursor = 0;

  return layer.map((item, itemIndex) => {
    const { at, after, ...rest } = item;
    const { duration } = rest;

    if (at !== undefined && after !== undefined) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} は at と after を同時に指定できません`,
      );
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} の duration が不正です (${duration})`,
      );
    }

    if (at !== undefined && (!Number.isFinite(at) || at < 0)) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} の at が不正です (${at})`,
      );
    }

    if (after !== undefined && (!Number.isFinite(after) || after < 0)) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} の after が不正です (${after})`,
      );
    }

    const start = at ?? cursor + (after ?? 0);

    if (Math.round((start + duration) * fps) <= Math.round(start * fps)) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} (start ${start}, duration ${duration}) が 1 フレームに満たません。フレームに丸めると開始と終端が同じになります`,
      );
    }

    if (Math.round(start * fps) < Math.round(cursor * fps)) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${itemIndex} (start ${start}) が直前の item の終端 (${cursor}) より前です。layer 内の item は時間順に並べる`,
      );
    }

    cursor = start + duration;

    return { ...rest, at: start };
  });
};

/**
 * timeline.ts の layer の列から Timeline を組み立てる。layer = z 順 (配列
 * の後ろが上)。layer 内は時間が重ならず時間順に並び、位置は `at`/`after`/
 * 省略 (直前の item の終端に連結) のいずれかで解決する。durationSec は全
 * layer 全 item の `at + duration` の最大値。layers が空、または空の
 * layer があれば throw する。fps は theme の定数で、convert と composition
 * が同じ値を使う (ADR-0003)。
 */
export const timeline = (
  layers: readonly Layer[],
  options: TimelineOptions = {},
): Timeline => {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;

  if (layers.length === 0) {
    throw new Error("timeline: layers が空です");
  }

  const resolvedLayers = layers.map((layer, layerIndex) => {
    if (layer.length === 0) {
      throw new Error(`timeline: layer ${layerIndex} が空です`);
    }

    return resolveLayer(layer, layerIndex);
  });

  const durationSec = Math.max(
    ...resolvedLayers.flatMap((layer) =>
      layer.map((item) => item.at + item.duration),
    ),
  );

  return { fps, width, height, durationSec, layers: resolvedLayers };
};
