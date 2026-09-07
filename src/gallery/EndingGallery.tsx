import React from "react";
import { episodeHeader } from "../components/episode";
import { Ending } from "../components/Ending";
import { endingTiming, ThemeRoot } from "../theme";
import { galleryFps } from "./shared";

// Ending 単体の確認用。design サンプル E の値をそのまま固定 props にする。
export const galleryDurationInFrames = Math.ceil(
  endingTiming.duration * galleryFps,
);

export const EndingGallery: React.FC = () => {
  return (
    <ThemeRoot>
      <Ending
        episode={episodeHeader({
          number: 12,
          area: "愛媛",
          road: "国道378号",
        })}
        date="2026.08.15-17"
        distance="318 km"
        ridingTime="8:12"
        route={["松山", "下灘駅", "道の駅ふたみ", "佐田岬"]}
        credits={["VOICEVOX: 青山龍星", "立ち絵: Jacca さま"]}
      />
    </ThemeRoot>
  );
};
