import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames.ts";
import type { Timeline } from "../timeline/schema.ts";
import { PhotoShowcase } from "./PhotoShowcase.tsx";

/** PhotoTrack が受け取るもの。 */
type Props = {
  /** timeline の photos (写真紹介の一覧)。 */
  photos: Timeline["photos"];
};

/**
 * 写真紹介 (T&M「写真紹介」節)。3 枚以上はカットで順送りにする (timeline.ts
 * 側で要素を続けて並べる)。
 */
export const PhotoTrack: React.FC<Props> = ({ photos }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {photos.map((photo, index) => {
        const { from, durationInFrames } = toFrameSpan(
          photo.start,
          photo.duration,
          fps,
        );

        return (
          <Sequence
            key={`${photo.start}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <PhotoShowcase photos={photo.src.map((src) => staticFile(src))} />
          </Sequence>
        );
      })}
    </>
  );
};
