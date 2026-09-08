// timeline.ts が発話 (セリフ) を書くための DSL (ADR-0010, ADR-0006)。
//
// 書き手は line({ text, voice? }) を cut() の node に渡して narration() に
// まとめて渡す。text はリテラルで書くこと。voice はリテラルの他、theme の
// narrator の参照・spread・同じファイルの const・プロパティアクセスが書ける
// (scripts/voice/extract.ts が読める式に限る。watcher が timeline.ts を
// 静的解析して wav・キャッシュを作るため)。
//
// narration() は各発話の音声キャッシュ (public/projects/<slug>/lines/
// <key>.json、key.ts の voiceKey()) から実尺を読み、[暗がり layer, 発話
// layer] を返す。キャッシュが無いときは Studio では書き上がるまで待ち、
// render と Node (Studio でも rendering でもない環境) では即エラーにする
// (npm run dev の watcher か npm run render の前段が生成する)。

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
} from "../effects/index.ts";
import { resolveProjectSlug } from "../project/load.ts";
import { bandTiming, subtitleTiming } from "../theme/index.ts";
import { isVoiceCache } from "../voice/cache.ts";
import type { VoiceCache, VoiceOptions } from "../voice/cache.ts";
import { linePath, voiceKey } from "../voice/key.ts";
import { computeBandSpans } from "./band.ts";

/** line() が組み立てる要素の props。 */
type SpeechProps = { text: string; voice?: VoiceOptions };

/**
 * narration() の外に置かれたら throw する内部コンポーネント。line() の
 * 戻り値の型 (ReactNode) として使うだけで、narration() は描画せず props
 * だけを読んで消費する。
 */
const Speech: React.FC<SpeechProps> = () => {
  throw new Error(
    "line() は narration() に渡す item の node としてのみ使えます (narration() の外に置かれています)。",
  );
};

/**
 * 発話 1 本の台本を書く。text (VOICEVOX の {漢字|よみ} 記法を含んでよい) と
 * voice (省略時は theme の既定話者) を渡す。cut() の node に渡し、
 * narration() にまとめて渡すこと。text・voice はリテラルで書く
 * (scripts/voice の静的解析が変数・関数呼び出しを許さない)。narration.ts は
 * .ts (拡張子は timeline.ts からの import 記法に合わせる) のため
 * React.createElement で組み立てる。
 */
export const line = (props: SpeechProps): ReactNode =>
  React.createElement(Speech, props);

const speechPropsOf = (
  node: ReactNode | FrameMarker,
): SpeechProps | undefined =>
  React.isValidElement(node) && node.type === Speech
    ? (node.props as SpeechProps)
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
 * 発話の列から [暗がり layer, 発話 layer] を組み立てる。node が line() の
 * 戻り値 (Speech) の item は音声キャッシュから実尺を取り、それ以外の item は
 * duration が必須 (無ければ throw)。位置 (at/after/省略) は実尺を埋めた
 * 仮 layer を resolveLayer() で解決して求める。line() item に duration が
 * 明示されていれば、位置決め・字幕の尺の両方にその値をそのまま使い、tail も
 * クランプも掛けない (書き手が明示した値を実尺で上書きしない)。明示が無い
 * line() item の字幕の尺は min(実尺 + subtitleTiming.tail, 次の item の開始
 * − 自分の開始) にクランプする (最後の item は前者のまま)。line() 以外の
 * item は kind・node・duration (fade なら in/out も) を保ったまま、at を
 * 解決済みの開始秒に置き換えて発話 layer にそのまま残す。暗がり
 * (computeBandSpans() への入力) は line() item なら字幕が消えるまで
 * (captionEnd) 出る。音声 (speechEnd) が字幕より先に終わっていても、暗がり
 * は字幕の消灯までは維持される (duration を明示して字幕を長く出した場合も
 * 同じ)。
 */
export const narration = async (
  items: readonly NarrationItem[],
  options: NarrationOptions = {},
  deps: Partial<NarrationDeps> = {},
): Promise<readonly [Layer, Layer]> => {
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
    const speech = speechPropsOf(item.node);

    if (speech) {
      const key = await voiceKey({ text: speech.text, voice: speech.voice });
      const url = staticFile(`${linePath(slug, key)}.json`);
      const cache = await waitForVoiceCache(url, resolvedDeps);

      // duration を明示した line() item は位置決めにもその値を使う
      // (実尺 (cacheDuration) は暗がりの区間の計算にだけ使う)。
      return {
        key,
        cacheDuration: cache.duration,
        positionDuration: item.duration ?? cache.duration,
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
  const bandInputs: { start: number; speechEnd: number; captionEnd: number }[] =
    [];

  resolvedItems.forEach((resolved, index) => {
    const speech = speechPropsOf(items[index].node);
    const { key, cacheDuration, positionDuration } = durations[index];
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

  return [bandLayer, speechLayer];
};
