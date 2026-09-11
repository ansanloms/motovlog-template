// キャラクター「龍星」の立ち絵定義 (ADR-0011)。character() が返す値を
// timeline.ts の line() の by、figure() の第 1 引数にそのまま渡す (identity
// が結び付けの唯一の手段)。
//
// レイヤーの重ね順 (下から上) は PSD のグループ順に合わせている: 体 → 腕 →
// 顔色効果 (汗・涙等) → 口 → 目 → 眉 → 小物。表情ごとにこの順で
// expressions に並べる。
//
// PNG は同一キャンバスの書き出しとし、public/assets/characters/ryusei/ に
// 置く (座標はどのレイヤーも共通で、figure() は座標計算をしない)。素材の
// 切り出し (PSD からの書き出し) はこのテンプレートの外で行う
// (psd-tools 等)。第三者の立ち絵素材は公開リポジトリにコミットしない
// ([ADR-0002](../docs/adr/0002-project-directory-layout.md))。
//
// voice はこのキャラクターの既定の声質で、line() 自身の voice がこれを
// 上書きする (src/voice/key.ts の mergeVoice())。
//
// このファイルは Node からそのまま import できる純粋な値のモジュールに
// 保つこと (remotion・CSS・src/components は import しない。
// scripts/voice/extract.ts の watcher が line().by から voice だけを
// 読むため)。

import { character } from "../src/compositions/character.ts";
import { narrator } from "../theme/index.ts";

const dir = "assets/characters/ryusei";
const part = (name: string) => `${dir}/${name}.png`;

const body = part("body");

const eyes = {
  eyes: { open: part("eyes-open"), closed: part("eyes-closed") },
};

const mouth = {
  mouth: {
    a: part("mouth-a"),
    i: part("mouth-i"),
    u: part("mouth-u"),
    e: part("mouth-e"),
    o: part("mouth-o"),
    n: part("mouth-n"),
  },
};

const arms = {
  down: part("arms-down"),
  crossed: part("arms-crossed"),
  explain: part("arms-explain"),
  scratch: part("arms-scratch"),
};

const brows = {
  normal: part("brows-normal"),
  angry: part("brows-angry"),
  troubled: part("brows-troubled"),
  down: part("brows-down"),
  up: part("brows-up"),
};

const fx = {
  sweat: part("fx-sweat"),
  tearStream: part("fx-tear-stream"),
};

const opt = {
  pen: part("opt-pen"),
  tears: part("opt-tears"),
  cry: part("opt-cry"),
  glasses: part("opt-glasses"),
};

export const ryusei = character({
  voice: narrator,
  expressions: {
    normal: [body, arms.down, mouth, eyes, brows.normal, opt.pen],
    sweat: [body, arms.scratch, fx.sweat, mouth, eyes, brows.troubled, opt.pen],
    tears: [body, arms.down, mouth, eyes, brows.down, opt.pen, opt.tears],
    cry: [
      body,
      arms.down,
      fx.tearStream,
      part("mouth-endure"),
      part("eyes-closed3"),
      brows.troubled,
      opt.cry,
    ],
    teach: [body, arms.explain, mouth, eyes, brows.up, opt.pen, opt.glasses],
    armsCrossed: [body, arms.crossed, mouth, eyes, brows.angry, opt.pen],
  },
});
