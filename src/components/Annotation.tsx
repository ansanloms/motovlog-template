import React from "react";
import { AbsoluteFill } from "remotion";
import styles from "./Annotation.module.css";
import { splitForVertical } from "./verticalText.ts";

/** Annotation が受け取るもの。 */
type Props = {
  /** 表示する文字列。`\n` で列を分ける。 */
  text: string;
};

/**
 * 右端の縦書き注釈 (T&M「画面配置」節)。`\n` で列を分ける (vertical-rl では
 * 改行が次の列になり、右から左へ列が増える)。英数字は text-orientation:
 * upright で正立にし、2〜3 桁の数字は縦中横 (splitForVertical) で 1 文字分に
 * まとめる。列数はコードで縛らない (最大 3 列は運用規則、T&M 参照)。固定
 * props で、フェード・フレーム依存の値は無い。
 */
export const Annotation: React.FC<Props> = ({ text }) => {
  return (
    <AbsoluteFill>
      <div className={styles.annotation}>
        {splitForVertical(text).map((part, index) =>
          part.kind === "tcy" ? (
            <span key={index} className={styles.tcy}>
              {part.value}
            </span>
          ) : (
            <React.Fragment key={index}>{part.value}</React.Fragment>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};
