import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  bgm: Timeline["bgm"];
};

// BGM トラック。
export const Bgm: React.FC<Props> = ({ bgm }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {bgm.map((track, index) => {
        const { from, durationInFrames } = toFrameSpan(
          track.start,
          track.duration,
          fps,
        );
        const sourceFromFrames = secondsToFrames(track.sourceFrom, fps);
        const fadeInFrames = secondsToFrames(track.fadeIn, fps);
        const fadeOutFrames = secondsToFrames(track.fadeOut, fps);

        return (
          <Sequence
            key={`${track.src}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <Audio
              src={staticFile(track.src)}
              trimBefore={sourceFromFrames}
              volume={(f) =>
                fadeEnvelope({
                  frame: f,
                  durationInFrames,
                  fadeInFrames,
                  fadeOutFrames,
                  peak: track.volume,
                })
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};
