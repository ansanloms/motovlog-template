import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  overlays: Timeline["overlays"];
};

// 写真・動画の差し込み。
export const Overlays: React.FC<Props> = ({ overlays }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {overlays.map((overlay, index) => {
        const { from, durationInFrames } = toFrameSpan(
          overlay.start,
          overlay.duration,
          fps,
        );

        return (
          <Sequence
            key={`${overlay.src}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <OverlayItem
              overlay={overlay}
              durationInFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const OverlayItem: React.FC<{
  overlay: Timeline["overlays"][number];
  durationInFrames: number;
}> = ({ overlay, durationInFrames }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const fadeInFrames = secondsToFrames(overlay.fadeIn, fps);
  const fadeOutFrames = secondsToFrames(overlay.fadeOut, fps);

  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames,
    fadeOutFrames,
  });

  const src = staticFile(overlay.src);
  const style: React.CSSProperties = {
    opacity,
    transform: `translate(-50%, -50%) translate(${overlay.x}px, ${overlay.y}px) scale(${overlay.scale})`,
    position: "absolute",
    top: "50%",
    left: "50%",
  };

  return (
    <AbsoluteFill>
      {overlay.kind === "image" ? (
        <Img src={src} style={style} />
      ) : (
        <Video
          src={src}
          style={style}
          volume={(f) =>
            fadeEnvelope({
              frame: f,
              durationInFrames,
              fadeInFrames,
              fadeOutFrames,
              peak: overlay.volume,
            })
          }
          trimBefore={secondsToFrames(overlay.sourceFrom, fps)}
        />
      )}
    </AbsoluteFill>
  );
};
