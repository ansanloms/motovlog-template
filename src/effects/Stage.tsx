import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ThemeRoot } from "../theme/index.ts";
import { fadeOpacity, toFrameSpan } from "./frames.ts";
import type { Timeline } from "./types.ts";

/** Stage が受け取るもの。 */
type Props = {
  /** timeline() が組み立てた演出アイテムの列。 */
  timeline: Timeline;
};

/**
 * Timeline の layers を z 順 (配列の後ろが上) に `<AbsoluteFill>` で包み、
 * layer 内の item を `<Sequence>` として並べる描画部品。fade はフェード
 * 付きの `<AbsoluteFill>`、cut はフェード無しの `<AbsoluteFill>` に変換
 * する。動画のドメイン (章・写真・ED 等) は知らず、ReactNode と秒だけを
 * 扱う。
 */
export const Stage: React.FC<Props> = ({ timeline }) => {
  return (
    <ThemeRoot>
      {timeline.layers.map((layer, layerIndex) => (
        <AbsoluteFill key={layerIndex}>
          {layer.map((item, itemIndex) => {
            const { from, durationInFrames } = toFrameSpan(
              item.at,
              item.duration,
              timeline.fps,
            );

            return (
              <Sequence
                key={itemIndex}
                from={from}
                durationInFrames={durationInFrames}
                name={`layer ${layerIndex}: ${item.kind}`}
              >
                {item.kind === "fade" ? (
                  <FadeLayer
                    durationInFrames={durationInFrames}
                    inFrames={Math.round(item.in * timeline.fps)}
                    outFrames={Math.round(item.out * timeline.fps)}
                  >
                    {item.node}
                  </FadeLayer>
                ) : (
                  <AbsoluteFill>{item.node}</AbsoluteFill>
                )}
              </Sequence>
            );
          })}
        </AbsoluteFill>
      ))}
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
