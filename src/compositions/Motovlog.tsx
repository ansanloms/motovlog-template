import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Stage, toFrameSpan } from "../effects/index.ts";
import type { Timeline } from "../effects/index.ts";
import { loadTimeline } from "../project/load.ts";

/** Motovlog composition の props。動画の中身 (Timeline) は React 要素を含み
 * JSON 直列化できないため props には載せず、slug だけを持つ (ADR-0010)。 */
export type MotovlogProps = { slug: string };

/**
 * project の timeline.ts (timeline() の戻り値) を読み、fps・width・height・
 * 尺を composition に反映する。
 */
export const calculateMetadata: CalculateMetadataFunction<
  MotovlogProps
> = async ({ props }) => {
  const timeline = await loadTimeline(props.slug);

  return {
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    // Stage と同じ終端基準の丸めで下限 1 フレームを保証する。
    durationInFrames: toFrameSpan(0, timeline.durationSec, timeline.fps)
      .durationInFrames,
    props,
  };
};

/**
 * project の timeline.ts を読み込み、Stage に渡して描画する。slug が変わる
 * たびに読み直し、その間は delayRender() で待つ。
 */
export const Motovlog: React.FC<MotovlogProps> = ({ slug }) => {
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    // slug が変わったら旧 project の描画を消してから読み直す。
    setTimeline(null);
    let cancelled = false;
    const handle = delayRender("load timeline");

    loadTimeline(slug)
      .then((loaded) => {
        if (!cancelled) {
          setTimeline(loaded);
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

  return timeline ? <Stage timeline={timeline} /> : null;
};
