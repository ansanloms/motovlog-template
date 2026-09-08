import { Video as MediaVideo } from "@remotion/media";
import React from "react";
import { useVideoConfig } from "remotion";

/** Video が受け取るもの。 */
type Props = {
  /** 映像素材の URL (staticFile() 済み)。 */
  src: string;
  /** 元動画の頭を捨てる秒数。既定は 0。 */
  trimBefore?: number;
};

/** 走行映像を 1 本描く純粋コンポーネント (@remotion/media、ADR-0003)。 */
export const Video: React.FC<Props> = ({ src, trimBefore = 0 }) => {
  const { fps } = useVideoConfig();

  return (
    <MediaVideo
      src={src}
      trimBefore={Math.round(trimBefore * fps)}
      objectFit="cover"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
