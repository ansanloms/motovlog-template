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
  /**
   * 立ち絵のレイヤー (下から上の順、staticFile() 済み、同一キャンバスの
   * PNG)。サムネ配置 (右下・上半身)。
   */
  character: readonly string[];
};

/**
 * サムネの絵 (T&M「サムネ」節)。OP とサムネ用フレームの両方で使う。走行写真
 * の上に、左下に話数バッジと地名、右下に立ち絵を重ねる。固定 props の純粋
 * コンポーネントで、フレーム依存の値は無い。レイヤーの選択 (表情名から
 * URL 列への解決) は src/compositions/thumbnail.ts が行い、ここは受け取った
 * 列をそのまま重ねて描くだけ (ADR-0011)。
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
      <div className={styles.characterAnchor}>
        <div className={styles.character}>
          {character.map((src, index) => (
            <Img key={index} src={src} className={styles.characterImg} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
