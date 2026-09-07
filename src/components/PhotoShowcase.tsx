import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./PhotoShowcase.module.css";

type Props = {
  // 3 枚以上は並べずカットで順送りにする (T&M「写真紹介」節)。呼び出し側が
  // 1 枚ずつ Series で並べる。このコンポーネントは 1 枚・2 枚のレイアウト
  // だけを持つ。
  photos: readonly [string] | readonly [string, string];
};

// 走行映像の上に写真を中央に重ねる (T&M「写真紹介」節)。1 枚は左右
// 480px、2 枚は正方形に切って横に並べる。背景は暗くせず、フェード・ズーム・
// パンはしない。固定 props で、フレーム依存の値は無い。
export const PhotoShowcase: React.FC<Props> = ({ photos }) => {
  if (photos.length === 1) {
    return (
      <AbsoluteFill>
        <div className={styles.frameSingle}>
          <Img src={photos[0]} className={styles.photo} />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div className={styles.frameGrid}>
        {photos.map((photo, index) => (
          <Img key={index} src={photo} className={styles.cell} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
