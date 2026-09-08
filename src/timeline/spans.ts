import {
  chapterTitleDurationSec,
  endingTiming,
  openingTiming,
  thumbnailFrameTiming,
} from "../theme/timing.ts";
import type { Timeline } from "./schema.ts";

// timeline から表示区間 (秒) を導くヘルパー。React・remotion に依存しない
// 純粋関数。schema.ts の検証 (章タイトルの間隔等) と各 track コンポーネント
// (HideDuring 等) の両方から参照する。schema からは型だけを import type で
// 取り、実行時の循環 import を避ける。

export type Span = { start: number; duration: number };

// このファイルの関数は opening の有無・ending.start・chapters・
// characterSegments しか見ない (ending.date・ridingTime 等の他フィールドは
// 見ない)。Timeline (作者向け、timelineSchema.parse の結果) と
// VoicedTimeline (props 向け、calculateMetadata が返す結果) は ending.date・
// ridingTime の型が異なる (ADR-0009) が、ここで使うフィールドは両者で同じ
// 型のため、この構造型で両方を受けられるようにする。
type TimelineForSpans = {
  opening?: unknown;
  chapters: Timeline["chapters"];
  characterSegments: Timeline["characterSegments"];
  ending?: { start: number };
};

/** chapters を start 順に並べ、1 始まりの番号を振る。 */
export const chapterSpans = (
  chapters: Timeline["chapters"],
): Array<Span & { number: number; title: string }> =>
  [...chapters]
    .sort((a, b) => a.start - b.start)
    .map((chapter, index) => ({
      start: chapter.start,
      duration: chapterTitleDurationSec,
      number: index + 1,
      title: chapter.title,
    }));

/** OP (冒頭 openingTiming.duration 秒) の区間。opening が無ければ null。 */
export const openingSpan = (timeline: TimelineForSpans): Span | null =>
  timeline.opening ? { start: 0, duration: openingTiming.duration } : null;

/** ED (endingTiming.duration 秒) の区間。ending が無ければ null。 */
export const endingSpan = (timeline: TimelineForSpans): Span | null =>
  timeline.ending
    ? { start: timeline.ending.start, duration: endingTiming.duration }
    : null;

/** ED の後に続くサムネ用フレームの区間。opening と ending の両方があるときだけ存在する。 */
export const thumbnailSpan = (timeline: TimelineForSpans): Span | null => {
  if (!timeline.opening || !timeline.ending) {
    return null;
  }

  return {
    start: timeline.ending.start + endingTiming.duration,
    duration: thumbnailFrameTiming.duration,
  };
};

/** 立ち絵を消す区間 (章タイトル・OP・ED・サムネ用フレーム中。T&M の相互制御)。 */
export const characterHiddenSpans = (timeline: TimelineForSpans): Span[] => {
  const spans: Span[] = chapterSpans(timeline.chapters).map(
    ({ start, duration }) => ({ start, duration }),
  );

  const opening = openingSpan(timeline);
  if (opening) {
    spans.push(opening);
  }

  const ending = endingSpan(timeline);
  if (ending) {
    spans.push(ending);
  }

  const thumbnail = thumbnailSpan(timeline);
  if (thumbnail) {
    spans.push(thumbnail);
  }

  return spans;
};

/** 字幕を消す区間 (章タイトル中。T&M の相互制御)。 */
export const subtitleHiddenSpans = (timeline: TimelineForSpans): Span[] =>
  chapterSpans(timeline.chapters).map(({ start, duration }) => ({
    start,
    duration,
  }));

// hidden を start 順にマージし、重なり・隣接する区間を 1 つの union にする。
const mergeSpans = (spans: Span[]): Span[] => {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];

    if (last && span.start <= last.start + last.duration) {
      const end = Math.max(
        last.start + last.duration,
        span.start + span.duration,
      );
      last.duration = end - last.start;
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
};

/**
 * segments の各要素から hidden の区間 (union) を差し引き、残った断片
 * (長さ > 0) を start 順に返す。立ち絵をフェード付きで出入りさせるために
 * 表示区間を「消す区間」で穴あけする用途 (characterVisibleSpans)。
 */
export const subtractSpans = (segments: Span[], hidden: Span[]): Span[] => {
  const mergedHidden = mergeSpans(hidden);

  const fragments = segments.flatMap((segment) => {
    const segStart = segment.start;
    const segEnd = segment.start + segment.duration;

    const overlapping = mergedHidden.filter(
      (h) => h.start < segEnd && h.start + h.duration > segStart,
    );

    const pieces: Span[] = [];
    let cursor = segStart;

    for (const h of overlapping) {
      const hStart = Math.max(h.start, segStart);
      const hEnd = Math.min(h.start + h.duration, segEnd);

      if (hStart > cursor) {
        pieces.push({ start: cursor, duration: hStart - cursor });
      }

      cursor = Math.max(cursor, hEnd);
    }

    if (cursor < segEnd) {
      pieces.push({ start: cursor, duration: segEnd - cursor });
    }

    return pieces;
  });

  return fragments.sort((a, b) => a.start - b.start);
};

/**
 * 立ち絵の表示区間 (characterSegments) を characterHiddenSpans で穴あけした
 * 断片。src・side は元の segment のものを引き継ぐ。
 */
export const characterVisibleSpans = (
  timeline: TimelineForSpans,
): Array<Span & { src: string; side: "left" | "right" }> => {
  const hidden = characterHiddenSpans(timeline);

  return timeline.characterSegments.flatMap((segment) =>
    subtractSpans(
      [{ start: segment.start, duration: segment.duration }],
      hidden,
    ).map((span) => ({ ...span, src: segment.src, side: segment.side })),
  );
};
