import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  lines: Timeline["lines"];
};

// セリフ音声トラック。字幕の表示区間 (subtitleTail 込み) は Subtitles 側で扱う。
export const VoiceLines: React.FC<Props> = ({ lines }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {lines.map((line) => {
        const { from, durationInFrames } = toFrameSpan(
          line.start,
          line.duration,
          fps,
        );

        return (
          <Sequence
            key={line.id}
            from={from}
            durationInFrames={durationInFrames}
          >
            <Audio src={staticFile(line.audio)} volume={1} />
          </Sequence>
        );
      })}
    </>
  );
};
