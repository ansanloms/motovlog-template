import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./Annotation.module.css";

/** Annotation が受け取るもの。 */
type Props = {
  /** 表示する文字列。 */
  text: string;
};

/**
 * 右上の注釈 (T&M「画面配置」節)。黒地の板に横書きで出す。最大 2 行。
 * 収まらない長さは出さず概要欄に回す (T&M)。固定 props で、フェード・
 * フレーム依存の値は無い。
 */
export const Annotation: React.FC<Props> = ({ text }) => {
  return (
    <AbsoluteFill>
      <div className={styles.annotation}>{text}</div>
    </AbsoluteFill>
  );
};
