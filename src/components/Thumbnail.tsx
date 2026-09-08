import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./Thumbnail.module.css";

/** Thumbnail が受け取るもの。 */
type Props = {
  /** 走行写真 (staticFile() 済み)。 */
  photo: string;
  /** バッジの文字 (例 "#12 愛媛 / 国道378号")。 */
  badge: string;
  /** 地名 (最大 12 文字、"\n" で改行可)。 */
  title: string;
  /** 立ち絵 png (staticFile() 済み)。サムネ配置 (右下・上半身)。 */
  character: string;
};

/**
 * サムネの絵 (T&M「サムネ」節)。OP とサムネ用フレームの両方で使う。走行写真
 * の上に、左下に話数バッジと地名、右下に立ち絵を重ねる。固定 props で、
 * フレーム依存の値は無い。
 */
export const Thumbnail: React.FC<Props> = ({
  photo,
  badge,
  title,
  character,
}) => {
  return (
    <AbsoluteFill>
      <Img src={photo} className={styles.photo} />
      <div className={styles.block}>
        <div className={styles.badge}>{badge}</div>
        <div className={styles.title}>{title}</div>
      </div>
      <div className={styles.characterBox}>
        <Img src={character} className={styles.characterImg} />
      </div>
    </AbsoluteFill>
  );
};
