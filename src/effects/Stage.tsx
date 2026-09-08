import { Video as MediaVideo } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ThemeRoot } from "../theme/index.ts";
import { fadeOpacity, toFrameSpan } from "./frames.ts";
import type { Video as VideoData } from "./types.ts";

/** Stage が受け取るもの。 */
type Props = {
  /** video() が組み立てた演出アイテムの列。 */
  video: VideoData;
};

/**
 * Video の items を配列順 (後ろが上) に `<Sequence>` として並べる描画部品。
 * clip は `<Video>` (@remotion/media、ADR-0003)、fade はフェード付きの
 * `<AbsoluteFill>`、cut はフェード無しの `<AbsoluteFill>` に変換する。
 * 動画のドメイン (章・写真・ED 等) は知らず、ReactNode と秒だけを扱う。
 */
export const Stage: React.FC<Props> = ({ video }) => {
  return (
    <ThemeRoot>
      {video.items.map((item, index) => {
        const { from, durationInFrames } = toFrameSpan(
          item.at,
          item.duration,
          video.fps,
        );

        if (item.kind === "clip") {
          return (
            <Sequence
              key={index}
              from={from}
              durationInFrames={durationInFrames}
              name={`clip: ${item.src.split("/").pop()}`}
            >
              <MediaVideo
                src={item.src}
                trimBefore={Math.round(item.trimBefore * video.fps)}
                objectFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </Sequence>
          );
        }

        if (item.kind === "fade") {
          return (
            <Sequence
              key={index}
              from={from}
              durationInFrames={durationInFrames}
              name="fade"
            >
              <FadeLayer
                durationInFrames={durationInFrames}
                inFrames={Math.round(item.in * video.fps)}
                outFrames={Math.round(item.out * video.fps)}
              >
                {item.node}
              </FadeLayer>
            </Sequence>
          );
        }

        return (
          <Sequence
            key={index}
            from={from}
            durationInFrames={durationInFrames}
            name="cut"
          >
            <AbsoluteFill>{item.node}</AbsoluteFill>
          </Sequence>
        );
      })}
    </ThemeRoot>
  );
};

/** fade アイテムの不透明度を、Sequence 内 (0 起点) の frame から計算して当てる。 */
const FadeLayer: React.FC<{
  durationInFrames: number;
  inFrames: number;
  outFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, inFrames, outFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = fadeOpacity({ frame, durationInFrames, inFrames, outFrames });

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
