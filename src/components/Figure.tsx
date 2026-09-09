import React from "react";
import { Img } from "remotion";
import styles from "./Figure.module.css";

/** Figure が受け取るもの。layers はすべて同一キャンバスの PNG (staticFile() 済み)。 */
type Props = {
  /** 下から上の順に重ねる画像の列 (体・腕・目・口・眉・小物等)。 */
  layers: readonly string[];
};

/**
 * 走行中の立ち絵 (T&M「画面配置」節、design 面 A)。同一キャンバスの画像を
 * 下から順に重ねて描く固定 props の純粋コンポーネント (ADR-0011)。フレーム
 * 依存の値は持たず、目パチ・口パク・表情の選択は呼び出し側
 * (src/compositions/figure.ts) が行う。
 */
export const Figure: React.FC<Props> = ({ layers }) => {
  return (
    <div className={styles.box}>
      <div className={styles.figure}>
        {layers.map((src, index) => (
          <Img key={index} src={src} className={styles.img} />
        ))}
      </div>
    </div>
  );
};
