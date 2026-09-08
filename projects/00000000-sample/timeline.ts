// このファイルは新しい project の出発点として「コピーして直す」ためのサンプル。
// 走行映像 1 本・OP・章タイトル・写真紹介・ED・注釈・発話 (3 パターン) の
// 一通りの要素を、実際に動く形で並べている。仕様の正本は README
// (「timeline.ts の書き方」「発話」) と ADR で、ここのコメントは仕様の丸写し
// ではなく「ここをこう変えるとこうなる」を書く。
//
// コピーして直す場所:
// - slug: 下の asset() の "00000000-sample" と .env の REMOTION_PROJECT
// - 素材のパス: asset() に渡す各ファイル名 (public/projects/<slug>/ 配下)
// - サムネ・章タイトル・写真紹介・ED・注釈・発話の中身 (props と text)
//
// 動かし方:
// - .env に REMOTION_PROJECT=<slug> と VOICEVOX_URL=<VOICEVOX ENGINE の URL>
//   を書いて `npm run dev`。Studio が起き、発話の音声キャッシュを生成しつつ
//   プレビューできる。
// - `npm run render -- out/<slug>.mp4` でレンダリング (先に音声キャッシュの
//   生成が走る)。
//
// 正本: README「timeline.ts の書き方」「発話」、
// docs/adr/0006-write-timeline-as-effects-dsl.md (DSL の形)、
// docs/adr/0009-add-transition-frame-and-anchor-to-timeline.md
// (遷移・frame()・アンカー)、
// docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md
// (発話の仕組み)。

import { staticFile } from "remotion";
import {
  annotation,
  chapterTitle,
  ending,
  photoShowcase,
  thumbnail,
  video,
} from "../../src/components/index.tsx";
import { line, narration } from "../../src/compositions/narration.ts";
import {
  crossfade,
  cut,
  end,
  fade,
  frame,
  start,
  timeline,
} from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  endingTiming,
  openingTiming,
} from "../../src/theme/timing.ts";
import { narrator } from "../../src/theme/voice.ts";

const asset = (path: string) => staticFile(`projects/00000000-sample/${path}`);

const src = asset("VID_20260802_074903_00_287_359_DASHCAM1.mp4");

// 走行映像は同じ素材を trimBefore (元動画の頭を捨てる秒数) だけ変えて 2 本に
// 割り、間に crossfade() を挟んでいる。cut()/fade() が返す item は変数に
// 取っておくと、他の layer から start()/end() でその item の開始・終端を
// 参照できる (下の写真紹介・ED・黒地で使っている)。
const clipA = cut(video({ src, trimBefore: 0 }), { duration: 20 });
const clipB = cut(video({ src, trimBefore: 16 }), { duration: 18 });

// 発話 2 本目の声質の差分。theme の narrator (既定話者) を丸ごと変えず、
// 差分だけをファイル内の const として持てる (ADR-0010)。
const calm = { ...narrator, speed: 0.9 };

export default timeline([
  [
    // layer 0: 走行映像。crossfade({ duration }) は layer 内の item と item
    // の間にだけ置ける (置く前後の item は cut()/fade() で変数に取っておく
    // こと)。直後の item (clipB) の開始は「直前の item (clipA) の終端 −
    // duration」に固定され、その区間で clipB の opacity が 0 から 1 へ
    // 上がる。
    clipA,
    crossfade({ duration: 0.4 }),
    clipB,
  ],
  [
    // layer 1: OP → 章タイトル → 写真紹介 → ED。位置指定の 3 通り
    // (省略・after・at) がここに揃っている。
    //
    // OP (サムネと同じ絵)。位置を省略すると同じ layer の直前の item の
    // 終端に連結する (最初の item は 0 秒から)。黒からの立ち上がりは
    // layer 3 の frame() が行うので、ここでは in を付けない。
    fade(
      thumbnail({
        photo: asset("photos/photo-03.jpg"),
        badge: "#0 福島 / 磐梯吾妻スカイライン",
        title: "浄土平まで\n走ってきた",
        character: staticFile("assets/characters/4.png"),
      }),
      { duration: openingTiming.duration },
    ),
    // 章タイトル。after は直前の item (OP) の終端からの相対秒。
    fade(chapterTitle({ title: "浄土平へ", subtitle: "CHAPTER 1" }), {
      after: 0.2,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    // 写真紹介 (1〜2 枚)。at に start(item, offset?) で「clipB の開始の
    // 1 秒後」を渡している。offset は開始からの相対秒 (負も可)。
    cut(
      photoShowcase({
        photos: [asset("photos/photo-01.jpg"), asset("photos/photo-02.jpg")],
      }),
      { at: start(clipB, 1), duration: 5 },
    ),
    // ED。at に end(item, offset?) で「clipB の終端の endingTiming.duration
    // 秒前」を渡し、走行映像の終わりにちょうど合わせている。カットイン
    // (フェード無し) なので cut() を使う。
    cut(
      ending({
        title: "浄土平まで走ってきた",
        subtitle: "EP.0 / 福島",
        date: {
          from: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
        },
        distance: 42.3,
        ridingTime: Temporal.Duration.from({ hours: 1, minutes: 18 }),
        routes: ["福島市", "磐梯吾妻スカイライン", "浄土平"],
        credits: [{ VOICEVOX: "青山龍星" }, { 立ち絵: "Jacca さま" }],
      }),
      {
        at: end(clipB, -endingTiming.duration),
        duration: endingTiming.duration,
      },
    ),
  ],
  [
    // layer 2: 注釈。右端に縦書きで出る補足。text の \n で列を分ける (この
    // 例は 2 列)。位置は絶対秒 (at)。
    cut(
      annotation({
        text: "磐梯吾妻スカイラインは11月中旬から冬季閉鎖\n（概要欄にリンク）",
      }),
      { at: 14, duration: 5 },
    ),
  ],
  [
    // layer 3: 下の layer (0〜2) の合成結果を黒から立ち上げ、終端で黒へ
    // 落とす。frame() は fade() の node にだけ渡せ (cut() や layer 0 には
    // 置けない)、それより下の layer の合成結果にフェードをかける。
    // end(clipB, -2) は「clipB の終端の 2 秒前」。
    fade(frame(), {
      duration: openingTiming.fadeIn,
      in: openingTiming.fadeIn,
    }),
    fade(frame(), { at: end(clipB, -2), duration: 2, out: 2 }),
  ],
  // layer 4・5: 発話。narration() が [暗がり layer, 発話 layer] の 2 layer
  // を返す。配列の最後に置くと、この 2 layer は他のどの layer よりも上に
  // 重なる (「配列の後ろが上」)。章タイトルの表示中 (〜7.4 秒) と重ならない
  // よう、最初の発話を 8 秒以降に置いている。写真紹介・ED の表示中に発話が
  // 重なっても構わない (この配置では字幕・暗がりが写真紹介・ED より上に
  // 重なって見える。重なる/重ならないも layer の順で決まる例)。
  //
  // text は文字列リテラルで書くこと (watcher が timeline.ts を静的に読む。
  // 変数や関数呼び出しは使えない)。voice に書けるのはリテラル・spread・
  // 同じファイルの const・theme からの import に限る。voice の 8 値:
  // speaker (VOICEVOX のスタイル id)、speed・intonation・volume・pause は
  // 倍率で 1 が中立、pitch はオフセットで 0 が中立、silenceBefore・
  // silenceAfter は秒。音声は public/projects/<slug>/lines/<key>.{wav,json}
  // にキャッシュされ、コミットしない。text か voice を変えると別の key に
  // なり再生成される。
  //
  // 1 本目: voice を省略すると theme の narrator (既定話者) になる。
  // {漢字|よみ} で読みを添えられる。at は絶対秒。
  //
  // 2 本目: voice にファイル内の const (calm、theme の narrator の差分) を
  // 渡している。after は「前の発話の音声の終わりからの間隔 (秒)」。
  //
  // 3 本目: duration を明示すると、位置決め・字幕の尺の両方にその値を
  // そのまま使う (音声の実尺では上書きしない)。字幕を長めに出したいときに
  // 使う。暗がりは字幕が消えるまで出る (duration を明示していれば、その分
  // 長く出る)。
  ...(await narration([
    cut(
      line({
        text: "{磐梯吾妻|ばんだいあづま}スカイラインを登って、{浄土平|じょうどだいら}へ向かう。",
      }),
      { at: 8 },
    ),
    cut(
      line({
        text: "今日は雲が多いけど、風は無くて走りやすい。",
        voice: calm,
      }),
      { after: 0.5 },
    ),
    cut(
      line({
        text: "{浄土平|じょうどだいら}の展望台に着いた。少し休憩していこう。",
      }),
      { after: 1, duration: 4 },
    ),
  ])),
]);
