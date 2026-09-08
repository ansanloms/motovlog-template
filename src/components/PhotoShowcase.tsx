import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./PhotoShowcase.module.css";

/** PhotoShowcase が受け取るもの。 */
type Props = {
  /**
   * 表示する写真 (1〜2 枚。3 枚以上は並べずカットで順送りにする、
   * T&M「写真紹介」節。呼び出し側が 1 枚ずつ Series で並べる)。
   */
  photos: readonly string[];
};

/**
 * 走行映像の上に写真を中央に重ねる (T&M「写真紹介」節)。1 枚は左右
 * 480px、2 枚以上は正方形に切って横に並べる。列数による分岐は持たず、
 * 1 つの枠 (CSS grid) に photos を並べるだけで、列幅は枚数で CSS 側
 * (.frame:has(> :only-child)) が切り替える。背景は暗くせず、フェード・
 * ズーム・パンはしない。固定 props で、フレーム依存の値は無い。
 */
export const PhotoShowcase: React.FC<Props> = ({ photos }) => {
  return (
    <AbsoluteFill>
      <div className={styles.frame}>
        {photos.map((photo, index) => (
          <Img key={index} src={photo} className={styles.cell} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
