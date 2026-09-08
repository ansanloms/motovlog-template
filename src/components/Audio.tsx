import { Audio as MediaAudio } from "@remotion/media";
import React from "react";
import { useVideoConfig } from "remotion";
import { toVolumeProp, type Volume } from "./volume.ts";

/** Audio が受け取るもの。 */
type Props = {
  /** 音声素材の URL (staticFile() 済み)。 */
  src: string;
  /** 元音声の頭を捨てる秒数。既定は 0。 */
  trimBefore?: number;
  /**
   * 音量。一定値 (数値) または折れ線 (`{ at, volume }[]`)。折れ線の `at`
   * は要素の再生開始 (trimBefore 適用後) からの秒。既定は 1。不正な値は
   * 要素ファクトリ (`src/components/index.tsx` の `audio()`) の呼び出し時
   * に throw する。
   */
  volume?: Volume;
  /** ループ再生するか。既定は false。 */
  loop?: boolean;
};

/**
 * 音声を 1 本鳴らすだけの純粋コンポーネント (@remotion/media、描画要素は
 * 持たない)。loop 時も折れ線の at は周回をまたいだ通算秒として扱う
 * (`loopVolumeCurveBehavior="extend"`)。
 */
export const Audio: React.FC<Props> = ({
  src,
  trimBefore = 0,
  volume = 1,
  loop = false,
}) => {
  const { fps } = useVideoConfig();
  const volumeProp = React.useMemo(
    () => toVolumeProp(volume, fps),
    [volume, fps],
  );

  return (
    <MediaAudio
      src={src}
      trimBefore={Math.round(trimBefore * fps)}
      volume={volumeProp}
      loop={loop}
      loopVolumeCurveBehavior="extend"
    />
  );
};
