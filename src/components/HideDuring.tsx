import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { toFrameSpan } from "../timeline/frames.ts";
import type { Span } from "../timeline/spans.ts";

/** HideDuring が受け取るもの。 */
type Props = {
  /** children を消す区間 (秒) の一覧。 */
  spans: Span[];
  /** 区間外でだけ描く要素。 */
  children: React.ReactNode;
};

/**
 * spans のいずれかの区間 (秒 → フレームは toFrameSpan で換算) に現在フレームが
 * 入っていれば children を描かない (章タイトル中の字幕を消す。T&M の表示の
 * 相互制御)。
 */
export const HideDuring: React.FC<Props> = ({ spans, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hidden = spans.some((span) => {
    const { from, durationInFrames } = toFrameSpan(
      span.start,
      span.duration,
      fps,
    );

    return frame >= from && frame < from + durationInFrames;
  });

  if (hidden) {
    return null;
  }

  return <>{children}</>;
};
