import React from "react";
import { Series, staticFile } from "remotion";
import { PhotoShowcase } from "../components/PhotoShowcase";
import { ThemeRoot } from "../theme";
import { GalleryBackdrop, galleryFps } from "./shared";

// PhotoShowcase 単体の確認用。(a) 1 枚 2 秒 → (b) 2 枚 2 秒 → (c) 3 枚以上は
// カットで順送りにする運用 (T&M「写真紹介」節) を 1 枚ずつ 1 秒で見せる。
export const galleryDurationInFrames = Math.ceil(7 * galleryFps);

export const PhotoShowcaseGallery: React.FC = () => {
  return (
    <ThemeRoot>
      <GalleryBackdrop />
      <Series>
        <Series.Sequence durationInFrames={galleryFps * 2}>
          <PhotoShowcase photos={[staticFile("assets/samples/still-01.jpg")]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={galleryFps * 2}>
          <PhotoShowcase
            photos={[
              staticFile("assets/samples/portrait-01.jpg"),
              staticFile("assets/samples/still-02.jpg"),
            ]}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={galleryFps}>
          <PhotoShowcase photos={[staticFile("assets/samples/still-01.jpg")]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={galleryFps}>
          <PhotoShowcase photos={[staticFile("assets/samples/still-02.jpg")]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={galleryFps}>
          <PhotoShowcase photos={[staticFile("assets/samples/still-03.jpg")]} />
        </Series.Sequence>
      </Series>
    </ThemeRoot>
  );
};
