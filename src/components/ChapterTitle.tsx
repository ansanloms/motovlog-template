import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeEnvelope, secondsToFrames } from "../timeline/frames";
import { chapterTiming } from "../theme";
import styles from "./ChapterTitle.module.css";

type Props = {
  number: number;
  title: string;
};

// 章タイトルの尺 (秒)。呼び出し側が <Sequence durationInFrames> に使う。
export const chapterTitleDurationSec =
  chapterTiming.fade * 2 + chapterTiming.hold;

// 章タイトル。字幕と同じ下部の暗がりに CHAPTER n と題名を左寄せで出す
// (T&M「章タイトル」節)。固定 props で、区間はフレーム 0 起点。
export const ChapterTitle: React.FC<Props> = ({ number, title }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const durationInFrames = secondsToFrames(chapterTitleDurationSec, fps);
  const fadeFrames = secondsToFrames(chapterTiming.fade, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames: fadeFrames,
    fadeOutFrames: fadeFrames,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div className={styles.scrim} />
      <div className={styles.block}>
        <div className={styles.label}>{`CHAPTER ${number}`}</div>
        <div className={styles.title}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};
