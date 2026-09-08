import { Video as MediaVideo } from "@remotion/media";
import React from "react";
import { useVideoConfig } from "remotion";
import { toVolumeProp, type Volume } from "./volume.ts";

/** Video が受け取るもの。 */
type Props = {
  /** 映像素材の URL (staticFile() 済み)。 */
  src: string;
  /** 元動画の頭を捨てる秒数。既定は 0。 */
  trimBefore?: number;
  /**
   * 音量。一定値 (数値) または折れ線 (`{ at, volume }[]`)。折れ線の `at`
   * は要素の再生開始 (trimBefore 適用後) からの秒。既定は 1。不正な値は
   * 要素ファクトリ (`src/components/index.tsx` の `video()`) の呼び出し時
   * に throw する。
   */
  volume?: Volume;
};

/** 走行映像を 1 本描く純粋コンポーネント (@remotion/media、ADR-0003)。 */
export const Video: React.FC<Props> = ({ src, trimBefore = 0, volume = 1 }) => {
  const { fps } = useVideoConfig();
  const volumeProp = React.useMemo(
    () => toVolumeProp(volume, fps),
    [volume, fps],
  );

  return (
    <MediaVideo
      src={src}
      trimBefore={Math.round(trimBefore * fps)}
      volume={volumeProp}
      objectFit="cover"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
