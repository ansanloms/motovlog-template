import { Audio } from "@remotion/media";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Subtitle } from "../components/Subtitle.tsx";
import { SubtitleBand } from "../components/SubtitleBand.tsx";
import { bandTiming } from "../theme/index.ts";
import { computeBandSpans } from "../timeline/band.ts";
import {
  fadeEnvelope,
  secondsToFrames,
  toFrameSpan,
} from "../timeline/frames.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";

type Props = {
  lines: VoicedTimeline["lines"];
};

// セリフトラック。下部の暗がり (lines の語り区間から自動導出、ADR-0007,
// ADR-0008)・字幕・セリフ音声をまとめて配線する。描画順は暗がり → 字幕 →
// 音声 (音声は無音のレイヤーなので視覚上の順序に影響しない)。
export const Line: React.FC<Props> = ({ lines }) => {
  const { fps } = useVideoConfig();

  const bandSpans = useMemo(() => computeBandSpans(lines, bandTiming), [lines]);

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.start - b.start),
    [lines],
  );

  return (
    <>
      {bandSpans.map((span, index) => {
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
      {sortedLines.map((line, index) => {
        const next = sortedLines[index + 1];
        const end = Math.min(
          line.start + line.duration + line.subtitleTail,
          next ? next.start : Infinity,
        );
        const { from, durationInFrames } = toFrameSpan(
          line.start,
          end - line.start,
          fps,
        );

        return (
          <Sequence
            key={line.id}
            from={from}
            durationInFrames={durationInFrames}
          >
            <Subtitle text={line.text} />
          </Sequence>
        );
      })}
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
    <AbsoluteFill style={{ opacity }}>
      <SubtitleBand />
    </AbsoluteFill>
  );
};
