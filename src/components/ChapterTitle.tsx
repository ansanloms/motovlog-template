import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { chapterTiming, chapterTitleDurationSec } from "../theme/index.ts";
import { fadeEnvelope, secondsToFrames } from "../timeline/frames.ts";
import styles from "./ChapterTitle.module.css";

/**
 * ChapterTitle が受け取るもの。chapter 以外 (小見出し全般) にも使えるよう、
 * 意味は上段の小さい行 (subtitle) と下段の題名 (title) の 2 段のみで縛る。
 */
type Props = {
  /** 下段の題名。 */
  title: string;
  /** 上段の小さい行 (アクセント色)。例 "CHAPTER 3"。 */
  subtitle: string;
};

/**
 * 章タイトル。字幕と同じ下部の暗がりに subtitle と title を左寄せで出す
 * (T&M「章タイトル」節)。固定 props で、区間はフレーム 0 起点。
 */
export const ChapterTitle: React.FC<Props> = ({ title, subtitle }) => {
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
      {/* 字幕と同じ下部の暗がり (SubtitleBand と同じ高さ・グラデーション) */}
      <div className={styles.scrim} />
      <div className={styles.block}>
        <div className={styles.subtitle}>{subtitle}</div>
        <div className={styles.title}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};
