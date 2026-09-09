import React from "react";
import { Img } from "remotion";
import styles from "./Figure.module.css";

/** Figure が受け取るもの。layers はすべて同一キャンバスの PNG (staticFile() 済み)。 */
type Props = {
  /** 下から上の順に重ねる画像の列 (体・腕・目・口・眉・小物等)。 */
  layers: readonly string[];
  /** 呼吸の揺らぎの CSS transform 文字列 (呼び出し側が breathAt() で作る)。 */
  transform: string;
};

/**
 * 走行中の立ち絵 (T&M「画面配置」節、design 面 A)。同一キャンバスの画像を
 * 下から順に重ねて描く固定 props の純粋コンポーネント (ADR-0011)。フレーム
 * 依存の計算はせず、目パチ・口パク・表情・呼吸の揺らぎの選択は呼び出し側
 * (src/compositions/figure.ts) が行い、その結果 (layers・transform) を
 * インラインスタイルとして受け取るだけにする (ADR-0005)。
 * 箱 (.box) は下端 (足の付け根) と左右で切り、上は呼吸の余白
 * (--figure-breath-headroom) だけ広げる。呼吸の transform は箱の下端中央を
 * 起点に上へ伸びる (transform-origin: 50% 100%) ため、overflow: hidden で
 * 箱の上端で単純に切ると呼吸のピークで頭頂が削れる。clip-path の inset で
 * 上だけ負のオフセットにし、切り取り領域を箱の外へ広げて回避する。
 */
export const Figure: React.FC<Props> = ({ layers, transform }) => {
  return (
    <div className={styles.box}>
      <div className={styles.figure} style={{ transform }}>
        {layers.map((src, index) => (
          <Img key={index} src={src} className={styles.img} />
        ))}
      </div>
    </div>
  );
};
