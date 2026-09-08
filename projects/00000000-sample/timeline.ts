import { staticFile } from "remotion";
import {
  chapterTitle,
  openingFrame,
  verticalNote,
} from "../../src/components/index.tsx";
import { clip, cut, fade, video } from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  fps,
  openingTiming,
} from "../../src/theme/timing.ts";

const asset = (path: string) => staticFile(`projects/00000000-sample/${path}`);

export default video({ fps }, [
  clip({
    src: asset("VID_20260802_074903_00_287_359_DASHCAM1.mp4"),
    duration: 36.4,
  }),
  fade(
    openingFrame({
      photo: asset("photos/photo-03.jpg"),
      badge: "#0 福島 / 磐梯吾妻スカイライン",
      title: "浄土平まで\n走ってきた",
      character: staticFile("assets/characters/4.png"),
    }),
    { at: 0, duration: openingTiming.duration, in: openingTiming.fadeIn },
  ),
  fade(chapterTitle({ title: "浄土平へ", subtitle: "CHAPTER 1" }), {
    at: 5,
    duration: chapterTitleDurationSec,
    in: chapterTiming.fade,
    out: chapterTiming.fade,
  }),
  cut(
    verticalNote({
      text: "磐梯吾妻スカイラインは11月中旬から冬季閉鎖\n（概要欄にリンク）",
    }),
    { at: 14, duration: 5 },
  ),
]);
