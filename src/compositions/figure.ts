// timeline.ts が立ち絵 (目パチ・口パク・表情) を書くための DSL (ADR-0011)。
//
// 書き手は figure(character, { expression?, speech, side? }) を cut()/fade()
// の node に渡す。character は characters/<name>.ts の character() の戻り値
// (line() の by に渡したのと同じ参照)、speech は narration() の戻り値の
// `speech` (発話ごとの絶対開始秒・実尺・口パクデータ・by・expression)。
// side は枠を置く側 (既定 left、right は章の区切りのみ)。figure() は speech
// のうち by が自分の character と同一のものだけを使う。
// figure() は sample() (src/effects) で包んだ SampleNode を返し、Stage が
// 毎フレーム render を呼んで目・口・表情の絵を選び直す。narration.ts と
// 同じく effects と components の両方を import できる層 (compositions) に
// 置く。
//
// figureLayers(character, expression?) は静止画 (サムネイル等) 用の入口。
// 目パチ・口パクをせず、開眼・無音の口で固定したレイヤー列 (staticFile()
// 済み URL) を返す。

import { createElement } from "react";
import { staticFile } from "remotion";
import { Figure } from "../components/Figure.tsx";
import { sample } from "../effects/index.ts";
import type { SampleNode } from "../effects/index.ts";
import { characterTiming } from "../theme/index.ts";
import { fps } from "../theme/timing.ts";
import type { LipsyncEntry } from "../voice/cache.ts";
import { isEyesLayer, isMouthLayer } from "./character.ts";
import type { Character, FigureLayer, MouthKey } from "./character.ts";
import type { Speech } from "./narration.ts";

export type { MouthKey } from "./character.ts";

const isMouthVowel = (value: string): value is Exclude<MouthKey, "n"> =>
  value === "a" ||
  value === "i" ||
  value === "u" ||
  value === "e" ||
  value === "o";

/**
 * lipsync の vowel を MouthKey に直接マップできる場合はその値、できない
 * 場合 (cl 等) は undefined を返す。"N"・"pau" (無音・撥音) は "n" に畳む。
 */
const mouthKeyOfVowel = (vowel: string): MouthKey | undefined => {
  if (isMouthVowel(vowel)) {
    return vowel;
  }

  if (vowel === "N" || vowel === "pau") {
    return "n";
  }

  return undefined;
};

/**
 * beforeIndex より前の entries を遡り、直接マップできる最初の vowel の
 * MouthKey を返す ("cl" (促音の無音区間) は自身の口の形を持たず、直前の
 * 口の形を維持するため)。見つからなければ "n"。
 */
const previousMouthKey = (
  entries: readonly LipsyncEntry[],
  beforeIndex: number,
): MouthKey => {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const key = mouthKeyOfVowel(entries[i].vowel);

    if (key !== undefined) {
      return key;
    }
  }

  return "n";
};

/** entries[index] の MouthKey を返す。直接マップできなければ前を遡る。 */
const mouthKeyAt = (
  entries: readonly LipsyncEntry[],
  index: number,
): MouthKey => {
  const key = mouthKeyOfVowel(entries[index].vowel);

  return key ?? previousMouthKey(entries, index);
};

/**
 * 発話 1 本の開始からの秒 (local) から MouthKey を求める。entries は開始秒
 * 昇順であることを前提に、末尾から遡って `start <= local` な最初の entry
 * (= 最後にその時点までに始まった entry) を見つけたら即座に打ち切る (#8)。
 * その entry を local が含んでいれば (`local < entry.end`) その形、含んで
 * いなければ (子音の隙間・最後の entry より後) その entry の形を維持する
 * (mouthKeyAt() が直接マップできない vowel ("cl" 等) の場合はさらに遡る)。
 * どの entry の start も local を超える (= 最初の entry より前) なら "n"。
 */
const mouthFromLocal = (
  entries: readonly LipsyncEntry[],
  local: number,
): MouthKey => {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].start <= local) {
      return mouthKeyAt(entries, i);
    }
  }

  return "n";
};

/**
 * 絶対秒から口形 (MouthKey) を引く純粋関数。発話を含むかどうかの判定は
 * expressionAt() と同じくフレームグリッド上で行う (#21)。s.at・s.duration
 * (narration() が積み上げた生の秒数) と absolute (Stage がフレーム番号から
 * 作る、frame/fps のグリッドに乗った値) をそれぞれ Math.round(x * fps) で
 * フレーム単位に丸め、`startFrame <= nowFrame < endFrame` で判定する。秒の
 * まま比較すると、at がフレーム境界のわずかに後にある発話で、音声の
 * Sequence (フレームグリッド基準) より口パクの開始が 1 フレーム遅れる
 * ことがあったため。含む発話が複数あれば at が最大 (最後に始まった)
 * ものを使い、無ければ "n"。見つかれば発話開始からの秒 (local = absolute -
 * s.at、フレームには丸めない) で mouthFromLocal() を引く。local はグリッド
 * 丸めの都合でフレーム先頭ではわずかに負になることがあり、その場合
 * mouthFromLocal() は「最初の entry より前」と同じ経路で "n" を返すが、
 * 発話の最初の一瞬 (通常は無音) なので実害はない。発話が重なる場面
 * (次の発話が前の発話の途中で始まる) では後から始まった方を優先する
 * (#3)。speech は figure() が呼び出し側の character 宛に絞り込んだ後の列。
 */
export const mouthAt = (
  absolute: number,
  speech: readonly Speech[],
): MouthKey => {
  let current: Speech | undefined;
  const nowFrame = Math.round(absolute * fps);

  for (const s of speech) {
    const startFrame = Math.round(s.at * fps);
    const endFrame = Math.round((s.at + s.duration) * fps);

    if (
      startFrame <= nowFrame &&
      nowFrame < endFrame &&
      (!current || s.at > current.at)
    ) {
      current = s;
    }
  }

  if (!current) {
    return "n";
  }

  return mouthFromLocal(current.lipsync, absolute - current.at);
};

/**
 * 絶対秒から表情名を引く純粋関数。initial (item の expression、省略時は
 * expressions の最初のキー) を初期値とし、itemStart (item の開始の絶対秒)
 * 以降かつ absolute までに始まった (`itemStart <= s.at <= absolute`) 自分宛の
 * 発話のうち expression を持つ最後のものがあればその表情にする (次の指定
 * まで維持し、item を分ければその item の初期値に戻る、ADR-0011)。speech
 * は渡した順 (narration() の出力順) を前提に末尾から遡り、最初に条件に合う
 * ものを返して打ち切る (#8。渡した順での「最後の一致」と同じ結果になる)。
 * speech は figure() が呼び出し側の character 宛に絞り込んだ後の列。
 * itemStart (= t.absolute - t.seconds) と absolute はどちらも Stage が
 * フレーム番号から作る値で frame/fps のグリッドに乗っている (itemStart の
 * 元になる from は round(at × fps)) が、s.at は narration() が積み上げた
 * 生の秒数でフレーム境界に乗るとは限らない (#14。例: item の分割位置を
 * speech の開始秒に合わせて書いた場合)。秒のまま比較すると frame に丸め
 * られた境界と生の秒がわずかにずれ、範囲の端でだけ判定を落とすちらつきが
 * 起きるため、s.at 側を Math.round(s.at * fps) でフレーム単位に丸めてから
 * 比較する (itemStart・absolute は元からこのグリッド上にあるので同じ
 * Math.round を掛けても値は変わらない)。
 */
export const expressionAt = (
  absolute: number,
  itemStart: number,
  initial: string,
  speech: readonly Speech[],
): string => {
  for (let i = speech.length - 1; i >= 0; i--) {
    const s = speech[i];
    const atFrame = Math.round(s.at * fps);

    if (
      atFrame >= Math.round(itemStart * fps) &&
      atFrame <= Math.round(absolute * fps) &&
      s.expression !== undefined
    ) {
      return s.expression;
    }
  }

  return initial;
};

/** isBlinking() が読む値 (characterTiming のうち目パチに使う分)。 */
type BlinkTiming = {
  readonly blinkInterval: number;
  readonly blinkClosed: number;
};

/**
 * 絶対秒 (動画先頭からの秒) から閉眼かどうかを返す純粋関数。item を
 * 分割しても位相が変わらないよう、item 内の秒ではなく絶対秒で判定する
 * (ADR-0011)。`(absolute mod blinkInterval) >= blinkInterval - blinkClosed`
 * で閉じる (周期の頭は開眼、末尾の blinkClosed 秒だけ閉じる)。
 */
export const isBlinking = (
  absolute: number,
  timing: BlinkTiming = characterTiming,
): boolean => {
  const phase = absolute % timing.blinkInterval;

  return phase >= timing.blinkInterval - timing.blinkClosed;
};

/**
 * expressions[expression] のレイヤー列を、現在の blinking・mouth の状態で
 * 実際の画像パス (下から上の順) に写す純粋関数。静止画 (文字列) はそのまま、
 * 目レイヤーは blinking で開閉を、口レイヤーは mouth で母音を選ぶ。layers は
 * public/ 相対のパスでも staticFile() 済みの URL でもよい (figure() は
 * レイヤーごとの staticFile() を先読みして毎フレームは選ぶだけにする、#8)。
 */
export const layerSources = (
  layers: readonly FigureLayer[],
  state: { readonly blinking: boolean; readonly mouth: MouthKey },
): readonly string[] =>
  layers.map((layer) => {
    if (isEyesLayer(layer)) {
      return state.blinking ? layer.eyes.closed : layer.eyes.open;
    }

    if (isMouthLayer(layer)) {
      return layer.mouth[state.mouth];
    }

    return layer;
  });

/** layer の画像パス (public/ 相対) を staticFile() 済みの URL に写す (#8)。 */
const resolveFigureLayer = (layer: FigureLayer): FigureLayer => {
  if (isEyesLayer(layer)) {
    return {
      eyes: {
        open: staticFile(layer.eyes.open),
        closed: staticFile(layer.eyes.closed),
      },
    };
  }

  if (isMouthLayer(layer)) {
    return {
      mouth: {
        a: staticFile(layer.mouth.a),
        i: staticFile(layer.mouth.i),
        u: staticFile(layer.mouth.u),
        e: staticFile(layer.mouth.e),
        o: staticFile(layer.mouth.o),
        n: staticFile(layer.mouth.n),
      },
    };
  }

  return staticFile(layer);
};

/**
 * expression 名を解決する。省略時は character.expressions の最初のキーを
 * 使う。character.expressions に無ければ throw する (`Object.hasOwn()` で
 * 検査し、"toString" 等の prototype のキーを通さない、#11)。throw
 * メッセージの接頭辞 (呼び出し元の関数名) には caller を使う。
 */
const resolveExpressionName = (
  character: Character,
  expression: string | undefined,
  caller: string,
): string => {
  const expressionNames = Object.keys(character.expressions);
  const initial = expression ?? expressionNames[0];

  if (!Object.hasOwn(character.expressions, initial)) {
    throw new Error(
      `${caller}(): character に無い表情 "${initial}" が指定されました`,
    );
  }

  return initial;
};

/**
 * 静止画 (サムネイル等) 用に、character の 1 つの表情のレイヤー列を
 * staticFile() 済みの URL 列に解決する純粋関数。figure() と違い目パチ・
 * 口パクをせず、開眼・無音の口 ("n") で固定する (ADR-0011)。expression は
 * character.expressions のキー (省略時は最初のキー)、無ければ throw する。
 */
export const figureLayers = (
  character: Character,
  expression?: string,
): readonly string[] => {
  const name = resolveExpressionName(character, expression, "figureLayers");
  const layers = character.expressions[name].map(resolveFigureLayer);

  return layerSources(layers, { blinking: false, mouth: "n" });
};

/**
 * 立ち絵の SampleNode を組み立てる。cut()/fade() の node に渡すこと。
 * expression は初期の表情名 (省略時は expressions の最初のキー)。
 * expressions に無ければ throw する (`Object.hasOwn()` で検査し、
 * "toString" 等の prototype のキーを通さない、#11)。speech は narration() の
 * 戻り値の speech をそのまま渡してよい (このキャラクター宛以外は figure()
 * が無視する)。表情ごとの画像パスは呼び出し時に 1 度だけ staticFile() を
 * 掛けておき (resolveFigureLayer())、Stage が毎フレーム呼ぶ render は、
 * 動画先頭からの絶対秒 (absolute) と item の開始の絶対秒 (itemStart =
 * absolute - seconds) で目パチ (isBlinking())・口パク (mouthAt())・表情
 * (expressionAt()) を選び、layerSources() で選んだ URL を Figure に固定
 * props (layers) として渡すだけにする。
 */
export const figure = (
  character: Character,
  options: {
    readonly expression?: string;
    readonly speech: readonly Speech[];
    readonly side?: "left" | "right";
  },
): SampleNode => {
  const initial = resolveExpressionName(
    character,
    options.expression,
    "figure",
  );

  const ownSpeech = options.speech.filter((s) => s.by === character);

  const resolvedExpressions: Record<string, readonly FigureLayer[]> =
    Object.fromEntries(
      Object.entries(character.expressions).map(([name, layers]) => [
        name,
        layers.map(resolveFigureLayer),
      ]),
    );

  return sample((t) => {
    const itemStart = t.absolute - t.seconds;
    const blinking = isBlinking(t.absolute);
    const mouth = mouthAt(t.absolute, ownSpeech);
    const expression = expressionAt(t.absolute, itemStart, initial, ownSpeech);
    const layers = resolvedExpressions[expression];
    const sources = layerSources(layers, { blinking, mouth });

    return createElement(Figure, { layers: sources, side: options.side });
  });
};
