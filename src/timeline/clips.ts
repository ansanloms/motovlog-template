import type { Timeline } from "./schema";

// clips の順序リストからタイムライン上の絶対区間 (秒) を導出する。
// start_0 = gapBefore_0
// start_i = end_{i-1} + gapBefore_i - crossfadeIn_i
// end_i = start_i + duration_i
export const resolveClipSpans = (
  clips: Timeline["clips"],
): Array<{ start: number; end: number }> => {
  const spans: Array<{ start: number; end: number }> = [];

  clips.forEach((clip, index) => {
    const prevEnd = index === 0 ? 0 : spans[index - 1].end;
    const start = prevEnd + clip.gapBefore - clip.crossfadeIn;
    spans.push({ start, end: start + clip.duration });
  });

  return spans;
};
