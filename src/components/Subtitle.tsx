import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./Subtitle.module.css";

/** Subtitle の props。 */
type Props = {
  /** 表示する字幕文。 */
  text: string;
};

/** セリフ字幕の文字の描画のみ。表示区間の計算は呼び出し側が行う。 */
export const Subtitle: React.FC<Props> = ({ text }) => {
  return (
    <AbsoluteFill className={styles.layer}>
      <div className={styles.text}>{text}</div>
    </AbsoluteFill>
  );
};
