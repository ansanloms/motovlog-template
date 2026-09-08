import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";
import styles from "./Subtitles.module.css";

type Props = {
  lines: VoicedTimeline["lines"];
};

// セリフ字幕。表示区間は [start, start + duration + subtitleTail]。ただし
// 次のセリフの開始より後ろにはみ出さないよう終端を clamp する。
export const Subtitles: React.FC<Props> = ({ lines }) => {
  const { fps } = useVideoConfig();

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.start - b.start),
    [lines],
  );

  return (
    <>
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
            <SubtitleText text={line.text} />
          </Sequence>
        );
      })}
    </>
  );
};

const SubtitleText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill className={styles.layer}>
      <div className={styles.text}>{text}</div>
    </AbsoluteFill>
  );
};
