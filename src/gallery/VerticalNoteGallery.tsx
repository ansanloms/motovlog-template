import React from "react";
import { VerticalNote } from "../components/VerticalNote";
import { ThemeRoot } from "../theme";
import { GalleryBackdrop, galleryFps } from "./shared";

// VerticalNote 単体の確認用。フレーム依存の値が無いので尺は任意 (3 秒)。
export const galleryDurationInFrames = galleryFps * 3;

export const VerticalNoteGallery: React.FC = () => {
  return (
    <ThemeRoot>
      <GalleryBackdrop />
      <VerticalNote
        text={
          "2024年に舗装され直した。当時の様子は前回の動画で\nseiga.nicovideo.jp/…（概要欄にリンク）"
        }
      />
    </ThemeRoot>
  );
};
