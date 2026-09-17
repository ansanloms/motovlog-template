// timeline.ts が立ち絵 (目パチ・口パク・表情) を書くための DSL (ADR-0011,
// ADR-0014)。
//
// 書き手は narration() の入力配列に figure(character, { side?, in?, out?,
// lead?, tail?, expression? }, items) の戻り値 (FigureGroup、発話の行の
// 括り) を item と混ぜて置く。narration() が括りごとに立ち絵の item を 1 つ
// 組み立て、立ち絵 layer に置く (ADR-0014)。character は characters/<name>.ts
// の character() の戻り値 (line() の by に渡したのと同じ参照)。
//
// 立ち絵の実体 (SampleNode) を組み立てるのは figureNode() で、narration()
// だけが呼ぶ (ADR-0014 の禁止事項により、この関数は compositions/index.ts
// からは公開しない)。sample() (src/effects) で包んだ SampleNode を返し、
// Stage が毎フレーム render を呼んで目・口・表情の絵を選び直す。narration.ts
// と同じく effects と components の両方を import できる層 (compositions) に
// 置く。
//
// figureLayers(character, expression?) は静止画 (サムネイル等) 用の入口。
// 目パチ・口パクをせず、開眼・無音の口で固定したレイヤー列 (staticFile()
// 済み URL) を返す。

import { createElement } from "react";
import { staticFile } from "remotion";
import { Figure } from "../components/Figure.tsx";
import { sample, toFrame } from "../effects/index.ts";
import type { SampleNode } from "../effects/index.ts";
import { characterTiming } from "../theme/index.ts";
import { fps } from "../theme/timing.ts";
import type { LipsyncEntry } from "../voice/cache.ts";
import { isEyesLayer, isMouthLayer } from "./character.ts";
import type { Character, FigureLayer, MouthKey } from "./character.ts";
import type { NarrationItem, Speech } from "./narration.ts";

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
 * 作る、frame/fps のグリッドに乗った値) をそれぞれ toFrame() (src/effects) で
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
  const nowFrame = toFrame(absolute, fps);

  for (const s of speech) {
    const startFrame = toFrame(s.at, fps);
    const endFrame = toFrame(s.at + s.duration, fps);

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
 * 絶対秒から表情名を引く純粋関数。initial (item の expression が明示され
 * ていればその値、省略されていれば expressions の最初のキー) を初期値と
 * し、absolute までに始まった (`toFrame(s.at) <= toFrame(absolute)`) 自分宛
 * の発話のうち expression を持つ最後のものがあればその表情にする (次の
 * 指定まで維持する)。explicit (item の expression が明示されたか) が
 * true の場合のみ、itemStart (item の開始の絶対秒) より前に始まった発話
 * の expression を無視する (item の開始でいったん initial に戻り、以降は
 * item 内の発話が切り替える、#2)。explicit が false (省略) の場合は
 * itemStart を見ず、item をまたいでも直近の発話の表情を引き継ぐ
 * (ADR-0011)。speech は渡した順 (narration() の出力順) を前提に末尾から
 * 遡り、最初に条件に合うものを返して打ち切る (#8。渡した順での「最後の
 * 一致」と同じ結果になる)。speech は figure() が呼び出し側の character
 * 宛に絞り込んだ後の列。itemStart (= t.absolute - t.seconds) と absolute
 * はどちらも Stage がフレーム番号から作る値で frame/fps のグリッドに
 * 乗っている (itemStart の元になる from は round(at × fps)) が、s.at は
 * narration() が積み上げた生の秒数でフレーム境界に乗るとは限らない (#14。
 * 例: item の分割位置を speech の開始秒に合わせて書いた場合)。秒のまま
 * 比較すると frame に丸められた境界と生の秒がわずかにずれ、範囲の端でだけ
 * 判定を落とすちらつきが起きるため、s.at 側を toFrame() (src/effects) で
 * フレーム単位に丸めてから比較する (itemStart・absolute は元からこの
 * グリッド上にあるので同じ丸めを掛けても値は変わらない)。
 */
export const expressionAt = (
  absolute: number,
  itemStart: number,
  initial: string,
  speech: readonly Speech[],
  explicit: boolean,
): string => {
  const nowFrame = toFrame(absolute, fps);
  const itemStartFrame = toFrame(itemStart, fps);

  for (let i = speech.length - 1; i >= 0; i--) {
    const s = speech[i];
    const atFrame = toFrame(s.at, fps);

    if (
      atFrame <= nowFrame &&
      s.expression !== undefined &&
      (!explicit || atFrame >= itemStartFrame)
    ) {
      return s.expression;
    }
  }

  return initial;
};

/** isBlinking() が読む値 (characterTiming のうち目パチに使う分)。 */
type BlinkTiming = {
  /** 目パチの周期 (秒)。 */
  readonly blinkInterval: number;
  /** 閉眼の尺 (秒)。周期の末尾側に置く。 */
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
  state: {
    /** 閉眼かどうか。目レイヤーの開閉を選ぶ。 */
    readonly blinking: boolean;
    /** 口の形。口レイヤーの母音を選ぶ。 */
    readonly mouth: MouthKey;
  },
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
 * narration() だけが figure() の括りから呼ぶ (ADR-0014、この関数自体は
 * compositions/index.ts から公開しない)。expression は初期の表情名
 * (省略時は expressions の最初のキー)。expressions に無ければ throw する
 * (`Object.hasOwn()` で検査し、"toString" 等の prototype のキーを通さない、
 * #11)。speech は narration() の戻り値の speech をそのまま渡してよい
 * (このキャラクター宛以外は figureNode() が無視する)。表情ごとの画像パスは
 * 呼び出し時に 1 度だけ staticFile() を掛けておき (resolveFigureLayer())、
 * Stage が毎フレーム呼ぶ render は、動画先頭からの絶対秒 (absolute) と
 * item の開始の絶対秒 (itemStart = absolute - seconds) で目パチ
 * (isBlinking())・口パク (mouthAt())・表情 (expressionAt()) を選び、
 * layerSources() で選んだ URL を Figure に固定 props (layers) として渡す
 * だけにする。
 */
export const figureNode = (
  character: Character,
  options: {
    /**
     * 初期の表情名。省略時は直近の line() の表情を item をまたいで引き
     * 継ぐ (指定が無ければ expressions の最初のキー)。明示時はその item
     * の開始でその表情に戻し、以降は item 内の line() が切り替える。
     */
    readonly expression?: string;
    /** narration() の戻り値の speech。このキャラクター宛以外は figureNode() が無視する。 */
    readonly speech: readonly Speech[];
    /** 枠を置く側。省略時は left (right は章の区切りのみ)。 */
    readonly side?: "left" | "right";
  },
): SampleNode => {
  const initial = resolveExpressionName(
    character,
    options.expression,
    "figureNode",
  );
  const explicit = options.expression !== undefined;

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
    const expression = expressionAt(
      t.absolute,
      itemStart,
      initial,
      ownSpeech,
      explicit,
    );
    const layers = resolvedExpressions[expression];
    const sources = layerSources(layers, { blinking, mouth });

    return createElement(Figure, { layers: sources, side: options.side });
  });
};

/** figure() に渡すオプション。 */
export type FigureGroupOptions = {
  /** 枠を置く側。省略時は left (right は章の区切りのみ)。 */
  readonly side?: "left" | "right";
  /** フェードインの尺 (秒)。in・out のどちらかを指定すると fade()、どちらも無ければ cut() で立ち絵 layer に置く。 */
  readonly in?: number;
  /** フェードアウトの尺 (秒)。 */
  readonly out?: number;
  /** 括りの先頭の行より前に立ち絵を出す秒数。省略時は theme の characterTiming.lead。 */
  readonly lead?: number;
  /** 括りの末尾の行の字幕の終端より後に立ち絵を残す秒数。省略時は theme の characterTiming.tail。 */
  readonly tail?: number;
  /**
   * 初期の表情名。省略時は直近の line() の表情を item をまたいで引き継ぐ
   * (指定が無ければ expressions の最初のキー)。明示時はその括りの開始で
   * その表情に戻し、以降は括り内の line() が切り替える (figureNode() の
   * expression と同じ規則)。
   */
  readonly expression?: string;
};

/**
 * figure() が返す括り。narration() の入力配列に item と混ぜて置く
 * (ADR-0014)。narration() だけが消費する。
 */
export type FigureGroup = {
  readonly kind: "figureGroup";
  readonly character: Character;
  readonly options: FigureGroupOptions;
  readonly items: readonly NarrationItem[];
};

/** value が figure() の戻り値 (FigureGroup) かどうかを判定する。 */
export const isFigureGroup = (value: unknown): value is FigureGroup =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "figureGroup";

/**
 * 発話の行 (items) を character の立ち絵の括りにまとめる。narration() の
 * 入力配列に item と混ぜて置くこと (narration() 以外の書き手は消費しない)。
 * narration() は items を配列の順のまま平らにして解決し、括りごとに立ち絵の
 * item を 1 つ作って立ち絵 layer に置く (位置は「括りの最初の行の開始 −
 * lead」、終端は「括りの最後の行の字幕の終端 + tail」。lead・tail の既定値は
 * theme の characterTiming.lead・characterTiming.tail、ADR-0014)。items が
 * 空なら throw する。
 */
export const figure = (
  character: Character,
  options: FigureGroupOptions,
  items: readonly NarrationItem[],
): FigureGroup => {
  if (items.length === 0) {
    throw new Error("figure: items が空です");
  }

  for (const key of ["lead", "tail", "in", "out"] as const) {
    const value = options[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`figure: ${key} が不正です (${value})`);
    }
  }

  return { kind: "figureGroup", character, options, items };
};
