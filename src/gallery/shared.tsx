import React from "react";
import { AbsoluteFill } from "remotion";

// Gallery composition (コンポーネント単体の確認用) が共通で使う fps。
export const galleryFps = 30;

// 確認用の背景。上半分を明るい空、下半分を路面に見立てた固定値で、
// T&M の色ではない。
export const GalleryBackdrop: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, #cfe3f0 50%, #6b6b6b 50%)",
      }}
    />
  );
};
