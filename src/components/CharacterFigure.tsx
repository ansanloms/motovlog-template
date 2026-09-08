import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./CharacterFigure.module.css";

/** CharacterFigure が受け取るもの。 */
type Props = {
  /** 立ち絵 png (staticFile() 済み)。 */
  src: string;
  /** 配置 (左端・右端)。 */
  side: "left" | "right";
  /** 不透明度 (フェード用。呼び出し側が計算して渡す)。 */
  opacity: number;
};

/**
 * 走行中の立ち絵 (T&M「画面配置」節)。左端・上半身・常時表示、章の区切りだけ
 * 右へ移す。画像の縦横比は素材ごとに違うので、高さを固定して幅は自動にする
 * (OpeningFrame のサムネ配置と同じ扱い)。固定 props で、フレーム依存の値
 * (opacity) は呼び出し側 (CharacterLayer) が渡す。
 */
export const CharacterFigure: React.FC<Props> = ({ src, side, opacity }) => {
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        className={`${styles.box} ${side === "left" ? styles.left : styles.right}`}
      >
        <Img src={src} className={styles.image} />
      </div>
    </AbsoluteFill>
  );
};
