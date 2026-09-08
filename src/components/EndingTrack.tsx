import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { thumbnailFrameTiming } from "../theme/index.ts";
import { secondsToFrames, toFrameSpan } from "../timeline/frames.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";
import { endingSpan, thumbnailSpan } from "../timeline/spans.ts";
import type { Span } from "../timeline/spans.ts";
import { Ending } from "./Ending.tsx";
import { OpeningFrame } from "./OpeningFrame.tsx";

/** EndingTrack が受け取るもの。 */
type Props = {
  /** timeline 全体 (ending・opening を参照する)。 */
  timeline: VoicedTimeline;
};

/**
 * ED とサムネ用フレーム (T&M「OP・ED・サムネ用フレーム」節)。ED は最後の
 * クリップからフェードなしでカットインし (クリップは背後にそのまま残る)、
 * opening があれば ED の後にサムネ用フレームが続き、
 * thumbnailFrameTiming.crossfade 秒かけて ED からクロスフェードする。
 */
export const EndingTrack: React.FC<Props> = ({ timeline }) => {
  const { fps } = useVideoConfig();
  const { ending, opening } = timeline;
  const span = endingSpan(timeline);

  if (!ending || !span) {
    return null;
  }

  const thumbnail = thumbnailSpan(timeline);

  // ED の Sequence は endingSpan と thumbnailSpan (あれば) を合わせた長さに
  // する。ED はサムネ用フレームの下に残り続け、サムネ用フレームは黒からの
  // フェードインではなく ED からのクロスフェードになる。
  const { from, durationInFrames } = toFrameSpan(
    span.start,
    span.duration + (thumbnail ? thumbnail.duration : 0),
    fps,
  );

  return (
    <>
      <Sequence from={from} durationInFrames={durationInFrames}>
        <EndingItem ending={ending} />
      </Sequence>
      {thumbnail && opening ? (
        <ThumbnailSequence opening={opening} span={thumbnail} />
      ) : null}
    </>
  );
};

const EndingItem: React.FC<{
  ending: NonNullable<VoicedTimeline["ending"]>;
}> = ({ ending }) => {
  return (
    <Ending
      title={ending.title}
      subtitle={ending.subtitle}
      date={{
        from: Temporal.ZonedDateTime.from(ending.date.from),
        to: Temporal.ZonedDateTime.from(ending.date.to),
      }}
      distance={ending.distance}
      ridingTime={Temporal.Duration.from(ending.ridingTime)}
      routes={ending.routes}
      credits={ending.credits}
    />
  );
};

const ThumbnailSequence: React.FC<{
  opening: NonNullable<VoicedTimeline["opening"]>;
  span: Span;
}> = ({ opening, span }) => {
  const { fps } = useVideoConfig();
  const { from, durationInFrames } = toFrameSpan(
    span.start,
    span.duration,
    fps,
  );

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <ThumbnailItem opening={opening} />
    </Sequence>
  );
};

const ThumbnailItem: React.FC<{
  opening: NonNullable<VoicedTimeline["opening"]>;
}> = ({ opening }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(thumbnailFrameTiming.crossfade, fps);

  // フェードの長さと区間の長さが同じなので、最終フレームを 1 にする。
  const opacity = interpolate(
    frame,
    [0, Math.max(1, fadeInFrames - 1)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

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
