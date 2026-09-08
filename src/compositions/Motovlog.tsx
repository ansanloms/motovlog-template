import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Stage, toFrameSpan } from "../effects/index.ts";
import type { Video } from "../effects/index.ts";
import { loadVideo } from "../project/load.ts";

/** Motovlog composition の props。動画の中身 (Video) は React 要素を含み
 * JSON 直列化できないため props には載せず、slug だけを持つ (ADR-0010)。 */
export type MotovlogProps = { slug: string };

/**
 * project の timeline.ts (video() の戻り値) を読み、fps・width・height・尺を
 * composition に反映する。
 */
export const calculateMetadata: CalculateMetadataFunction<
  MotovlogProps
> = async ({ props }) => {
  const video = await loadVideo(props.slug);

  return {
    fps: video.fps,
    width: video.width,
    height: video.height,
    // Stage と同じ終端基準の丸めで下限 1 フレームを保証する。
    durationInFrames: toFrameSpan(0, video.durationSec, video.fps)
      .durationInFrames,
    props,
  };
};

/**
 * project の timeline.ts を読み込み、Stage に渡して描画する。slug が変わる
 * たびに読み直し、その間は delayRender() で待つ。
 */
export const Motovlog: React.FC<MotovlogProps> = ({ slug }) => {
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => {
    // slug が変わったら旧 project の描画を消してから読み直す。
    setVideo(null);
    let cancelled = false;
    const handle = delayRender("load timeline");

    loadVideo(slug)
      .then((loaded) => {
        if (!cancelled) {
          setVideo(loaded);
        }
        continueRender(handle);
      })
      .catch((error) => {
        if (cancelled) {
          continueRender(handle);
          return;
        }
        cancelRender(error);
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [slug]);

  return video ? <Stage video={video} /> : null;
};
