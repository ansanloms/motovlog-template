// timeline.ts が発話 (セリフ) を書くための DSL (ADR-0010, ADR-0006, ADR-0011)。
//
// 書き手は line({ text, voice?, by?, expression? }) を cut() の node に渡して
// narration() にまとめて渡す。text はリテラルで書くこと。voice はリテラルの
// 他、利用側の theme の narrator の参照・spread・同じファイルの const・プロパティ
// アクセスが書ける (scripts/voice/extract.ts が読める式に限る。watcher が
// timeline.ts を静的解析して wav・キャッシュを作るため)。by は
// character() が返す Character の参照で、figure() が自分宛の発話を選ぶのに
// 使う (identity で結び付く)。声質の実効値は利用側の theme の narrator ← by.voice ←
// line() の voice の順で上書きした値 (src/voice/key.ts の mergeVoice())。
// 音声キャッシュの key は text とこの実効の声質だけから作り、by・expression は
// 含めない。expression は by の expressions のキーで、指定した表情に
// 切り替える (省略時は現在の表情を維持する)。
//
// narration() は各発話の音声キャッシュ (public/projects/<slug>/lines/
// <key>.json、key.ts の voiceKey()) から実尺を読み、
// { layers: [暗がり layer, 発話 layer], speech } を返す。speech は
// line() item ごとに { at, duration, lipsync, by?, expression? } を持ち、
// figure() (#39) の目パチ・口パク・表情の判定に使う。キャッシュが無いときは
// Studio では書き上がるまで待ち、render と Node (Studio でも rendering
// でもない環境) では即エラーにする (npm run dev の watcher か npm run
// render の前段が生成する)。

import type { ReactNode } from "react";
import React from "react";
import { getRemotionEnvironment, staticFile } from "remotion";
import { subtitleBand } from "../components/index.tsx";
import { Line } from "../components/Line.tsx";
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
import { computeBandSpans } from "./band.ts";
import type { Character } from "./character.ts";

/** line() が組み立てる要素の props。 */
type LineProps = {
  text: string;
  voice?: VoiceOptions;
  by?: Character;
  expression?: string;
};

/**
 * narration() の外に置かれたら throw する内部コンポーネント。line() の
 * 戻り値の型 (ReactNode) として使うだけで、narration() は描画せず props
 * だけを読んで消費する。
 */
const LineMarker: React.FC<LineProps> = () => {
  throw new Error(
    "line() は narration() に渡す item の node としてのみ使えます (narration() の外に置かれています)。",
  );
};

/**
 * 発話 1 本の台本を書く。text (VOICEVOX の {漢字|よみ} 記法を含んでよい) と
 * voice (省略時は theme の既定話者に by.voice を重ねた値)、by
 * (character() の参照、figure() が自分宛の発話を選ぶのに使う)、expression
 * (by の expressions のキー、指定すると figure() の表情をその場で切り替える)
 * を渡す。cut() の node に渡し、narration() にまとめて渡すこと。text・voice
 * はリテラルで書く (scripts/voice の静的解析が変数・関数呼び出しを許さない)。
 * expression は by が無い、または by.expressions に無いキーだと throw する。
 * narration.ts は .ts (拡張子は timeline.ts からの import 記法に合わせる)
 * ため React.createElement で組み立てる。
 */
export const line = (props: LineProps): ReactNode => {
  if (props.expression !== undefined) {
    if (!props.by) {
      throw new Error(
        `line(): expression ("${props.expression}") を指定するには by (character の参照) が必要です: ${props.text}`,
      );
    }

    if (!Object.hasOwn(props.by.expressions, props.expression)) {
      throw new Error(
        `line(): by に無い表情 "${props.expression}" が指定されました: ${props.text}`,
      );
    }
  }

  return React.createElement(LineMarker, props);
};

const linePropsOf = (
  node: ReactNode | FrameMarker | SampleNode,
): LineProps | undefined =>
  React.isValidElement(node) && node.type === LineMarker
    ? (node.props as LineProps)
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
type NarrationOptions = { slug?: string };

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
  readonly layers: readonly [Layer, Layer];
  readonly speech: readonly Speech[];
};

/**
 * 発話の列から Narration ({ layers: [暗がり layer, 発話 layer], speech }) を
 * 組み立てる。node が line() の戻り値 (LineMarker コンポーネント) の item は
 * 音声キャッシュから実尺を取り、それ以外の item は duration が必須
 * (無ければ throw)。位置 (at/after/省略) は実尺を埋めた仮 layer を
 * resolveLayer() で解決して求める。line() item に duration が明示されて
 * いれば、位置決め・字幕の尺の両方にその値をそのまま使い、tail もクランプも
 * 掛けない (書き手が明示した値を実尺で上書きしない)。明示が無い line()
 * item の字幕の尺は min(実尺 + subtitleTiming.tail, 次の item の開始 −
 * 自分の開始) にクランプする (最後の item は前者のまま)。line() 以外の
 * item は kind・node・duration (fade なら in/out も) を保ったまま、at を
 * 解決済みの開始秒に置き換えて発話 layer にそのまま残す。暗がり
 * (computeBandSpans() への入力) は line() item なら字幕が消えるまで
 * (captionEnd) 出る。音声 (speechEnd) が字幕より先に終わっていても、暗がり
 * は字幕の消灯までは維持される (duration を明示して字幕を長く出した場合も
 * 同じ)。戻り値の `speech` は line() item ごと (渡した順) に、音声の絶対
 * 開始秒 (at)・音声が実際に鳴る秒数 (duration、cache.duration と字幕の尺
 * (captionDuration) の小さい方。duration を明示して字幕を実尺より短く
 * 切ったときに、実尺のまま口パクが無音で続くのを防ぐ、#3)・口パクの母音
 * 区間 (lipsync、cache.lipsync)・by (指定時)・expression (指定時) を持つ
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
      const key = await voiceKey({
        text: speech.text,
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

    if (item.duration === undefined) {
      throw new Error(
        `narration: item ${index} は line() (発話) ではなく、duration も指定されていません`,
      );
    }

    return {
      key: undefined,
      cacheDuration: item.duration,
      positionDuration: item.duration,
      lipsync: undefined,
    };
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

    if (!speech || key === undefined) {
      // line() 以外は音声が無く、暗がりも発話 layer と同じ区間 (at 〜
      // at + positionDuration) だけ出る。
      const end = resolved.at + positionDuration;

      bandInputs.push({ start: resolved.at, speechEnd: end, captionEnd: end });

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
