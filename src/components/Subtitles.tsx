import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  lines: Timeline["lines"];
  style: Timeline["style"]["subtitle"];
};

// セリフ字幕。表示区間は [start, start + duration + subtitleTail]。
export const Subtitles: React.FC<Props> = ({ lines, style }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {lines.map((line) => {
        const { from, durationInFrames } = toFrameSpan(
          line.start,
          line.duration + line.subtitleTail,
          fps,
        );

        return (
          <Sequence
            key={line.id}
            from={from}
            durationInFrames={durationInFrames}
          >
            <SubtitleText text={line.text} style={style} />
          </Sequence>
        );
      })}
    </>
  );
};

const SubtitleText: React.FC<{
  text: string;
  style: Timeline["style"]["subtitle"];
}> = ({ text, style }) => {
  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    fontSize: style.fontSize,
    color: style.color,
    letterSpacing: style.letterSpacing,
    textAlign: "center",
    whiteSpace: "pre-wrap",
    ...(style.outline
      ? {
          WebkitTextStroke: `${style.outline.width}px ${style.outline.color}`,
          // 縁取りをグリフの外側に塗る (既定は fill の上に stroke が乗り、
          // 縁取りの内側半分が文字の塗りつぶしに侵食されて細く見える)。
          paintOrder: "stroke",
        }
      : {}),
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: style.bottomOffset,
      }}
    >
      <div style={textStyle}>{text}</div>
    </AbsoluteFill>
  );
};
