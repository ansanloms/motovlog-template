import React from "react";
import {
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { characterTiming } from "../theme/index.ts";
import {
  fadeEnvelope,
  secondsToFrames,
  toFrameSpan,
} from "../timeline/frames.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";
import { characterVisibleSpans } from "../timeline/spans.ts";
import { CharacterFigure } from "./CharacterFigure.tsx";

/** CharacterLayer が受け取るもの。 */
type Props = {
  /** timeline 全体 (characterSegments と、消す区間の導出に他のトラックも参照する)。 */
  timeline: VoicedTimeline;
};

/**
 * 立ち絵の表示区間を characterHiddenSpans (章タイトル・OP・ED・サムネ用
 * フレーム) で穴あけした断片 (characterVisibleSpans) ごとに Sequence を出し、
 * 0.2 秒でフェードして CharacterFigure を描く。目パチ・口パクは #39 でこの
 * 中身を差し替える。
 */
export const CharacterLayer: React.FC<Props> = ({ timeline }) => {
  const { fps } = useVideoConfig();
  const segments = characterVisibleSpans(timeline);

  return (
    <>
      {segments.map((segment, index) => {
        const { from, durationInFrames } = toFrameSpan(
          segment.start,
          segment.duration,
          fps,
        );

        return (
          <Sequence
            key={`${segment.start}-${segment.duration}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <CharacterItem
              src={staticFile(segment.src)}
              side={segment.side}
              durationInFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const CharacterItem: React.FC<{
  src: string;
  side: "left" | "right";
  durationInFrames: number;
}> = ({ src, side, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeFrames = secondsToFrames(characterTiming.fade, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames: fadeFrames,
    fadeOutFrames: fadeFrames,
  });

  return <CharacterFigure src={src} side={side} opacity={opacity} />;
};
