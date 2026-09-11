// このファイルは新しい project の出発点として「コピーして直す」ためのサンプル。
// 走行映像 1 本・立ち絵・OP・章タイトル・写真紹介・ED・BGM・注釈・発話
// (3 パターン) の一通りの要素を、実際に動く形で並べている。仕様の正本は
// README (「timeline.ts の書き方」「発話」) と ADR で、ここのコメントは
// 仕様の丸写しではなく「ここをこう変えるとこうなる」を書く。
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
import { sampleCharacter } from "../../characters/sample.ts";
import {
  annotation,
  audio,
  chapterTitle,
  ending,
  photoShowcase,
  video,
} from "../../src/components/index.tsx";
import {
  figure,
  line,
  narration,
  thumbnail,
} from "../../src/compositions/index.ts";
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
} from "../../src/theme/index.ts";
import { narrator } from "../../theme/index.ts";

const asset = (path: string) => staticFile(`projects/00000000-sample/${path}`);

const src = asset("VID_20260802_074903_00_287_359_DASHCAM1.mp4");

const clipASec = 20;
const clipBSec = 18;
const crossfadeSec = 0.4;
const endingFadeSec = 2; // layer 5 の黒落ちと走行音・BGM のフェードアウトの秒数

// 走行映像は同じ素材を trimBefore (元動画の頭を捨てる秒数) だけ変えて 2 本に
// 割り、間に crossfade() を挟んでいる。cut()/fade() が返す item は変数に
// 取っておくと、他の layer から start()/end() でその item の開始・終端を
// 参照できる (下の写真紹介・ED・黒地で使っている)。
//
// volume は要素の再生開始 (trimBefore 適用後) からの秒を at に持つ折れ線。
// fade()・crossfade()・frame() は絵 (不透明度) にだけ効いて音には効かない
// ので、走行音のフェードはここで書く。clipA の頭は layer 5 の黒からの
// 立ち上がり (openingTiming.fadeIn) と、clipA の末尾と clipB の頭は
// crossfade の重なり (crossfadeSec) と、clipB の末尾は layer 5 の黒落ち
// (endingFadeSec) と、それぞれ同じ秒数にして絵と音を揃えている。一定値
// なら `volume: 0.5` のように数値で書く。
const clipA = cut(
  video({
    src,
    trimBefore: 0,
    volume: [
      { at: 0, volume: 0 },
      { at: openingTiming.fadeIn, volume: 1 },
      { at: clipASec - crossfadeSec, volume: 1 },
      { at: clipASec, volume: 0 },
    ],
  }),
  { duration: clipASec },
);
const clipB = cut(
  video({
    src,
    trimBefore: 16,
    volume: [
      { at: 0, volume: 0 },
      { at: crossfadeSec, volume: 1 },
      { at: clipBSec - endingFadeSec, volume: 1 },
      { at: clipBSec, volume: 0 },
    ],
  }),
  { duration: clipBSec },
);

// 発話 2 本目の声質の差分。theme の narrator (既定話者) を丸ごと変えず、
// 差分だけをファイル内の const として持てる (ADR-0010)。
const calm = { ...narrator, speed: 0.9 };

// 発話を先に解決する。n.speech (発話ごとの絶対開始秒・実尺・口パクの母音
// 区間・by・expression) を立ち絵の口パク・表情に使うため、timeline() より
// 前に await する (ADR-0011)。narration() は
// { layers: [暗がり layer, 発話 layer], speech } を返す。
//
// text は文字列リテラルで書くこと (watcher が timeline.ts を静的に読む。
// 変数や関数呼び出しは使えない)。voice に書けるのはリテラル・spread・
// 同じファイルの const・theme からの import に限る。voice の 8 値:
// speaker (VOICEVOX のスタイル id)、speed・intonation・volume・pause は
// 倍率で 1 が中立、pitch はオフセットで 0 が中立、silenceBefore・
// silenceAfter は秒。音声は public/projects/<slug>/lines/<key>.{wav,json}
// にキャッシュされ、コミットしない。text か実効の voice (下記) を変えると
// 別の key になり再生成される。
//
// by はキャラクター (characters/sample.ts の character() の戻り値)。
// 実効の声質は theme の narrator ← by.voice ← line() 自身の voice の順で
// 上書きした値になる (watcher と narration() の両方が同じ関数
// (mergeVoice()) で合成するため、生成される音声キャッシュの key は一致する)。
//
// 1 本目: voice を省略すると by.voice (sampleCharacter では theme の narrator) の
// ままになる。{漢字|よみ} で読みを添えられる。at は絶対秒。
//
// 2 本目: voice にファイル内の const (calm、theme の narrator の差分) を
// 渡し、by.voice を上書きしている。after は「前の発話の音声の終わりからの
// 間隔 (秒)」。expression: "sweat" で、この発話の開始と同時に立ち絵の表情が
// 汗顔に変わる (次に expression を指定する発話まで維持する)。
//
// 3 本目: duration を明示すると、位置決め・字幕の尺の両方にその値を
// そのまま使う (音声の実尺では上書きしない)。字幕を長めに出したいときに
// 使う。暗がりは字幕が消えるまで出る (duration を明示していれば、その分
// 長く出る)。時間は timeline() の他の演出と同じくすべて秒で書くため、
// duration もフレーム数ではなく秒の数値。expression: "teach" でここから
// 教える表情になる。発話と無関係に表情を変えたい・立ち絵を隠したいときは、
// layer 2 (立ち絵) の item を分けて書く (expression オプションや、別の
// duration の cut() を並べる。ADR-0011)。
const n = await narration([
  cut(
    line({
      text: "{磐梯吾妻|ばんだいあづま}スカイラインを登って、\n{浄土平|じょうどだいら}へ向かう。",
      by: sampleCharacter,
    }),
    { at: 8 },
  ),
  cut(
    line({
      text: "今日は雲が多いけど、\n風は無くて走りやすい。",
      by: sampleCharacter,
      voice: calm,
      expression: "sweat",
    }),
    { after: 0.5 },
  ),
  cut(
    line({
      text: "{浄土平|じょうどだいら}の展望台に着いた。\n少し休憩していこう。",
      by: sampleCharacter,
      expression: "teach",
    }),
    { after: 1, duration: 4 },
  ),
]);

// 立ち絵 (layer 2) の表示区間。OP → (0.2 秒) → 章タイトルが終わるまでは
// 消しておき (点滅を避けるため、間の 0.2 秒も出さない)、ED が始まる直前
// (clipB の終端 − endingTiming.duration) で消す (T&M「画面配置」)。
const figureFromSec = openingTiming.duration + 0.2 + chapterTitleDurationSec;
const figureUntilSec =
  clipASec + clipBSec - crossfadeSec - endingTiming.duration;

export default timeline([
  [
    // layer 0: 走行映像。crossfade({ duration }) は layer 内の item と item
    // の間にだけ置ける (置く前後の item は cut()/fade() で変数に取っておく
    // こと)。直後の item (clipB) の開始は「直前の item (clipA) の終端 −
    // duration」に固定され、その区間で clipB の opacity が 0 から 1 へ
    // 上がる。
    clipA,
    crossfade({ duration: crossfadeSec }),
    clipB,
  ],
  [
    // layer 1: OP → 章タイトル → 写真紹介 → ED。位置指定の 3 通り
    // (省略・after・at) がここに揃っている。
    //
    // OP (サムネと同じ絵)。位置を省略すると同じ layer の直前の item の
    // 終端に連結する (最初の item は 0 秒から)。黒からの立ち上がりは
    // layer 5 の frame() が行うので、ここでは in を付けない。
    fade(
      thumbnail({
        photo: asset("photos/photo-03.jpg"),
        badge: "#0 福島 / 磐梯吾妻スカイライン",
        title: "浄土平まで\n走ってきた",
        character: sampleCharacter,
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
    // 1 秒後」を渡している。offset は開始からの相対秒 (負も可)。1 つ上の
    // layer 2 の立ち絵より後ろに描かれる (T&M「写真紹介」)。
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
        credits: [{ VOICEVOX: "青山龍星" }],
      }),
      {
        at: end(clipB, -endingTiming.duration),
        duration: endingTiming.duration,
      },
    ),
  ],
  [
    // layer 2: 立ち絵 (ADR-0011)。sampleCharacter は characters/sample.ts の
    // character()。figure() は n.speech (上で解決済みの narration() の
    // 結果) のうち by が sampleCharacter と同じ参照の発話だけを見て、目パチ・口パク・
    // 表情を sample() で毎フレーム選び直す。1 つ下の layer 1 (OP・章タイトル・
    // 写真紹介・ED) より上に置き、写真は立ち絵の後ろに出す
    // (T&M「写真紹介」「画面配置」)。
    // OP・章タイトル・ED の間は立ち絵を消す (T&M「画面配置」)。消すのは
    // 上の layer で覆うのではなく item の区間を分けて空ける (ADR-0011)。
    // ここでは章タイトルの終わり (figureFromSec) から ED の始まり
    // (figureUntilSec) までの 1 item にしている。出入りは 0.2 秒のフェード
    // (T&M「出入りのタイミング」)。cut()/fade() の duration にはまだ
    // start()/end() のようなアンカーを渡せない (ADR-0009 は at だけが
    // アンカーに対応) ため秒の数値で書く。
    fade(figure(sampleCharacter, { speech: n.speech }), {
      at: figureFromSec,
      duration: figureUntilSec - figureFromSec,
      in: 0.2,
      out: 0.2,
    }),
  ],
  [
    // layer 3: 注釈。右上に横書きで出る補足。text の \n で改行する (最大
    // 2 行)。位置は絶対秒 (at)。
    cut(
      annotation({
        text: "磐梯吾妻スカイラインは11月中旬から冬季閉鎖\n（概要欄にリンク）",
      }),
      { at: 14, duration: 5 },
    ),
  ],
  [
    // layer 4: BGM。audio() は音だけの要素で、絵は持たない。loop で素材を
    // 繰り返し、volume の折れ線で走行音の下に薄く (0.2) 敷いて、末尾は
    // 走行音・黒落ちと同じ endingFadeSec 秒でフェードアウトする。loop 時も
    // at は周回をまたいだ通算秒なので、素材の長さより長い区間でも末尾の
    // フェードは区間の終わりに効く。区間は写真紹介と同じく start() で
    // 走行映像に合わせている。
    cut(
      audio({
        src: staticFile("assets/bgm/m1.wav"),
        loop: true,
        volume: [
          { at: 0, volume: 0.2 },
          { at: clipBSec - endingFadeSec, volume: 0.2 },
          { at: clipBSec, volume: 0 },
        ],
      }),
      { at: start(clipB), duration: clipBSec },
    ),
  ],
  [
    // layer 5: 下の layer (0〜4) の合成結果を黒から立ち上げ、終端で黒へ
    // 落とす。frame() は fade() の node にだけ渡せ (cut() や layer 0 には
    // 置けない)、それより下の layer の合成結果にフェードをかける。
    // end(clipB, -endingFadeSec) は「clipB の終端の endingFadeSec 秒前」。
    fade(frame(), {
      duration: openingTiming.fadeIn,
      in: openingTiming.fadeIn,
    }),
    fade(frame(), {
      at: end(clipB, -endingFadeSec),
      duration: endingFadeSec,
      out: endingFadeSec,
    }),
  ],
  // layer 6・7: 発話。n.layers ([暗がり layer, 発話 layer]、上で解決済みの
  // narration() の結果) を配列の最後に置くと、この 2 layer は他のどの
  // layer よりも上に重なる (「配列の後ろが上」)。章タイトルの表示中
  // (〜7.4 秒) と重ならないよう、最初の発話を 8 秒以降に置いている
  // (narration() への入力は上で定義した n を参照)。写真紹介・ED の表示中に
  // 発話が重なっても構わない (この配置では字幕・暗がりが写真紹介・ED より
  // 上に重なって見える。重なる/重ならないも layer の順で決まる例)。
  ...n.layers,
]);
