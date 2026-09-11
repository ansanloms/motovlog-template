import { Audio } from "@remotion/media";
import React from "react";
import { displayText } from "../voice/reading.ts";
import { Subtitle } from "./Subtitle.tsx";

/** Line が受け取るもの。 */
type Props = {
  /** {漢字|よみ} 記法を含む台本。字幕には displayText() で展開した形を出す。 */
  text: string;
  /** 音声素材の URL (staticFile() 済み)。声無し (voice: null) の発話には渡さない。 */
  src?: string;
};

/**
 * 発話 1 本を描く純粋コンポーネント。字幕 (Subtitle) と音声 (@remotion/media
 * の Audio) を重ねる。src が無ければ Audio を描かない (声無しの発話)。
 */
export const Line: React.FC<Props> = ({ text, src }) => {
  return (
    <>
      <Subtitle text={displayText(text)} />
      {src !== undefined && <Audio src={src} />}
    </>
  );
};
