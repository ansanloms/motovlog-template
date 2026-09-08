import React from "react";
import { staticFile } from "remotion";
import { OpeningFrame } from "../components/OpeningFrame";
import { openingTiming, ThemeRoot } from "../theme";
import { galleryFps } from "./shared";

// OpeningFrame 単体の確認用。固定 props で描く。
export const galleryDurationInFrames = Math.ceil(
  openingTiming.duration * galleryFps,
);

export const OpeningFrameGallery: React.FC = () => {
  return (
    <ThemeRoot>
      <OpeningFrame
        photo={staticFile("assets/samples/still-02.jpg")}
        episode="#12 愛媛 / 国道378号"
        title={"国道378号を\n西へ走った"}
        character={staticFile("assets/characters/4.png")}
      />
    </ThemeRoot>
  );
};
