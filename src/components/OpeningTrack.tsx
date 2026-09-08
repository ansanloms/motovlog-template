import React from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { openingTiming, palette } from "../theme/index.ts";
import {
  fadeEnvelope,
  secondsToFrames,
  toFrameSpan,
} from "../timeline/frames.ts";
import type { Timeline } from "../timeline/schema.ts";
import { OpeningFrame } from "./OpeningFrame.tsx";

/** OpeningTrack が受け取るもの。 */
type Props = {
  /** timeline の opening (OP とサムネ用フレームの絵)。無ければ何も描かない。 */
  opening: Timeline["opening"];
};

/**
 * OP (T&M「サムネ」節)。冒頭 openingTiming.duration 秒、黒地から
 * openingTiming.fadeIn 秒かけてフェードインする (フェードアウトは無し)。区間
 * (spans.ts の openingSpan と同じ { start: 0, duration: openingTiming.duration })
 * は opening の有無だけで決まるため、ここでは props からそのまま組み立てる。
 */
export const OpeningTrack: React.FC<Props> = ({ opening }) => {
  const { fps } = useVideoConfig();

  if (!opening) {
    return null;
  }

  const { from, durationInFrames } = toFrameSpan(
    0,
    openingTiming.duration,
    fps,
  );

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ backgroundColor: palette.black }}>
        <OpeningItem opening={opening} durationInFrames={durationInFrames} />
      </AbsoluteFill>
    </Sequence>
  );
};

const OpeningItem: React.FC<{
  opening: NonNullable<Timeline["opening"]>;
  durationInFrames: number;
}> = ({ opening, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(openingTiming.fadeIn, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames,
    fadeOutFrames: 0,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <OpeningFrame
        photo={staticFile(opening.photo)}
        badge={opening.badge}
        title={opening.title}
        character={staticFile(opening.character)}
      />
    </AbsoluteFill>
  );
};
