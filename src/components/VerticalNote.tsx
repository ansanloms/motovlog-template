import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./VerticalNote.module.css";

type Props = {
  text: string;
};

// 右端の縦書き注釈 (T&M「画面配置」節)。`\n` で列を分ける (vertical-rl では
// 改行が次の列になり、右から左へ列が増える)。列数はコードで縛らない
// (最大 3 列は運用規則、T&M 参照)。固定 props で、フェード・フレーム依存の
// 値は無い。
export const VerticalNote: React.FC<Props> = ({ text }) => {
  return (
    <AbsoluteFill>
      <div className={styles.note}>{text}</div>
    </AbsoluteFill>
  );
};
