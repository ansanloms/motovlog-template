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

type Props = {
  ending: Timeline["ending"];
};

// エンディング。fadeToBlackStart から fadeDuration かけて黒へフェードし、
// フェード完了後はコンポジション終端まで黒を維持する。credits があれば
// テキストを重ねる。
export const Ending: React.FC<Props> = ({ ending }) => {
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
          <AbsoluteFill style={{ backgroundColor: "#000000" }} />
        </Sequence>
      ) : null}
      {ending.credits ? (
        <Sequence from={from} durationInFrames={remainingFrames}>
          <Credits credits={ending.credits} parentFrom={from} />
        </Sequence>
      ) : null}
    </>
  );
};

const FadeToBlack: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  // 終端 (durationInFrames - 1) で opacity 1 に到達させる。durationInFrames
  // が 1 の退化ケースでも interpolate の入力域が単調増加になるよう下限を設ける。
  const opacity = interpolate(
    frame,
    [0, Math.max(durationInFrames - 1, 1)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return <AbsoluteFill style={{ backgroundColor: "#000000", opacity }} />;
};

const Credits: React.FC<{
  credits: NonNullable<NonNullable<Timeline["ending"]>["credits"]>;
  // 親 Sequence (fadeToBlackStart 基準) の from。credits.start はタイムライン
  // 絶対秒のままなので、親の from を引いて相対フレームへ補正する。
  parentFrom: number;
}> = ({ credits, parentFrom }) => {
  const { fps } = useVideoConfig();

  const { from: absoluteFrom, durationInFrames } = toFrameSpan(
    credits.start,
    credits.duration,
    fps,
  );
  const from = Math.max(absoluteFrom - parentFrom, 0);

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 32,
            color: "#ffffff",
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
