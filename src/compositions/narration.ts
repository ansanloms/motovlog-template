// timeline.ts が発話 (セリフ) を書くための DSL (ADR-0010, ADR-0006, ADR-0011)。
//
// 書き手は line({ text, reading?, voice?, by? }) を cut() の
// node に渡して narration() にまとめて渡す。text・reading はリテラルで書く
// こと (配列で書くと字幕・合成それぞれの改行として結合する、text と
// TextLines を参照)。字幕には displayText(text)、合成には
// readingText(reading ?? text) を使う (reading は省略すると text をそのまま
// 合成に使う)。text・reading の
// {漢字|よみ} 記法はどちらか片側が空・| が無い・入れ子や非対称の括弧
// (閉じ忘れ・開き忘れ) だと throw する (assertReadingNotation())。voice は
// リテラルの他、利用側の theme の
// narrator の参照・spread・同じファイルの const・プロパティアクセスが書ける
// (scripts/voice/extract.ts が読める式に限る。watcher が timeline.ts を
// 静的解析して wav・キャッシュを作るため)。voice に null を渡すと声無し
// (wav・lipsync を作らない、cut()/fade() の duration が必須) になる。by は
// character() が返す Character の参照 (表情は既定) か、
// `{ character, expression? }` の形 (character.ts の ByRef) で、figure() が
// 自分宛の発話を選ぶのに使う (character の identity で結び付く)。声質の
// 実効値は利用側の theme の narrator ← by.voice ← line() の voice の順で
// 上書きした値 (src/voice/key.ts の mergeVoice())。音声キャッシュの key は
// text と (reading があれば) reading とこの実効の声質だけから作り、
// by・expression は含めない。expression は by.expressions のキーで、
// 指定した表情に切り替える (省略時は現在の表情を
// 維持する)。
//
// narration() は塊 (GroupNode、ADR-0014) を返し、`cut(n, { at })`/
// `fade(n, { at, in, out })` で timeline の layer に置く。内部は下から
// 立ち絵 layer (置いた場合のみ)・暗がり layer・発話 layer の順で、`speech`
// (塊の先頭からの秒) も併せ持つ。各発話の音声キャッシュ
// (public/projects/<slug>/lines/<key>.json、key.ts の voiceKey()) から
// 実尺を読み、位置 (at/after/省略) はこの塊の先頭からの相対秒として解決する。
// speech は line() item ごとに { at, duration, lipsync, by?, expression? }
// を持ち、figure() の括り (このファイル下部の figureNode() 呼び出し) の
// 目パチ・口パク・表情の判定に使う (声無しの item は lipsync: [] で、
// 表情の切り替えだけ効く)。キャッシュが無いときは Studio では書き上がるまで
// 待ち、render と Node (Studio でも rendering でもない環境) では即エラーに
// する (npm run dev の watcher か npm run render の前段が生成する)。
//
// 入力配列には line() の item に加え、figure() (./figure.ts) が返す括り
// (FigureGroup) を混ぜて置ける。narration() は括りの中の item を配列の順の
// まま平らにして解決し (位置・after の連鎖は行を直接書いたのと同じに
// 振る舞う)、括りごとに立ち絵の item を 1 つ立ち絵 layer に作る (ADR-0014)。

import type { ReactNode } from "react";
import React from "react";
import { getRemotionEnvironment, staticFile } from "remotion";
import { subtitleBand } from "../components/index.tsx";
import { Line } from "../components/Line.tsx";
import type { TextLines } from "../components/text.ts";
import { joinLines } from "../components/text.ts";
import {
  cut,
  fade,
  group,
  isFrame,
  isGroup,
  resolveLayer,
  toFrame,
} from "../effects/index.ts";
import type {
  CutItem,
  FadeItem,
  FrameMarker,
  GroupNode,
  Item,
  Layer,
  PendingCutItem,
  ResolvedItem,
  SampleNode,
} from "../effects/index.ts";
import { resolveProjectSlug } from "../project/load.ts";
import {
  bandTiming,
  characterTiming,
  fps,
  subtitleTiming,
} from "../theme/index.ts";
import { isVoiceCache } from "../voice/cache.ts";
import type { LipsyncEntry, VoiceCache, VoiceOptions } from "../voice/cache.ts";
import { linePath, mergeVoice, voiceKey } from "../voice/key.ts";
import { assertReadingNotation } from "../voice/reading.ts";
import { computeBandSpans } from "./band.ts";
import { resolveBy } from "./character.ts";
import type { ByRef, Character } from "./character.ts";
import { figureNode, isFigureGroup } from "./figure.ts";
import type { FigureGroup } from "./figure.ts";

/** line() が受け取る props。 */
type LineProps = {
  /**
   * 発話のテキスト (VOICEVOX の {漢字|よみ} 記法を含んでよい)。リテラルで
   * 書く。配列で書くと字幕の改行として結合する (読みには影響しない、
   * 音声合成では改行を落とすため)。
   */
  text: TextLines;
  /**
   * 合成に渡す文 (VOICEVOX の {漢字|よみ} 記法を含んでよい)。リテラルで書く。
   * text と同じく配列で書くと結合する。省略時は text をそのまま合成に使う
   * (readingText(text))。空文字は throw する (声無しは voice: null で書く)。
   */
  reading?: TextLines;
  /**
   * 声質。省略分は theme の既定話者に by.voice を重ねた値で埋める。null を
   * 渡すと声無し (wav・lipsync を作らない)。声無しの item は cut()/fade()
   * の duration が必須で、字幕の尺は duration と同じになる。
   */
  voice?: VoiceOptions | null;
  /** character() の参照 (表情は既定) か `{ character, expression? }` の形。figure() が自分宛の発話を選ぶのに使う (character の identity で結び付く)。 */
  by?: ByRef;
};

/**
 * LineMarker が実際に保持する props (line() が text・reading を結合済みの
 * 文字列にし、by を正規化した後の形)。内部の消費側 (Speech.by・
 * Speech.expression、figure() の identity 比較 `s.by === character`) は
 * この形で読む。
 */
type NormalizedLineProps = Omit<LineProps, "by" | "text" | "reading"> & {
  text: string;
  reading?: string;
  by?: Character;
  expression?: string;
};

/**
 * narration() の外に置かれたら throw する内部コンポーネント。line() の
 * 戻り値の型 (ReactNode) として使うだけで、narration() は描画せず props
 * だけを読んで消費する。
 */
const LineMarker: React.FC<NormalizedLineProps> = () => {
  throw new Error(
    "line() は narration() に渡す item の node としてのみ使えます (narration() の外に置かれています)。",
  );
};

/**
 * 発話 1 本の台本を書く。text (VOICEVOX の {漢字|よみ} 記法を含んでよい、
 * 配列で書くと字幕の改行として結合する) と reading (合成に渡す文、text と
 * 同じく配列可、省略時は text をそのまま使う)、voice (省略時は theme の
 * 既定話者に by.voice を重ねた値、null で声無し)、by (character() の参照、
 * 表情は既定、か `{ character, expression? }` の形。figure() が自分宛の
 * 発話を選ぶのに使う) を渡す。cut() の node に渡し、narration() にまとめて
 * 渡すこと。text・reading・voice はリテラルで書く (scripts/voice の
 * 静的解析が変数・関数呼び出しを許さない)。text・reading の {漢字|よみ}
 * 記法が壊れている (片側が空・| が無い・入れ子や非対称の括弧) と throw する
 * (配列の場合は結合した文字列に対して検査する)。reading を空文字にすると
 * throw する (声無しは voice: null で書く)。voice: null と reading を
 * 同時に指定すると throw する (声無しの行に reading は無意味なため)。
 * expression は by.expressions に無いキーだと throw する。line() 直下に
 * expression を渡した場合は「by の中に書いてください」と throw する (型では
 * 弾けない JS からの誤用のため)。narration.ts は .ts (拡張子は timeline.ts
 * からの import 記法に合わせる) ため React.createElement で組み立てる。
 */
export const line = (props: LineProps): ReactNode => {
  const text = joinLines(props.text);

  if ("expression" in props) {
    throw new Error(
      `line(): expression は by の中に書いてください (by: { character, expression }): ${text}`,
    );
  }

  assertReadingNotation(text);

  const reading =
    props.reading !== undefined ? joinLines(props.reading) : undefined;

  if (reading === "") {
    throw new Error(
      `line(): reading を空文字にはできません (声無しは voice: null で書いてください): ${text}`,
    );
  }

  if (reading !== undefined) {
    assertReadingNotation(reading);
  }

  if (props.voice === null && reading !== undefined) {
    throw new Error(
      `line(): 声無しの行 (voice: null) に reading は書けません: ${text}`,
    );
  }

  const resolved = props.by === undefined ? undefined : resolveBy(props.by);

  if (resolved?.expression !== undefined) {
    if (!Object.hasOwn(resolved.character.expressions, resolved.expression)) {
      throw new Error(
        `line(): by に無い表情 "${resolved.expression}" が指定されました: ${text}`,
      );
    }
  }

  return React.createElement(LineMarker, {
    text,
    reading,
    voice: props.voice,
    by: resolved?.character,
    expression: resolved?.expression,
  });
};

const linePropsOf = (
  node: ReactNode | FrameMarker | SampleNode,
): NormalizedLineProps | undefined =>
  React.isValidElement(node) && node.type === LineMarker
    ? (node.props as NormalizedLineProps)
    : undefined;

/** narration() のテスト用差し替え関数群。既定は本物の fetch と Remotion の環境判定を使う。 */
export type NarrationDeps = {
  /** `<key>.json` の取得に使う。既定は globalThis.fetch。 */
  fetchCache: typeof fetch;
  /** Studio かどうか。既定は getRemotionEnvironment().isStudio。Studio だけが待つ。 */
  isStudio: () => boolean;
  /** Studio での待ちの間隔 (ms)。既定 500。 */
  waitIntervalMs: number;
  /** Studio での待ちの打ち切り (ms)。既定 30000。 */
  waitTimeoutMs: number;
  /** 待ちに使う sleep。既定は setTimeout。 */
  sleep: (ms: number) => Promise<void>;
};

const defaultDeps: NarrationDeps = {
  fetchCache: (input, init) => fetch(input, init),
  isStudio: () => getRemotionEnvironment().isStudio,
  waitIntervalMs: 500,
  waitTimeoutMs: 30000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const tryFetchVoiceCache = async (
  url: string,
  fetchCache: typeof fetch,
): Promise<VoiceCache | undefined> => {
  try {
    const res = await fetchCache(url);

    if (!res.ok) {
      return undefined;
    }

    const json: unknown = await res.json();

    return isVoiceCache(json) ? json : undefined;
  } catch {
    return undefined;
  }
};

/**
 * `<key>.json` を取得する。Studio では waitIntervalMs 間隔で waitTimeoutMs
 * まで待つ (npm run dev の watcher が書き終わるのを待つ)。render と Node
 * (Studio でも rendering でもない環境、isStudio が false) では 1 回だけ試し、
 * 無ければ即エラー。
 */
const waitForVoiceCache = async (
  url: string,
  deps: NarrationDeps,
): Promise<VoiceCache> => {
  const maxAttempts = deps.isStudio()
    ? Math.max(1, Math.floor(deps.waitTimeoutMs / deps.waitIntervalMs) + 1)
    : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await deps.sleep(deps.waitIntervalMs);
    }

    const cache = await tryFetchVoiceCache(url, deps.fetchCache);

    if (cache) {
      return cache;
    }
  }

  throw new Error(
    `発話の音声キャッシュが見つかりません: ${url}\n` +
      "npm run dev の watcher が動いているか、.env の VOICEVOX_URL が設定されているかを確認してください。",
  );
};

/**
 * narration() に渡せる item (cut()/fade() が組み立てる CutItem・FadeItem か
 * PendingCutItem)。`at` は timeline() の Placement では秒の数値または
 * Anchor だが、narration() の中では Anchor を使えない (仮 layer を単独で
 * resolveLayer() に渡すため、他の layer の item を参照できない)。`until`
 * も同じ理由で使えない (発話の実尺から duration を求めるため)。CutItem 等は
 * Placement・Span の分岐を Omit 越しに単一の平坦な型へ畳んでしまい、型
 * だけでは at/after・duration/until の排他性も Anchor の排除も表せないため、
 * Anchor や until を渡した場合は narration() が実行時に throw する。
 * figure() (./figure.ts) の items の型としても使う。
 */
export type NarrationItem = CutItem | FadeItem | PendingCutItem;

/**
 * narration() のオプション。slug は staticFile() のパス組み立てに要る。
 * 省略時は resolveProjectSlug(process.env.REMOTION_PROJECT) (Root.tsx と
 * 同じ解決) を使う。
 */
type NarrationOptions = {
  /** staticFile() のパス組み立てに使う slug。省略時は resolveProjectSlug(process.env.REMOTION_PROJECT) (Root.tsx と同じ解決)。 */
  slug?: string;
};

/**
 * 発話 1 本分の音声の実測値 (#39 の立ち絵の口パク・表情に使う)。line() 以外の
 * item (字幕だけの cut() 等) には対応するものが無いため、speech には
 * line() item の分だけ、渡した順に積む。
 */
export type Speech = {
  /** 塊 (narration() が返す GroupNode) の先頭からの秒 (発話 layer の item に使った at と同じ)。 */
  readonly at: number;
  /**
   * 音声が実際に鳴る秒数 (cache.duration と字幕の尺 (captionDuration) の
   * 小さい方)。duration を明示して字幕を実尺より短く切ったときに、実尺の
   * まま無音の口パクが続く (次に重なる発話が無視される) のを防ぐ (#3)。
   */
  readonly duration: number;
  /** 口パクの母音区間の列 (VOICEVOX の音声合成クエリ由来)。 */
  readonly lipsync: readonly LipsyncEntry[];
  /** line() の by (指定時)。figure() が自分宛の発話を選ぶのに使う。 */
  readonly by?: Character;
  /** line() の expression (指定時)。figure() の表情の切り替えに使う。 */
  readonly expression?: string;
};

/**
 * narration() の戻り値。塊 (GroupNode、ADR-0014) に発話ごとの音声の実測値
 * (speech) を加えたもの。`cut(n, { at })`/`fade(n, { at, in, out })` で
 * timeline の layer に置く。内部 layer は下から立ち絵 layer (figure() の
 * 括りを渡した場合のみ)・暗がり layer・発話 layer の順。
 */
export type Narration = GroupNode & {
  /** 発話 (line() item) ごとの音声の実測値。渡した順。 */
  readonly speech: readonly Speech[];
};

/** narration() の音声を伴わない item (line() 以外、または voice: null の line()) の実尺セット。 */
type NoAudioDurations = {
  key: undefined;
  cacheDuration: number;
  positionDuration: number;
  lipsync: undefined;
};

/**
 * 音声を伴わない item (line() 以外、または voice: null の line()) の
 * duration 駆動の実尺セットを作る。duration が無ければ buildErrorMessage()
 * の返り値で throw する。resolvedItems$ の map (narration() 内) で、
 * 非 line() 項目と声無しの line() の両方から使い、「音声なし・duration
 * 必須」の扱いを重複させない。
 */
const resolveNoAudioDurations = (
  item: NarrationItem,
  buildErrorMessage: () => string,
): NoAudioDurations => {
  if (item.duration === undefined) {
    throw new Error(buildErrorMessage());
  }

  return {
    key: undefined,
    cacheDuration: item.duration,
    positionDuration: item.duration,
    lipsync: undefined,
  };
};

/**
 * 音声を伴わない item の暗がりの区間 (bandInputs に積む 1 件) を作る。
 * 音声が無いため、字幕の尺 (= positionDuration) の間だけ暗がりが出る
 * (speechEnd・captionEnd は同じ値になる)。narration() の forEach で、
 * 非 line() 項目と声無しの line() の両方から使う。
 */
const noAudioBandInput = (
  at: number,
  positionDuration: number,
): { start: number; speechEnd: number; captionEnd: number } => {
  const end = at + positionDuration;

  return { start: at, speechEnd: end, captionEnd: end };
};

/**
 * 発話の列から Narration (GroupNode + speech、ADR-0014) を組み立てる。
 * items には line() の item に加え figure() の括り (FigureGroup) を混ぜて
 * 置ける。括りの中の item は配列の順のまま平らにしてから解決するため、
 * 位置 (at/after/省略) は行を直接書いたのと同じに振る舞う (「flatItems」参照)。
 * node が line() の戻り値 (LineMarker コンポーネント) の item は音声
 * キャッシュから実尺を取り (voice: null なら音声キャッシュを読まず duration
 * が必須、無ければ throw)、それ以外の item は duration が必須 (無ければ
 * throw)。位置は実尺を埋めた仮 layer を resolveLayer() で解決して求める。
 * line() item に duration が明示されていれば、位置決め・字幕の尺の両方に
 * その値をそのまま使い、tail もクランプも掛けない (書き手が明示した値を
 * 実尺で上書きしない、voice: null は常にこの扱い)。明示が無い line() item
 * の字幕の尺は min(実尺 + subtitleTiming.tail, 次の item の開始 − 自分の
 * 開始) にクランプする (最後の item は前者のまま)。line() 以外の item は
 * kind・node・duration (fade なら in/out も) を保ったまま、at を解決済みの
 * 開始秒に置き換えて発話 layer にそのまま残す。暗がり
 * (computeBandSpans() への入力) は line() item なら字幕が消えるまで
 * (captionEnd) 出る (voice: null は duration の間だけ)。音声 (speechEnd) が
 * 字幕より先に終わっていても、暗がりは字幕の消灯までは維持される (duration
 * を明示して字幕を長く出した場合も同じ)。戻り値の `speech` は line() item
 * ごと (渡した順) に、塊 (narration() が返す GroupNode) の先頭からの秒 (at)・
 * 音声が実際に鳴る秒数
 * (duration、cache.duration と字幕の尺 (captionDuration) の小さい方。
 * duration を明示して字幕を実尺より短く切ったときに、実尺のまま口パクが
 * 無音で続くのを防ぐ、#3。voice: null は duration そのもの)・口パクの母音
 * 区間 (lipsync、cache.lipsync。voice: null は空配列)・by (指定時)・
 * expression (指定時) を持つ (figure() の括りが作る立ち絵の item の
 * 目パチ・口パク・表情の判定に使う)。発話 layer に置く各 item には source
 * (narration() に渡した入力 item 自体への参照) を付ける。timeline.ts で
 * 入力 item を const に取っておけば、start()/end() でこの発話の開始・終端
 * (字幕の尺の終端) を他の layer の item から参照できる (「立ち絵」参照)。
 * 括りごとの立ち絵の item は、括りの最初の行の開始 (実尺解決後) − lead を
 * 開始、括りの最後の行の字幕の終端 + tail を終端として立ち絵 layer に積む
 * (lead・tail の既定値は theme の characterTiming.lead・characterTiming.tail)。
 * 開始が塊の先頭 (0 秒) より前になる、または前の括りと重なる (フレーム単位)
 * 場合は throw する。立ち絵の item は options.in/out のどちらかを指定すれば
 * fade()、どちらも無ければ cut() で置く。立ち絵 layer は 1 つ以上の括りが
 * あるときだけ作り、最下段 (暗がりのさらに下) に置く。
 */
export const narration = async (
  items: readonly (NarrationItem | FigureGroup)[],
  options: NarrationOptions = {},
  deps: Partial<NarrationDeps> = {},
): Promise<Narration> => {
  if (items.length === 0) {
    throw new Error("narration: 発話が 1 つもありません");
  }

  /** items を配列の順のまま平らにした列 (figure() の括りの中の item も展開する)。 */
  const flatItems: NarrationItem[] = [];
  /** flatItems 内での各 figure() の括りの範囲 (start・end は flatItems の index、両端を含む)。 */
  const figureGroupRanges: {
    readonly start: number;
    readonly end: number;
    readonly group: FigureGroup;
  }[] = [];

  items.forEach((entry) => {
    if (isFigureGroup(entry)) {
      const start = flatItems.length;
      flatItems.push(...entry.items);
      figureGroupRanges.push({
        start,
        end: flatItems.length - 1,
        group: entry,
      });
      return;
    }

    flatItems.push(entry);
  });

  flatItems.forEach((item) => {
    if (item.at !== undefined && typeof item.at !== "number") {
      throw new Error(
        "narration の item の at は秒の数値だけ受け付けます (アンカーは下の layer を知らないため使えません)",
      );
    }

    if (item.until !== undefined) {
      throw new Error(
        "narration の item に until は指定できません (narration() は発話の実尺から duration を求めるため使えません)",
      );
    }

    if (isFrame(item.node)) {
      throw new Error("narration: frame() は narration() の item に置けません");
    }

    if (isGroup(item.node)) {
      throw new Error("narration の item に塊 (group) は置けません");
    }
  });

  const resolvedDeps: NarrationDeps = { ...defaultDeps, ...deps };
  const slug = options.slug ?? resolveProjectSlug(process.env.REMOTION_PROJECT);

  const resolvedItems$ = flatItems.map(async (item, index) => {
    if (isGroup(item.node)) {
      throw new Error("narration の item に塊 (group) は置けません");
    }

    const speech = linePropsOf(item.node);

    if (speech) {
      if (speech.voice === null) {
        // 声無しの line(): wav・lipsync を作らず、字幕の尺 = duration
        // (明示必須)。
        return resolveNoAudioDurations(
          item,
          () =>
            `narration: item ${index} は voice: null (声無し) なので duration が要ります`,
        );
      }

      const key = await voiceKey({
        text: speech.text,
        reading: speech.reading,
        voice: mergeVoice(speech.by?.voice, speech.voice),
      });
      const url = staticFile(`${linePath(slug, key)}.json`);
      const cache = await waitForVoiceCache(url, resolvedDeps);

      // duration を明示した line() item は位置決めにもその値を使う
      // (実尺 (cacheDuration) は暗がりの区間・speech の計算にだけ使う)。
      return {
        key,
        cacheDuration: cache.duration,
        positionDuration: item.duration ?? cache.duration,
        lipsync: cache.lipsync,
      };
    }

    return resolveNoAudioDurations(
      item,
      () =>
        `narration: item ${index} は line() (発話) ではなく、duration も指定されていません`,
    );
  });

  const durations = await Promise.all(resolvedItems$);

  // 実尺 (line() は positionDuration) を埋めた仮 layer を resolveLayer() で
  // 解決し、at (開始秒) を求める。
  const tempLayer: Item[] = flatItems.map(
    (item, index) =>
      ({ ...item, duration: durations[index].positionDuration }) as Item,
  );

  let resolvedItems: ResolvedItem[];

  try {
    resolvedItems = resolveLayer(tempLayer, 0, new Map());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `narration: 発話の位置を解決できません (item の番号は narration() に渡した順、尺は音声の実尺): ${message}`,
    );
  }

  const speechLayer: Item[] = [];
  const speechEntries: Speech[] = [];
  const bandInputs: { start: number; speechEnd: number; captionEnd: number }[] =
    [];
  // index ごとの発話 layer への実際の掲載区間 (figure() の括りの境界の計算に使う)。
  const emittedSpans: { at: number; duration: number }[] = [];

  resolvedItems.forEach((resolved, index) => {
    const original = flatItems[index];

    if (isGroup(original.node)) {
      throw new Error("narration の item に塊 (group) は置けません");
    }

    const speech = linePropsOf(original.node);
    const { key, cacheDuration, positionDuration, lipsync } = durations[index];

    if (!speech) {
      // line() 以外は音声が無く、発話 layer には元の node をそのまま残す。
      // 暗がりは line() 以外・声無しの line() で共通の区間 (at 〜
      // at + positionDuration) だけ出る (noAudioBandInput())。
      bandInputs.push(noAudioBandInput(resolved.at, positionDuration));

      speechLayer.push(
        original.kind === "fade"
          ? {
              kind: "fade",
              node: original.node,
              duration: positionDuration,
              at: resolved.at,
              in: original.in,
              out: original.out,
              source: original,
            }
          : {
              kind: "cut",
              node: original.node,
              duration: positionDuration,
              at: resolved.at,
              source: original,
            },
      );

      emittedSpans.push({ at: resolved.at, duration: positionDuration });

      return;
    }

    if (key === undefined) {
      // 声無しの line() (voice: null)。line() 以外の item と同じ区間の
      // 暗がり (noAudioBandInput()) を出し、speech には lipsync: [] で
      // 載せて表情の切り替えだけ効かせる。ここ以降 key は string に絞られる
      // (音声ありの line() だけが resolvedItems$ で key を求めるため)。
      bandInputs.push(noAudioBandInput(resolved.at, positionDuration));

      speechEntries.push({
        at: resolved.at,
        duration: positionDuration,
        lipsync: [],
        by: speech.by,
        expression: speech.expression,
      });

      speechLayer.push({
        ...cut(React.createElement(Line, { text: speech.text }), {
          at: resolved.at,
          duration: positionDuration,
        }),
        source: original,
      });

      emittedSpans.push({ at: resolved.at, duration: positionDuration });

      return;
    }

    let captionDuration: number;

    if (original.duration !== undefined) {
      captionDuration = positionDuration;
    } else {
      const next = resolvedItems[index + 1];
      const withTail = cacheDuration + subtitleTiming.tail;
      captionDuration = next
        ? Math.min(withTail, next.at - resolved.at)
        : withTail;
    }

    const captionEnd = resolved.at + captionDuration;

    // 暗がりは字幕が消えるまで (captionEnd) 出る。speechEnd は音声の実尺と
    // captionEnd の小さい方 (字幕の尺より音声が長ければ Sequence で切れる)。
    bandInputs.push({
      start: resolved.at,
      speechEnd: Math.min(resolved.at + cacheDuration, captionEnd),
      captionEnd,
    });

    // speech は line() item ごと (渡した順) に積む。at は発話 layer の item
    // と同じ、塊 (narration() が返す GroupNode) の先頭からの秒。duration は
    // 実際に音声が鳴る秒数 (cacheDuration と
    // captionDuration の小さい方。#39 の立ち絵の口パクに使う。duration を
    // 明示して字幕を実尺より短く切ったときに、口パクが無音のまま続くのを
    // 防ぐ、#3)。
    speechEntries.push({
      at: resolved.at,
      duration: Math.min(cacheDuration, captionDuration),
      lipsync: lipsync ?? [],
      by: speech.by,
      expression: speech.expression,
    });

    speechLayer.push({
      ...cut(
        React.createElement(Line, {
          text: speech.text,
          src: staticFile(`${linePath(slug, key)}.wav`),
        }),
        { at: resolved.at, duration: captionDuration },
      ),
      source: original,
    });

    emittedSpans.push({ at: resolved.at, duration: captionDuration });
  });

  const spans = computeBandSpans(bandInputs, bandTiming);

  const bandLayer: Item[] = spans.map((span) =>
    fade(subtitleBand({}), {
      at: span.start,
      duration: span.duration,
      in: span.fadeIn,
      out: bandTiming.fadeOut,
    }),
  );

  // 括りごとに立ち絵の item を 1 つ作る。範囲は「最初の行の開始 − lead」
  // 〜「最後の行の字幕の終端 + tail」(figureGroupRanges は flatItems の
  // 出現順、= 時間順。resolveLayer が時間順を強制するため)。
  let previousFigureEnd: number | undefined;
  const figureLayer: Item[] = figureGroupRanges.map(
    ({ start, end, group: figureGroup }, groupIndex) => {
      const groupNumber = groupIndex + 1;
      const lead = figureGroup.options.lead ?? characterTiming.lead;
      const tail = figureGroup.options.tail ?? characterTiming.tail;
      const at = emittedSpans[start].at - lead;
      const lastSpan = emittedSpans[end];
      const figureEnd = lastSpan.at + lastSpan.duration + tail;

      if (at < 0) {
        throw new Error(
          `narration: 立ち絵の括り (${groupNumber} 個目) の開始が塊の先頭より前になります (lead を減らすか行を後ろにずらしてください)`,
        );
      }

      if (
        previousFigureEnd !== undefined &&
        toFrame(at, fps) < toFrame(previousFigureEnd, fps)
      ) {
        throw new Error(
          `narration: 立ち絵の括り (${groupNumber} 個目) が前の括りと重なります`,
        );
      }

      previousFigureEnd = figureEnd;

      const node = figureNode(figureGroup.character, {
        expression: figureGroup.options.expression,
        speech: speechEntries,
        side: figureGroup.options.side,
      });
      const duration = figureEnd - at;

      return figureGroup.options.in !== undefined ||
        figureGroup.options.out !== undefined
        ? fade(node, {
            at,
            duration,
            in: figureGroup.options.in,
            out: figureGroup.options.out,
          })
        : cut(node, { at, duration });
    },
  );

  const layers: Layer[] =
    figureLayer.length > 0
      ? [figureLayer, bandLayer, speechLayer]
      : [bandLayer, speechLayer];

  return { ...group(layers), speech: speechEntries };
};
