import { fps } from "../theme/timing.ts";
import { isAnchor } from "./anchor.ts";
import { isFrame } from "./frame.ts";
import { toFrame, transitionFrames } from "./frames.ts";
import type {
  Item,
  Layer,
  ResolvedItem,
  Timeline,
  Transition,
} from "./types.ts";

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
 * layer ごとに item の位置を解決する。`at` (絶対秒または Anchor)・`after`
 * (直前の終端からの相対秒)・省略 (直前の終端に連結) のいずれかで解決する。
 * `at` と `after` の同時指定、at/after の不正値 (非有限・負)、直前の item
 * との時間順違反があれば throw する。duration は有限の正で、フレームに
 * 丸めた終端が開始より後になる長さでなければならない。重なり判定はフレーム
 * 単位 (round(秒 × fps)) で行い、秒の丸め誤差による誤検出を避ける。
 *
 * layer 内の item と item の間に置かれた Transition (crossfade) は、直後
 * の item の開始を「直前の item の終端 − 遷移の尺」に固定する (layer 内
 * 非重複の唯一の例外)。resolved は layer を跨いで参照同一性で解決済み
 * item を引くための表で、Anchor (start/end) の解決に使う。narration() が
 * 発話の実尺で duration を埋めた仮 layer の解決にも使うため export する。
 */
export const resolveLayer = (
  layer: Layer,
  layerIndex: number,
  resolved: Map<Item, ResolvedItem>,
): ResolvedItem[] => {
  const result: ResolvedItem[] = [];
  let cursor = 0;
  let pending: Transition | null = null;
  let prev: ResolvedItem | null = null;

  layer.forEach((entry, entryIndex) => {
    if (entry.kind === "crossfade") {
      if (prev === null) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) が先頭にあります`,
        );
      }

      if (pending !== null) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) が連続しています`,
        );
      }

      if (prev.kind === "fade" && prev.out > 0) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) の直前の item に out は付けられません (dissolve と fade-out は排他)`,
        );
      }

      const { duration } = entry;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) の duration が不正です (${duration})`,
        );
      }

      if (duration > prev.duration) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) の duration (${duration}) が直前の item の尺 (${prev.duration}) より長いです`,
        );
      }

      if (transitionFrames({ at: cursor - duration, duration, fps }) < 1) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) の duration (${duration}) が 1 フレームに満たない`,
        );
      }

      const prevStartFrame = toFrame(prev.at, fps);
      const prevVisibleFromFrame = prev.transitionIn
        ? toFrame(prev.at + prev.transitionIn.duration, fps)
        : prevStartFrame;
      const nextStartFrame = toFrame(cursor - duration, fps);

      if (nextStartFrame < prevVisibleFromFrame) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) の直後の item の開始 (フレーム ${nextStartFrame}) が直前の item が単独で見え始めるフレーム (${prevVisibleFromFrame}) より前です`,
        );
      }

      if (isFrame(prev.node)) {
        throw new Error(
          `timeline: layer ${layerIndex} の crossfade (index ${entryIndex}) を frame() の item に接続できません`,
        );
      }

      pending = entry;
      return;
    }

    const item = entry;

    if (resolved.has(item)) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${entryIndex} は既に別の場所で使われています (同じ item を複数箇所に置けません)`,
      );
    }

    const { at, after, ...rest } = item;
    const { duration } = rest;

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(
        `timeline: layer ${layerIndex} の item ${entryIndex} の duration が不正です (${duration})`,
      );
    }

    let start: number;
    let transitionIn: Transition | undefined;

    if (pending !== null) {
      if (at !== undefined || after !== undefined) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} は crossfade の直後に at/after を指定できません`,
        );
      }

      if (isFrame(item.node)) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} (frame()) を crossfade の対象にできません`,
        );
      }

      if (duration < pending.duration) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} の尺 (${duration}) が crossfade の尺 (${pending.duration}) より短いです`,
        );
      }

      // この分岐には後段の 1 フレーム検査・時間順検査を置かない。crossfade
      // 側で duration が正かつ 1 フレーム以上、item 側で duration >=
      // pending.duration を検査済みのため、start (= cursor -
      // pending.duration) から start + duration までは必ず 1 フレーム以上
      // ある。start も定義上 cursor より前 (pending.duration > 0) なので
      // 時間順違反にもならない。
      start = cursor - pending.duration;

      transitionIn = pending;
      pending = null;
    } else {
      if (at !== undefined && after !== undefined) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} は at と after を同時に指定できません`,
        );
      }

      let resolvedAt: number | undefined;

      if (isAnchor(at)) {
        const ref = resolved.get(at.item);

        if (ref === undefined) {
          throw new Error(
            `timeline: layer ${layerIndex} の item ${entryIndex} の at (Anchor) の参照先が未解決です (上の layer・同じ layer の後ろの item・どの layer にも置かれていない item は参照できません)`,
          );
        }

        const base = at.edge === "start" ? ref.at : ref.at + ref.duration;

        resolvedAt = base + at.offset;
      } else {
        resolvedAt = at;
      }

      if (
        resolvedAt !== undefined &&
        (!Number.isFinite(resolvedAt) || resolvedAt < 0)
      ) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} の at が不正です (${resolvedAt})`,
        );
      }

      if (after !== undefined && (!Number.isFinite(after) || after < 0)) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} の after が不正です (${after})`,
        );
      }

      start = resolvedAt ?? cursor + (after ?? 0);

      if (toFrame(start + duration, fps) <= toFrame(start, fps)) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} (start ${start}, duration ${duration}) が 1 フレームに満たない。フレームに丸めると開始と終端が同じになります`,
        );
      }

      if (toFrame(start, fps) < toFrame(cursor, fps)) {
        throw new Error(
          `timeline: layer ${layerIndex} の item ${entryIndex} (start ${start}) が直前の item の終端 (${cursor}) より前です。layer 内の item は時間順に並べる`,
        );
      }
    }

    if (isFrame(item.node) && layerIndex === 0) {
      throw new Error(
        `timeline: layer 0 に frame() の item は置けません (下の layer が無いため)`,
      );
    }

    const resolvedItem = {
      ...rest,
      at: start,
      ...(transitionIn !== undefined ? { transitionIn } : {}),
    } as ResolvedItem;

    resolved.set(item, resolvedItem);
    result.push(resolvedItem);
    prev = resolvedItem;
    cursor = start + duration;
  });

  if (pending !== null) {
    throw new Error(
      `timeline: layer ${layerIndex} の crossfade が末尾にあります`,
    );
  }

  return result;
};

/**
 * timeline.ts の layer の列から Timeline を組み立てる。layer = z 順 (配列
 * の後ろが上)。layer 内は時間が重ならず時間順に並び (crossfade の直後の
 * item のみ例外)、位置は `at`/`after`/省略 (直前の item の終端に連結) の
 * いずれかで解決する。durationSec は全 layer 全 item の `at + duration` の
 * 最大値。layers が空、または空の layer があれば throw する。fps は theme
 * の定数で、convert と composition が同じ値を使う (ADR-0003)。
 */
export const timeline = (
  layers: readonly Layer[],
  options: TimelineOptions = {},
): Timeline => {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;

  if (layers.length === 0) {
    throw new Error("timeline: layers が空です");
  }

  const resolved = new Map<Item, ResolvedItem>();

  const resolvedLayers = layers.map((layer, layerIndex) => {
    if (layer.length === 0) {
      throw new Error(`timeline: layer ${layerIndex} が空です`);
    }

    return resolveLayer(layer, layerIndex, resolved);
  });

  const durationSec = Math.max(
    ...resolvedLayers.flatMap((layer) =>
      layer.map((item) => item.at + item.duration),
    ),
  );

  return { fps, width, height, durationSec, layers: resolvedLayers };
};
