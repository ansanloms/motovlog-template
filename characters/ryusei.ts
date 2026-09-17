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

import {
  character,
  type MouthLayer,
  type EyesLayer,
  type FigureLayer,
} from "../src/compositions/character.ts";
import { narrator } from "../theme/index.ts";

const dir = "assets/characters/ryusei";
const part = (name: string) => `${dir}/${name}.png`;

const body = { normal: part("body") };
const mouth = {
  normal: {
    mouth: {
      a: part("mouth-a"),
      i: part("mouth-i"),
      u: part("mouth-u"),
      e: part("mouth-e"),
      o: part("mouth-o"),
      n: part("mouth-n"),
    },
  },
  smile: {
    mouth: {
      a: part("mouth-a"),
      i: part("mouth-i"),
      u: part("mouth-u"),
      e: part("mouth-e"),
      o: part("mouth-o"),
      n: part("mouth-smile"),
    },
  },
};
const arms = {
  down: part("arms-down"),
  crossed: part("arms-crossed"),
  explain: part("arms-explain"),
  scratch: part("arms-scratch"),
};
const eyes = {
  normal: { eyes: { open: part("eyes-open"), closed: part("eyes-closed3") } },
  up: { eyes: { open: part("eyes-up"), closed: part("eyes-closed3") } },
  down: { eyes: { open: part("eyes-down"), closed: part("eyes-closed3") } },
  downAway: {
    eyes: { open: part("eyes-down-away"), closed: part("eyes-closed3") },
  },
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
  sweatBig: part("fx-sweat-big"),
  blush: part("fx-blush"),
  tearStream: part("fx-tear-stream"),
  tearMarks: part("fx-tear-marks"),
  noseRed: part("fx-nose-red"),
  gloom: part("fx-gloom"),
  pale: part("fx-pale"),
  cheekLines: part("fx-cheek-lines"),
};
const opts = {
  pen: part("opt-pen"),
  tears: part("opt-tears"),
  cry: part("opt-cry"),
  glasses: part("opt-glasses"),
};

type Expression = {
  body: string;
  arms: string;
  fx?: string[];
  mouth: MouthLayer;
  eyes: EyesLayer;
  brows: string;
  opts?: string[];
};

const expressionBase: Expression = {
  body: body.normal,
  arms: arms.down,
  fx: [fx.noseRed],
  mouth: mouth.normal,
  eyes: eyes.up,
  brows: brows.normal,
  opts: [opts.pen],
};

const getFigureLayer = (expression: Expression): FigureLayer[] => {
  const { body, arms, fx, mouth, eyes, brows, opts } = expression;
  return [body, arms, ...(fx ?? []), mouth, eyes, brows, ...(opts ?? [])];
};

export const ryusei = character({
  voice: narrator,
  expressions: {
    /**
     * 標準。
     */
    normal: getFigureLayer({
      ...expressionBase,
    }),

    /**
     * 怒り。
     */
    angry: getFigureLayer({
      ...expressionBase,
      brows: brows.angry,
    }),

    /**
     * 頬を掻く。
     */
    scratch: getFigureLayer({
      ...expressionBase,
      arms: arms.scratch,
    }),

    /**
     * 汗。
     */
    sweat: getFigureLayer({
      ...expressionBase,
      fx: [fx.sweat],
    }),

    /**
     * 汗。
     */
    sweatBig: getFigureLayer({
      ...expressionBase,
      fx: [fx.sweatBig],
    }),

    /**
     * 涙。
     */
    tears: getFigureLayer({
      ...expressionBase,
      opts: [...(expressionBase.opts ?? []), opts.tears],
    }),

    /**
     * 泣。
     */
    cry: getFigureLayer({
      ...expressionBase,
      opts: [...(expressionBase.opts ?? []), opts.cry],
    }),

    /**
     * 青ざめ。
     */
    pale: getFigureLayer({
      ...expressionBase,
      fx: [...(expressionBase.fx ?? []), fx.pale],
    }),

    /**
     * 青ざめと汗。
     */
    paleAndSweat: getFigureLayer({
      ...expressionBase,
      fx: [...(expressionBase.fx ?? []), fx.pale, fx.sweat],
    }),

    /**
     * 青ざめと大汗。
     */
    paleAndSweatBig: getFigureLayer({
      ...expressionBase,
      fx: [...(expressionBase.fx ?? []), fx.pale, fx.sweatBig],
    }),

    /**
     * 照れ。
     */
    shyness: getFigureLayer({
      ...expressionBase,
      fx: [...(expressionBase.fx ?? []), fx.blush, fx.cheekLines],
    }),

    /**
     * 照れ、頬を掻き右下をみる。
     */
    shynessAndScratchAndEyesdownAway: getFigureLayer({
      ...expressionBase,
      arms: arms.scratch,
      eyes: eyes.downAway,
      fx: [...(expressionBase.fx ?? []), fx.blush, fx.cheekLines],
    }),

    //teach: [
    //  body,
    //  arms.explain,
    //  mouth,
    //  eyes.normal,
    //  brows.up,
    //  opt.pen,
    //  opt.glasses,
    //],
    //armsCrossed: [body, arms.crossed, mouth, eyes.normal, brows.angry, opt.pen],
  },
});
