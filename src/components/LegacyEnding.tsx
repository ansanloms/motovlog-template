// #47 で `Ending` (src/components/Ending.tsx) に置き換えて削除する。
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";
import { toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";
import { fontWeight, palette, typeScale } from "../theme";

type Props = {
  ending: Timeline["ending"];
};

// エンディング。fadeToBlackStart から fadeDuration かけて黒へフェードし、
// フェード完了後はコンポジション終端まで黒を維持する。credits があれば
// テキストを重ねる。
export const LegacyEnding: React.FC<Props> = ({ ending }) => {
  const { fps, durationInFrames } = useVideoConfig();

  if (!ending) {
    return null;
  }

  const { from, durationInFrames: fadeDurationInFrames } = toFrameSpan(
    ending.fadeToBlackStart,
    ending.fadeDuration,
    fps,
  );
  // フェード開始がコンポジション終端以降なら、フェード自体を描画しない。
  const remainingFrames = durationInFrames - from;

  if (remainingFrames <= 0) {
    return null;
  }

  // フェード完了後、コンポジション終端まで黒を維持する区間。
  const holdFrom = from + fadeDurationInFrames;
  const holdDurationInFrames = durationInFrames - holdFrom;

  return (
    <>
      <Sequence from={from} durationInFrames={fadeDurationInFrames}>
        <FadeToBlack durationInFrames={fadeDurationInFrames} />
      </Sequence>
      {holdDurationInFrames > 0 ? (
        <Sequence from={holdFrom} durationInFrames={holdDurationInFrames}>
          <AbsoluteFill style={{ backgroundColor: palette.black }} />
        </Sequence>
      ) : null}
      {ending.credits ? <Credits credits={ending.credits} /> : null}
    </>
  );
};

const FadeToBlack: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  // 最終フレームで 1 に達する。1 フレームのフェードは常に黒。
  const last = durationInFrames - 1;
  const opacity =
    last <= 0
      ? 1
      : interpolate(frame, [0, last], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return <AbsoluteFill style={{ backgroundColor: palette.black, opacity }} />;
};

const Credits: React.FC<{
  credits: NonNullable<NonNullable<Timeline["ending"]>["credits"]>;
}> = ({ credits }) => {
  const { fps } = useVideoConfig();

  // credits.start はタイムライン絶対秒なので、そのまま絶対フレームの
  // Sequence として置く (フェード開始基準の Sequence へネストしない)。
  const { from, durationInFrames } = toFrameSpan(
    credits.start,
    credits.duration,
    fps,
  );

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* ED の見た目は T&M の ED 節に沿った再設計 (別 issue) で置き換える。
        それまで暫定。 */}
        <div
          style={{
            fontFamily,
            fontWeight: fontWeight.medium,
            fontSize: typeScale.note,
            color: palette.inkVideo,
            textAlign: "center",
            whiteSpace: "pre-wrap",
          }}
        >
          {credits.text}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};
