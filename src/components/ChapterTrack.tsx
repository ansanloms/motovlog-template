import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames.ts";
import type { Timeline } from "../timeline/schema.ts";
import { chapterSpans } from "../timeline/spans.ts";
import { ChapterTitle } from "./ChapterTitle.tsx";

/** ChapterTrack が受け取るもの。 */
type Props = {
  /** timeline の chapters (章の一覧)。 */
  chapters: Timeline["chapters"];
};

/**
 * 章タイトル。chapters から表示区間 (spans.ts の chapterSpans) を導き、
 * 順に Sequence へ並べる。
 */
export const ChapterTrack: React.FC<Props> = ({ chapters }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {chapterSpans(chapters).map((span) => {
        const { from, durationInFrames } = toFrameSpan(
          span.start,
          span.duration,
          fps,
        );

        return (
          <Sequence
            key={span.number}
            from={from}
            durationInFrames={durationInFrames}
          >
            <ChapterTitle
              title={span.title}
              subtitle={`CHAPTER ${span.number}`}
            />
          </Sequence>
        );
      })}
    </>
  );
};
