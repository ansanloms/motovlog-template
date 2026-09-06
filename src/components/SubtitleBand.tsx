import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  bands: Timeline["subtitleBands"];
  style: Timeline["style"]["band"];
};

// 字幕背景帯。
export const SubtitleBand: React.FC<Props> = ({ bands, style }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {bands.map((band, index) => {
        const { from, durationInFrames } = toFrameSpan(
          band.start,
          band.duration,
          fps,
        );

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <BandItem
              band={band}
              style={style}
              durationInFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const BandItem: React.FC<{
  band: Timeline["subtitleBands"][number];
  style: Timeline["style"]["band"];
  durationInFrames: number;
}> = ({ band, style, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(band.fadeIn, fps);
  const fadeOutFrames = secondsToFrames(band.fadeOut, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames,
    fadeOutFrames,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        opacity: opacity * style.opacity,
      }}
    >
      <div
        style={{
          height: style.height,
          background: `linear-gradient(transparent, ${style.color})`,
        }}
      />
    </AbsoluteFill>
  );
};
