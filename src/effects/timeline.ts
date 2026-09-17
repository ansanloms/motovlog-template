import { fps } from "../theme/timing.ts";
import { isAnchor } from "./anchor.ts";
import { isFrame } from "./frame.ts";
import { toFrame, transitionFrames } from "./frames.ts";
import { isGroup } from "./group.ts";
import type {
  Anchor,
  Item,
  Layer,
  PendingCutItem,
  ResolvedItem,
  Timeline,
  Transition,
} from "./types.ts";

/** timeline() の幅の既定値 (px)。 */
export const DEFAULT_WIDTH = 1920;

/** timeline() の高さの既定値 (px)。 */
export const DEFAULT_HEIGHT = 1080;

/** timeline() に渡すオプション。 */
type TimelineOptions = {
  /** 幅 (px)。既定は DEFAULT_WIDTH。 */
  width?: number;
  /** 高さ (px)。既定は DEFAULT_HEIGHT。 */
  height?: number;
};

/**
 * layer が Anchor の未解決参照でブロックされたときに resolveLayer() が
 * 巻き戻す位置。ブロックされた item (index) より手前の entries は既に
 * resolved へ書き込み済みで確定しているため、次のラウンドはここから
 * 再開する (layer の先頭からやり直さない)。cursor (直前までのカーソル
 * 位置) と prev (直前の解決済み item) は result から導出できる
 * (prev = result の末尾、無ければ null。cursor = prev があればその
 * at + duration、無ければ 0) ため、この状態には持たない。
 */
type LayerResumeState = {
  /** 再開する entry の index (ブロックされた item そのもの)。 */
  readonly index: number;
  /** ブロックされた item の直前で保留中だった crossfade。無ければ null。 */
  readonly pending: Transition | null;
  /** ブロックされた item より手前で解決済みの item (元の配列順)。 */
  readonly result: readonly ResolvedItem[];
};

/**
 * Anchor の参照先がまだ解決されていないことを示す内部エラー。timeline() が
 * 層をまたいだラウンド (依存順序で解決するための再試行) を回すための印で、
 * resolveLayer() の呼び出し元 (narration() 等) には漏らさない (呼び出し元は
 * Error として素通しで受け取り、通常の throw と区別しない)。resumeState は
 * resolveAnchor() が投げる時点ではまだ無く (undefined)、resolveLayer() が
 * item ごとの catch でブロック位置の状態を積んでから timeline() へ渡す。
 */
class AnchorBlockedError extends Error {
  readonly resumeState?: LayerResumeState;

  constructor(message: string, resumeState?: LayerResumeState) {
    super(message);
    this.name = "AnchorBlockedError";
    this.resumeState = resumeState;
  }
}

/**
 * 塊 (GroupNode) の layers に直接置かれた item (入れ子の塊の中の item を
 * 含む) をすべて集める。塊の中の item がアンカーで参照できる相手 (塊の外の
 * item を参照したら throw する) を判定する membership に使う。塊の
 * 構造は静的 (group() の呼び出し時点で確定) なので、解決前にまとめて
 * 集められる。
 */
const collectGroupMembers = (
  layers: readonly Layer[],
  members: Set<Item | PendingCutItem>,
): void => {
  for (const layer of layers) {
    for (const entry of layer) {
      if (entry.kind === "crossfade") {
        continue;
      }

      members.add(entry);

      if (entry.source !== undefined) {
        members.add(entry.source);
      }

      if (isGroup(entry.node)) {
        collectGroupMembers(entry.node.layers, members);
      }
    }
  }
};

/** layers (層の列) 全体の終端 (item.at + item.duration の最大値)。 */
const maxEnd = (layers: readonly ResolvedItem[][]): number =>
  Math.max(
    ...layers.flatMap((layer) => layer.map((item) => item.at + item.duration)),
  );

/**
 * layer ごとに item の位置・尺を解決する。`at` (絶対秒または Anchor)・
 * `after` (直前の終端からの相対秒)・省略 (直前の終端に連結) のいずれかで
 * 位置を、`duration` (秒数) または `until` (終端の絶対秒または Anchor) の
 * いずれかで尺を解決する。`at` と `after`、`duration` と `until` の同時
 * 指定、duration と until をどちらも指定していない場合 (node が塊
 * (GroupNode) なら省略可、後述)、at/after/until の不正値 (非有限・負)、
 * 直前の item との時間順違反があれば throw する。duration は有限の正で、
 * フレームに丸めた終端が開始より後になる長さでなければならない。重なり
 * 判定はフレーム単位 (round(秒 × fps)) で行い、秒の丸め誤差による誤検出を
 * 避ける。
 *
 * layer 内の item と item の間に置かれた Transition (crossfade) は、直後
 * の item の開始を「直前の item の終端 − 遷移の尺」に固定する (layer 内
 * 非重複の唯一の例外)。resolved は layer・呼び出しをまたいで参照同一性で
 * 解決済み item を引くための表で、Anchor (start/end、at/until) の解決に
 * 使う。Anchor の参照先が resolved・このレイヤーの解決中の途中結果の
 * どちらにも見つからなければ AnchorBlockedError を throw する (未解決を
 * 示す印で、timeline() が別の layer を先に解決してから再試行する)。この
 * とき、ブロックされた item より手前の entries は既に確定しているため、
 * その解決結果 (item.source の登録を含む) を resolved へ先に書き込み、
 * 再開に必要な状態 (index・保留中の crossfade・ここまでの result。cursor
 * と直前の item は result から導出する) を AnchorBlockedError に積んで
 * throw する (ブロックされた item 自体は登録しない)。timeline() は次の
 * ラウンドでその状態を resume に渡し、resolveLayer() は layer の先頭から
 * ではなくそこから解決を続ける。
 * duration と until の同時指定等、AnchorBlockedError 以外の throw では
 * resolved に何も書き込まない (この場合は timeline() 全体が throw で
 * 終わるため、書き込まれないこと自体に副作用は無い)。item に source
 * (narration() が入力 item から作った item に付ける、元の入力 item への
 * 参照) があれば、その item の解決結果を source にも登録し、start()/end()
 * で元の item を参照できるようにする (同じ source が 2 箇所にあれば
 * throw する)。narration() が発話の実尺で duration を埋めた仮 layer の
 * 解決にも使うため export する。resume は timeline() が層をまたいだ再試行
 * で使う内部状態で、narration() 等の一発呼び出しでは省略する (layer の
 * 先頭から解決する)。
 *
 * base・membership・layerLabel は塊 (GroupNode) の内部 layer を解決する
 * ときに timeline() (resolveGroupLayers 経由) が渡す。base は塊の先頭の
 * 絶対秒で、塊の中の item の数値 `at` は base を足した絶対秒として解決する
 * (`after`・省略はカーソル起点が base になることで同じ規則のまま効く)。
 * membership を渡すと (塊の中の解決)、Anchor の参照先が membership に無い
 * item (塊の外の item) を指すと即時 throw する (再試行しない。塊の中の
 * item は塊の外の item を参照できないため)。layerLabel はエラーメッセージ
 * の "layer N" 相当の文字列で、塊の中では入れ子の位置を表す文字列になる
 * (省略時は `layer ${layerIndex}`)。
 */
export const resolveLayer = (
  layer: Layer,
  layerIndex: number,
  resolved: Map<Item | PendingCutItem, ResolvedItem>,
  resume?: LayerResumeState,
  base = 0,
  membership?: Set<Item | PendingCutItem>,
  layerLabel: string = `layer ${layerIndex}`,
): ResolvedItem[] => {
  const local = new Map<Item | PendingCutItem, ResolvedItem>();
  const lookup = (key: Item | PendingCutItem): ResolvedItem | undefined =>
    local.get(key) ?? resolved.get(key);
  const hasEither = (key: Item | PendingCutItem): boolean =>
    local.has(key) || resolved.has(key);

  const resolveAnchor = (
    anchor: Anchor,
    entryIndex: number,
    field: "at" | "until",
  ): number => {
    if (membership !== undefined && !membership.has(anchor.item)) {
      throw new Error(
        `timeline: ${layerLabel} の item ${entryIndex} の ${field} (Anchor): 塊の中の item は塊の外の item を参照できません`,
      );
    }

    const ref = lookup(anchor.item);

    if (ref === undefined) {
      throw new AnchorBlockedError(
        `timeline: ${layerLabel} の item ${entryIndex} の ${field} (Anchor) の参照先を解決できません`,
      );
    }

    const refBase = anchor.edge === "start" ? ref.at : ref.at + ref.duration;

    return refBase + anchor.offset;
  };

  const result: ResolvedItem[] = resume ? [...resume.result] : [];
  let prev: ResolvedItem | null = result[result.length - 1] ?? null;
  let cursor = prev ? prev.at + prev.duration : base;
  let pending: Transition | null = resume?.pending ?? null;

  for (
    let entryIndex = resume?.index ?? 0;
    entryIndex < layer.length;
    entryIndex++
  ) {
    const entry = layer[entryIndex];

    if (entry.kind === "crossfade") {
      if (prev === null) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) が先頭にあります`,
        );
      }

      if (pending !== null) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) が連続しています`,
        );
      }

      if (prev.kind === "fade" && prev.out > 0) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) の直前の item に out は付けられません (dissolve と fade-out は排他)`,
        );
      }

      const { duration } = entry;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) の duration が不正です (${duration})`,
        );
      }

      if (duration > prev.duration) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) の duration (${duration}) が直前の item の尺 (${prev.duration}) より長いです`,
        );
      }

      if (transitionFrames({ at: cursor - duration, duration, fps }) < 1) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) の duration (${duration}) が 1 フレームに満たない`,
        );
      }

      const prevStartFrame = toFrame(prev.at, fps);
      const prevVisibleFromFrame = prev.transitionIn
        ? toFrame(prev.at + prev.transitionIn.duration, fps)
        : prevStartFrame;
      const nextStartFrame = toFrame(cursor - duration, fps);

      if (nextStartFrame < prevVisibleFromFrame) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) の直後の item の開始 (フレーム ${nextStartFrame}) が直前の item が単独で見え始めるフレーム (${prevVisibleFromFrame}) より前です`,
        );
      }

      if (isFrame(prev.node)) {
        throw new Error(
          `timeline: ${layerLabel} の crossfade (index ${entryIndex}) を frame() の item に接続できません`,
        );
      }

      pending = entry;
      continue;
    }

    const item = entry;
    const pendingBeforeItem = pending;

    if (hasEither(item)) {
      throw new Error(
        `timeline: ${layerLabel} の item ${entryIndex} は既に別の場所で使われています (同じ item を複数箇所に置けません)`,
      );
    }

    try {
      const {
        at,
        after,
        duration: explicitDuration,
        until,
        source,
        ...rest
      } = item;

      const groupNode = isGroup(item.node) ? item.node : undefined;

      if (explicitDuration !== undefined && until !== undefined) {
        throw new Error(
          `timeline: ${layerLabel} の item ${entryIndex} は duration と until を同時に指定できません`,
        );
      }

      if (
        explicitDuration === undefined &&
        until === undefined &&
        groupNode === undefined
      ) {
        throw new Error(
          `timeline: ${layerLabel} の item ${entryIndex} は duration か until のどちらかが必要です`,
        );
      }

      let start: number;
      let transitionIn: Transition | undefined;

      if (pending !== null) {
        if (at !== undefined || after !== undefined) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} は crossfade の直後に at/after を指定できません`,
          );
        }

        if (isFrame(item.node)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} (frame()) を crossfade の対象にできません`,
          );
        }

        // この分岐には後段の 1 フレーム検査・時間順検査を置かない。crossfade
        // 側で duration が正かつ 1 フレーム以上、下段で item 側の duration
        // (until 経由でも) が >= pending.duration であることを検査済みのため、
        // start (= cursor - pending.duration) から start + duration までは
        // 必ず 1 フレーム以上ある。start も定義上 cursor より前
        // (pending.duration > 0) なので時間順違反にもならない。
        start = cursor - pending.duration;

        transitionIn = pending;
        pending = null;
      } else {
        if (at !== undefined && after !== undefined) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} は at と after を同時に指定できません`,
          );
        }

        let resolvedAt: number | undefined;

        if (isAnchor(at)) {
          resolvedAt = resolveAnchor(at, entryIndex, "at");

          if (!Number.isFinite(resolvedAt) || resolvedAt < 0) {
            throw new Error(
              `timeline: ${layerLabel} の item ${entryIndex} の at が不正です (${resolvedAt})`,
            );
          }
        } else if (at !== undefined) {
          if (!Number.isFinite(at) || at < 0) {
            throw new Error(
              membership !== undefined
                ? `timeline: ${layerLabel} の item ${entryIndex} の at が不正です (${at})。塊の先頭より前の at は指定できません`
                : `timeline: ${layerLabel} の item ${entryIndex} の at が不正です (${at})`,
            );
          }

          resolvedAt = base + at;
        }

        if (after !== undefined && (!Number.isFinite(after) || after < 0)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} の after が不正です (${after})`,
          );
        }

        start = resolvedAt ?? cursor + (after ?? 0);
      }

      // groupNode の内部 layers を解決する前に until の Anchor も解決する
      // (at の Anchor は上で解決済み)。at・until のどちらの Anchor が
      // ブロックされても、内部 layers の commit (resolved への書き込み) より
      // 前に throw できるようにするため (#1: 内部 commit の後にブロックすると
      // 再試行時に「既に別の場所で使われています」になる)。
      let untilValue: number | undefined;

      if (until !== undefined) {
        untilValue = isAnchor(until)
          ? resolveAnchor(until, entryIndex, "until")
          : until;

        if (!Number.isFinite(untilValue)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} の until が不正です (${untilValue})`,
          );
        }
      }

      let innerLayers: ResolvedItem[][] | undefined;
      let contentEnd: number | undefined;

      if (isFrame(item.node)) {
        if (membership !== undefined) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex}: 塊の中に frame() は置けません`,
          );
        }

        if (layerIndex === 0) {
          throw new Error(
            `timeline: layer 0 に frame() の item は置けません (下の layer が無いため)`,
          );
        }
      }

      if (groupNode !== undefined) {
        const groupMembership = new Set<Item | PendingCutItem>();

        collectGroupMembers(groupNode.layers, groupMembership);

        const groupLabel = `${layerLabel} の item ${entryIndex} (塊)`;

        innerLayers = resolveGroupLayers(
          groupNode.layers,
          start,
          resolved,
          groupMembership,
          groupLabel,
        );
        contentEnd = maxEnd(innerLayers);
      }

      let duration: number;

      if (explicitDuration !== undefined) {
        if (!Number.isFinite(explicitDuration) || explicitDuration <= 0) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} の duration が不正です (${explicitDuration})`,
          );
        }

        duration = explicitDuration;
      } else if (untilValue !== undefined) {
        duration = untilValue - start;
      } else {
        // groupNode (duration/until の省略が許される唯一のケース)。
        duration = contentEnd! - start;
      }

      if (
        contentEnd !== undefined &&
        toFrame(contentEnd, fps) > toFrame(start + duration, fps)
      ) {
        throw new Error(
          `timeline: ${layerLabel} の item ${entryIndex}: 塊の中の item が塊の尺を超えています`,
        );
      }

      if (
        rest.kind === "fade" &&
        explicitDuration === undefined &&
        rest.in + rest.out > duration
      ) {
        const durationSource = until !== undefined ? "until" : "塊の内容";

        throw new Error(
          `timeline: ${layerLabel} の item ${entryIndex} の in (${rest.in}) + out (${rest.out}) が ${durationSource} から求めた duration (${duration}) を超えています`,
        );
      }

      if (transitionIn !== undefined) {
        if (duration < transitionIn.duration) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} の尺 (${duration}) が crossfade の尺 (${transitionIn.duration}) より短いです`,
          );
        }
      } else {
        if (toFrame(start + duration, fps) <= toFrame(start, fps)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} (start ${start}, duration ${duration}) が 1 フレームに満たない。フレームに丸めると開始と終端が同じになります`,
          );
        }

        if (toFrame(start, fps) < toFrame(cursor, fps)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} (start ${start}) が直前の item の終端 (${cursor}) より前です。layer 内の item は時間順に並べる`,
          );
        }
      }

      const resolvedItem = {
        ...rest,
        at: start,
        duration,
        ...(transitionIn !== undefined ? { transitionIn } : {}),
        ...(innerLayers !== undefined
          ? { group: { layers: innerLayers } }
          : {}),
      } as ResolvedItem;

      local.set(item, resolvedItem);

      if (source !== undefined) {
        if (hasEither(source)) {
          throw new Error(
            `timeline: ${layerLabel} の item ${entryIndex} の source は既に別の item の source として使われています`,
          );
        }

        local.set(source, resolvedItem);
      }

      result.push(resolvedItem);
      prev = resolvedItem;
      cursor = start + duration;
    } catch (error) {
      if (!(error instanceof AnchorBlockedError)) {
        throw error;
      }

      for (const [key, value] of local) {
        resolved.set(key, value);
      }

      throw new AnchorBlockedError(error.message, {
        index: entryIndex,
        pending: pendingBeforeItem,
        result: [...result],
      });
    }
  }

  if (pending !== null) {
    throw new Error(`timeline: ${layerLabel} の crossfade が末尾にあります`);
  }

  for (const [key, value] of local) {
    resolved.set(key, value);
  }

  return result;
};

/**
 * layers (最上位の timeline() の layers、または塊の内部 layers) を依存順の
 * ラウンドで解決する共通の駆動部。base・membership は resolveLayer() に
 * そのまま渡す (塊の中の解決ではそれぞれ塊の先頭の絶対秒・塊の membership、
 * 最上位では 0・undefined)。1 ラウンドで誰も進展しなければ (resolved への
 * 新規登録が無い) throw する (参照先がどの layer にも無い、または循環して
 * いる)。
 */
const resolveLayersInRounds = (
  layers: readonly Layer[],
  resolved: Map<Item | PendingCutItem, ResolvedItem>,
  base: number,
  membership: Set<Item | PendingCutItem> | undefined,
  layerLabel: (layerIndex: number) => string,
): ResolvedItem[][] => {
  const resolvedLayers: ResolvedItem[][] = new Array(layers.length);
  const resumeStates = new Map<number, LayerResumeState>();

  let remaining = layers.map((_, layerIndex) => layerIndex);
  let lastBlockedError: unknown;

  while (remaining.length > 0) {
    const stillBlocked: number[] = [];
    const resolvedSizeBefore = resolved.size;

    for (const layerIndex of remaining) {
      try {
        resolvedLayers[layerIndex] = resolveLayer(
          layers[layerIndex],
          layerIndex,
          resolved,
          resumeStates.get(layerIndex),
          base,
          membership,
          layerLabel(layerIndex),
        );
        resumeStates.delete(layerIndex);
      } catch (error) {
        if (!(error instanceof AnchorBlockedError)) {
          throw error;
        }

        stillBlocked.push(layerIndex);
        lastBlockedError = error;

        if (error.resumeState !== undefined) {
          resumeStates.set(layerIndex, error.resumeState);
        }
      }
    }

    if (resolved.size === resolvedSizeBefore) {
      const message =
        lastBlockedError instanceof Error
          ? lastBlockedError.message
          : String(lastBlockedError);

      throw new Error(
        `${message} (参照先がどの layer にも置かれていないか、参照が循環しています。同じ layer の後ろの item への参照も循環になります)`,
      );
    }

    remaining = stillBlocked;
  }

  return resolvedLayers;
};

/**
 * 塊 (GroupNode) の内部 layers を base (塊の先頭の絶対秒) を原点として
 * 解決する。resolveLayer() の中から呼ぶため export しない。塊の中の item は
 * membership の外の item を参照できない (resolveAnchor が即時 throw する。
 * ブロックして再試行しない、というのは「塊の外の item はこのラウンドの
 * 対象に無いので待っても解決しない」ことを指す)。塊の中の item どうしの
 * アンカーは、最上位と同じ依存順のラウンドで解決する。
 */
const resolveGroupLayers = (
  layers: readonly Layer[],
  base: number,
  resolved: Map<Item | PendingCutItem, ResolvedItem>,
  membership: Set<Item | PendingCutItem>,
  groupLabel: string,
): ResolvedItem[][] =>
  resolveLayersInRounds(
    layers,
    resolved,
    base,
    membership,
    (layerIndex) => `${groupLabel} の layer ${layerIndex}`,
  );

/**
 * timeline.ts の layer の列から Timeline を組み立てる。layer = z 順 (配列
 * の後ろが上)。layer 内は時間が重ならず時間順に並び (crossfade の直後の
 * item のみ例外)、位置は `at`/`after`/省略 (直前の item の終端に連結) の
 * いずれかで解決する。Anchor (start()/end()) はどの layer に置かれた item
 * でも参照できるが、依存関係の順で解決する必要があるため、`timeline()` は
 * 全 layer をまず配列順に 1 ラウンド試し、Anchor の参照先が未解決で
 * ブロックされた layer だけを次のラウンドに残して再試行する (この駆動部は
 * resolveLayersInRounds で、塊の内部 layers の解決にも使う)。ブロックされた
 * layer も、ブロックされた item より手前の entries は resolveLayer() が
 * resolved へ先に書き込んでいるため、他の layer がその手前の item を
 * 参照していれば次のラウンドで解決できる (layer 丸ごとが未コミットのままだと
 * 起きる、循環していないのに循環扱いされる誤検出を避ける)。1 ラウンドで
 * どの layer も 1 件も進展しなければ (resolved への新規登録が無い。参照先が
 * どの layer にも置かれていない、または参照が循環している。同じ layer の
 * 後ろの item への参照も循環になる) throw する。戻り値の `layers` は解決順
 * ではなく元の配列順を保つ。durationSec は全 layer 全 item の
 * `at + duration` の最大値 (塊の item は塊自身の at + duration で数える)。
 * layers が空、または空の layer があれば throw する。fps は theme の定数で、
 * convert と composition が同じ値を使う (ADR-0003)。
 */
export const timeline = (
  layers: readonly Layer[],
  options: TimelineOptions = {},
): Timeline => {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;

  if (layers.length === 0) {
    throw new Error("timeline: layers が空です");
  }

  layers.forEach((layer, layerIndex) => {
    if (layer.length === 0) {
      throw new Error(`timeline: layer ${layerIndex} が空です`);
    }
  });

  const resolved = new Map<Item | PendingCutItem, ResolvedItem>();

  const resolvedLayers = resolveLayersInRounds(
    layers,
    resolved,
    0,
    undefined,
    (layerIndex) => `layer ${layerIndex}`,
  );

  const durationSec = maxEnd(resolvedLayers);

  return { fps, width, height, durationSec, layers: resolvedLayers };
};
