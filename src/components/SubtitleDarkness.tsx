import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { computeDarknessSpans } from "../timeline/darkness";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "../timeline/frames";
import type { VoicedTimeline } from "../timeline/schema";
import { darkness } from "../theme";

type Props = {
  lines: VoicedTimeline["lines"];
};

// 下部の暗がり。lines の語り区間から自動で表示区間を導く (ADR-0007, ADR-0008)。
export const SubtitleDarkness: React.FC<Props> = ({ lines }) => {
  const { fps } = useVideoConfig();
  const spans = useMemo(() => computeDarknessSpans(lines, darkness), [lines]);

  return (
    <>
      {spans.map((span, index) => {
        const { from, durationInFrames } = toFrameSpan(
          span.start,
          span.duration,
          fps,
        );

        return (
          <Sequence
            key={`${span.start}-${span.duration}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <DarknessItem
              durationInFrames={durationInFrames}
              fadeIn={span.fadeIn}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const DarknessItem: React.FC<{ durationInFrames: number; fadeIn: number }> = ({
  durationInFrames,
  fadeIn,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(fadeIn, fps);
  const fadeOutFrames = secondsToFrames(darkness.fadeOut, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames,
    fadeOutFrames,
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", opacity }}>
      <div
        style={{
          height: darkness.height,
          background: darkness.gradient,
        }}
      />
    </AbsoluteFill>
  );
};
