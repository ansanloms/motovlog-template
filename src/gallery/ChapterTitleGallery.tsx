import React from "react";
import {
  ChapterTitle,
  chapterTitleDurationSec,
} from "../components/ChapterTitle";
import { ThemeRoot } from "../theme";
import { GalleryBackdrop, galleryFps } from "./shared";

// ChapterTitle 単体の確認用。固定 props で描く。
export const galleryDurationInFrames = Math.ceil(
  chapterTitleDurationSec * galleryFps,
);

export const ChapterTitleGallery: React.FC = () => {
  return (
    <ThemeRoot>
      <GalleryBackdrop />
      <ChapterTitle number={3} title="日が落ちる前に海沿いへ" />
    </ThemeRoot>
  );
};
