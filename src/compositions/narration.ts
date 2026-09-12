// timeline.ts が発話 (セリフ) を書くための DSL (ADR-0010, ADR-0006, ADR-0011)。
//
// 書き手は line({ text, reading?, voice?, by?, expression? }) を cut() の
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
// character() が返す Character の参照で、figure() が自分宛の発話を選ぶのに
// 使う (identity で結び付く)。声質の実効値は利用側の theme の narrator ← by.voice ←
// line() の voice の順で上書きした値 (src/voice/key.ts の mergeVoice())。
// 音声キャッシュの key は text と (reading があれば) reading とこの実効の
// 声質だけから作り、by・expression は含めない。expression は by の
// expressions のキーで、指定した表情に切り替える (省略時は現在の表情を
// 維持する)。
//
// narration() は各発話の音声キャッシュ (public/projects/<slug>/lines/
// <key>.json、key.ts の voiceKey()) から実尺を読み、
// { layers: [暗がり layer, 発話 layer], speech } を返す。speech は
// line() item ごとに { at, duration, lipsync, by?, expression? } を持ち、
// figure() (#39) の目パチ・口パク・表情の判定に使う (声無しの item は
// lipsync: [] で、表情の切り替えだけ効く)。キャッシュが無いときは Studio
// では書き上がるまで待ち、render と Node (Studio でも rendering でもない
// 環境) では即エラーにする (npm run dev の watcher か npm run render の
// 前段が生成する)。

import type { ReactNode } from "react";
import React from "react";
import { getRemotionEnvironment, staticFile } from "remotion";
import { subtitleBand } from "../components/index.tsx";
import { Line } from "../components/Line.tsx";
import type { TextLines } from "../components/text.ts";
import { joinLines } from "../components/text.ts";
import { cut, fade, isFrame, resolveLayer } from "../effects/index.ts";
import type {
  CutItem,
  FadeItem,
  FrameMarker,
  Item,
  Layer,
  PendingCutItem,
  ResolvedItem,
  SampleNode,
} from "../effects/index.ts";
import { resolveProjectSlug } from "../project/load.ts";
import { bandTiming, subtitleTiming } from "../theme/index.ts";
import { isVoiceCache } from "../voice/cache.ts";
import type { LipsyncEntry, VoiceCache, VoiceOptions } from "../voice/cache.ts";
import { linePath, mergeVoice, voiceKey } from "../voice/key.ts";
import { assertReadingNotation } from "../voice/reading.ts";
import { computeBandSpans } from "./band.ts";
import type { Character } from "./character.ts";

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
  /** character() の参照。figure() が自分宛の発話を選ぶのに使う (identity で結び付く)。 */
  by?: Character;
  /** by の expressions のキー。指定するとその場で表情を切り替える (省略時は現在の表情を維持)。 */
  expression?: string;
};

/** LineMarker が保持する props (text・reading は結合済みの単一行文字列)。 */
type ResolvedLineProps = Omit<LineProps, "text" | "reading"> & {
  text: string;
  reading?: string;
};

/**
 * narration() の外に置かれたら throw する内部コンポーネント。line() の
 * 戻り値の型 (ReactNode) として使うだけで、narration() は描画せず props
 * だけを読んで消費する。
 */
const LineMarker: React.FC<ResolvedLineProps> = () => {
  throw new Error(
    "line() は narration() に渡す item の node としてのみ使えます (narration() の外に置かれています)。",
  );
};

/**
 * 発話 1 本の台本を書く。text (VOICEVOX の {漢字|よみ} 記法を含んでよい、
 * 配列で書くと字幕の改行として結合する) と reading (合成に渡す文、text と
 * 同じく配列可、省略時は text をそのまま使う)、voice (省略時は theme の
 * 既定話者に by.voice を重ねた値、null で声無し)、by (character() の参照、
 * figure() が自分宛の発話を選ぶのに使う)、expression (by の expressions の
 * キー、指定すると figure() の表情をその場で切り替える) を渡す。cut() の
 * node に渡し、narration() にまとめて渡すこと。text・reading・voice は
 * リテラルで書く (scripts/voice の静的解析が変数・関数呼び出しを許さない)。
 * text・reading の {漢字|よみ} 記法が壊れている (片側が空・| が無い・入れ子や
 * 非対称の括弧) と throw する (配列の場合は結合した文字列に対して検査する)。
 * reading を空文字にすると throw する (声無しは voice: null で書く)。
 * voice: null と reading を同時に指定すると throw する (声無しの行に
 * reading は無意味なため)。expression は by が無い、または by.expressions
 * に無いキーだと throw する。narration.ts は .ts (拡張子は timeline.ts
 * からの import 記法に合わせる) ため React.createElement で組み立てる。
 */
export const line = (props: LineProps): ReactNode => {
  const text = joinLines(props.text);
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

  if (props.expression !== undefined) {
    if (!props.by) {
      throw new Error(
        `line(): expression ("${props.expression}") を指定するには by (character の参照) が必要です: ${text}`,
      );
    }

    if (!Object.hasOwn(props.by.expressions, props.expression)) {
      throw new Error(
        `line(): by に無い表情 "${props.expression}" が指定されました: ${text}`,
      );
    }
  }

  return React.createElement(LineMarker, { ...props, text, reading });
};

const linePropsOf = (
  node: ReactNode | FrameMarker | SampleNode,
): ResolvedLineProps | undefined =>
  React.isValidElement(node) && node.type === LineMarker
    ? (node.props as ResolvedLineProps)
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
 * Anchor だが、narration() の中では Anchor を使えない (下の layer の解決
 * 結果を要するため)。CutItem 等は Placement の 2 分岐 (at/after) を
 * Omit 越しに単一の平坦な型へ畳んでしまい、型だけでは at/after の排他性も
 * Anchor の排除も表せないため、Anchor を渡した場合は narration() が実行時
 * に throw する。
 */
type NarrationItem = CutItem | FadeItem | PendingCutItem;

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
  /** 音声の絶対開始秒 (発話 layer の item に使った at と同じ)。 */
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

/** narration() の戻り値。[暗がり layer, 発話 layer] に加え、発話ごとの音声の実測値を持つ。 */
export type Narration = {
  /** [暗がり layer, 発話 layer]。 */
  readonly layers: readonly [Layer, Layer];
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
 * 発話の列から Narration ({ layers: [暗がり layer, 発話 layer], speech }) を
 * 組み立てる。node が line() の戻り値 (LineMarker コンポーネント) の item は
 * 音声キャッシュから実尺を取り (voice: null なら音声キャッシュを読まず
 * duration が必須、無ければ throw)、それ以外の item は duration が必須
 * (無ければ throw)。位置 (at/after/省略) は実尺を埋めた仮 layer を
 * resolveLayer() で解決して求める。line() item に duration が明示されて
 * いれば、位置決め・字幕の尺の両方にその値をそのまま使い、tail もクランプも
 * 掛けない (書き手が明示した値を実尺で上書きしない、voice: null は常にこの
 * 扱い)。明示が無い line() item の字幕の尺は min(実尺 + subtitleTiming.tail,
 * 次の item の開始 − 自分の開始) にクランプする (最後の item は前者のまま)。
 * line() 以外の item は kind・node・duration (fade なら in/out も) を保った
 * まま、at を解決済みの開始秒に置き換えて発話 layer にそのまま残す。暗がり
 * (computeBandSpans() への入力) は line() item なら字幕が消えるまで
 * (captionEnd) 出る (voice: null は duration の間だけ)。音声 (speechEnd) が
 * 字幕より先に終わっていても、暗がりは字幕の消灯までは維持される (duration
 * を明示して字幕を長く出した場合も同じ)。戻り値の `speech` は line() item
 * ごと (渡した順) に、音声の絶対開始秒 (at)・音声が実際に鳴る秒数
 * (duration、cache.duration と字幕の尺 (captionDuration) の小さい方。
 * duration を明示して字幕を実尺より短く切ったときに、実尺のまま口パクが
 * 無音で続くのを防ぐ、#3。voice: null は duration そのもの)・口パクの母音
 * 区間 (lipsync、cache.lipsync。voice: null は空配列)・by (指定時)・
 * expression (指定時) を持つ
 * (#39 の立ち絵の目パチ・口パク・表情の切り替えに使う)。
 */
export const narration = async (
  items: readonly NarrationItem[],
  options: NarrationOptions = {},
  deps: Partial<NarrationDeps> = {},
): Promise<Narration> => {
  if (items.length === 0) {
    throw new Error("narration: 発話が 1 つもありません");
  }

  items.forEach((item) => {
    if (item.at !== undefined && typeof item.at !== "number") {
      throw new Error(
        "narration の item の at は秒の数値だけ受け付けます (アンカーは下の layer を知らないため使えません)",
      );
    }

    if (isFrame(item.node)) {
      throw new Error("narration: frame() は narration() の item に置けません");
    }
  });

  const resolvedDeps: NarrationDeps = { ...defaultDeps, ...deps };
  const slug = options.slug ?? resolveProjectSlug(process.env.REMOTION_PROJECT);

  const resolvedItems$ = items.map(async (item, index) => {
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
  const tempLayer: Item[] = items.map(
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

  resolvedItems.forEach((resolved, index) => {
    const speech = linePropsOf(items[index].node);
    const { key, cacheDuration, positionDuration, lipsync } = durations[index];
    const original = items[index];

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
            }
          : {
              kind: "cut",
              node: original.node,
              duration: positionDuration,
              at: resolved.at,
            },
      );

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

      speechLayer.push(
        cut(React.createElement(Line, { text: speech.text }), {
          at: resolved.at,
          duration: positionDuration,
        }),
      );

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
    // と同じ絶対開始秒、duration は実際に音声が鳴る秒数 (cacheDuration と
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

    speechLayer.push(
      cut(
        React.createElement(Line, {
          text: speech.text,
          src: staticFile(`${linePath(slug, key)}.wav`),
        }),
        { at: resolved.at, duration: captionDuration },
      ),
    );
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

  return { layers: [bandLayer, speechLayer], speech: speechEntries };
};
