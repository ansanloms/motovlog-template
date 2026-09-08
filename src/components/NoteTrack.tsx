import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames.ts";
import type { Timeline } from "../timeline/schema.ts";
import { VerticalNote } from "./VerticalNote.tsx";

/** NoteTrack が受け取るもの。 */
type Props = {
  /** timeline の notes (右端の縦書き注釈の一覧)。 */
  notes: Timeline["notes"];
};

/** 右端の縦書き注釈。カットで出し入れする (T&M「画面配置」節)。 */
export const NoteTrack: React.FC<Props> = ({ notes }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {notes.map((note, index) => {
        const { from, durationInFrames } = toFrameSpan(
          note.start,
          note.duration,
          fps,
        );

        return (
          <Sequence
            key={`${note.start}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <VerticalNote text={note.text} />
          </Sequence>
        );
      })}
    </>
  );
};
