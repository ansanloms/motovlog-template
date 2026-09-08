import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./SubtitleBand.module.css";

// 下部の暗がりの描画のみ。表示区間・不透明度 (フェード) の計算は
// tracks/Line.tsx が行う。
export const SubtitleBand: React.FC = () => {
  return (
    <AbsoluteFill className={styles.layer}>
      <div className={styles.band} />
    </AbsoluteFill>
  );
};
