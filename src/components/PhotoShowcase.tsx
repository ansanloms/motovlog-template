import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./PhotoShowcase.module.css";
import { Video } from "./Video.tsx";
import type { Volume } from "./volume.ts";

/** 写真紹介の枠に置く短い動画。音は既定で出さない (volume 0)。 */
export type PhotoVideo = {
  /** 動画素材の URL (staticFile() 済み)。 */
  video: string;
  /** 元動画の頭を捨てる秒数。既定は 0。 */
  trimBefore?: number;
  /** 音量。既定は 0 (無音)。詳細は Video の props を参照。 */
  volume?: Volume;
};

/** PhotoShowcase が受け取るもの。 */
type Props = {
  /**
   * 表示する写真・動画 (1〜2 個。3 個以上は並べずカットで順送りにする、
   * T&M「写真紹介」節。呼び出し側が 1 つずつ Series で並べる)。要素は
   * 写真の URL (文字列) か、短い動画 (PhotoVideo)。
   */
  photos: readonly (string | PhotoVideo)[];
};

/** photos の動画要素 1 個を描く (volume の既定 0 をここで解決する)。 */
const PhotoVideoCell: React.FC<{ photo: PhotoVideo }> = ({ photo }) => {
  const volume = photo.volume ?? 0;

  return (
    <div className={styles.cell}>
      <Video src={photo.video} trimBefore={photo.trimBefore} volume={volume} />
    </div>
  );
};

/**
 * 走行映像の上に写真・短い動画を中央に重ねる (T&M「写真紹介」節)。1 個は
 * 左右 480px、2 個以上は正方形に切って横に並べる。列数による分岐は持たず、
 * 1 つの枠 (CSS grid) に photos を並べるだけで、列幅は個数で CSS 側
 * (.frame:has(> :only-child)) が切り替える。背景は暗くせず、フェード・
 * ズーム・パンはしない。固定 props で、フレーム依存の値は無い。動画は
 * 音が既定で出ない (volume 0)。走行映像の上に重ねる演出のため、T&M の
 * 背景音をそのまま流す。
 */
export const PhotoShowcase: React.FC<Props> = ({ photos }) => {
  return (
    <AbsoluteFill>
      <div className={styles.frame}>
        {photos.map((photo, index) =>
          typeof photo === "string" ? (
            <Img key={index} src={photo} className={styles.cell} />
          ) : (
            <PhotoVideoCell key={index} photo={photo} />
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};
