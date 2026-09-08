import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { computeBandSpans } from "../timeline/band.ts";
import {
  fadeEnvelope,
  secondsToFrames,
  toFrameSpan,
} from "../timeline/frames.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";
import { bandTiming } from "../theme/index.ts";
import styles from "./SubtitleBand.module.css";

type Props = {
  lines: VoicedTimeline["lines"];
};

// 下部の暗がり。lines の語り区間から自動で表示区間を導く (ADR-0007, ADR-0008)。
export const SubtitleBand: React.FC<Props> = ({ lines }) => {
  const { fps } = useVideoConfig();
  const spans = useMemo(() => computeBandSpans(lines, bandTiming), [lines]);

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
            <BandItem
              durationInFrames={durationInFrames}
              fadeIn={span.fadeIn}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const BandItem: React.FC<{ durationInFrames: number; fadeIn: number }> = ({
  durationInFrames,
  fadeIn,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(fadeIn, fps);
  const fadeOutFrames = secondsToFrames(bandTiming.fadeOut, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames,
    fadeOutFrames,
  });

  return (
    <AbsoluteFill className={styles.layer} style={{ opacity }}>
      <div className={styles.band} />
    </AbsoluteFill>
  );
};
