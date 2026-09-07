import React from "react";
import { AbsoluteFill, Img } from "remotion";
import styles from "./OpeningFrame.module.css";

type Props = {
  photo: string;
  episode: string; // バッジの文字 (例 "#12 愛媛 / 国道378号")
  title: string; // 地名 (最大 12 文字、"\n" で改行可)
  character?: string; // 立ち絵 png (staticFile() 済み)。サムネ配置 (右下・上半身) 専用
};

// OP / サムネ用フレーム (T&M「サムネ」節)。走行写真の上に、左下に話数バッジと
// 地名、任意で右下に立ち絵を重ねる。走行中の立ち絵 (左・常時表示) は
// CharacterLayer が別に持つ。黒からのフェードイン (OP) と ED からの
// クロスフェード (サムネ用フレーム) は区切りの遷移なので組み立て側 (#47) が
// 扱う。固定 props で、フレーム依存の値は無い。
export const OpeningFrame: React.FC<Props> = ({
  photo,
  episode,
  title,
  character,
}) => {
  return (
    <AbsoluteFill>
      <Img src={photo} className={styles.photo} />
      <div className={styles.block}>
        <div className={styles.badge}>{episode}</div>
        <div className={styles.title}>{title}</div>
      </div>
      {character ? (
        <div className={styles.characterBox}>
          <Img src={character} className={styles.characterImg} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
