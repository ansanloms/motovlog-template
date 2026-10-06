import React, { Fragment } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FadeGainContext, useFadeGain } from "../../modules/core/fadeGain.ts";
import { getSetup } from "../setup.ts";
import { ThemeRoot } from "../theme/index.ts";
import { isFrame } from "./frame.ts";
import {
  crossfadeGain,
  fadeGain,
  fadeOpacity,
  frameEffectsOpacity,
  toFrame,
  toFrameSpan,
  transitionFrames,
} from "./frames.ts";
import { isSample } from "./sample.ts";
import type { SampleTime } from "./sample.ts";
import type {
  FrameMarker,
  ResolvedFadeItem,
  ResolvedItem,
  ResolvedLayer,
  Timeline,
} from "./types.ts";

/** Stage が受け取るもの。 */
type Props = {
  /** timeline() が組み立てた演出アイテムの列。 */
  timeline: Timeline;
};

/** item が frame() (FrameMarker) の fade アイテムかどうかを判定する。 */
const isFrameItem = (
  item: ResolvedItem,
): item is ResolvedFadeItem & { node: FrameMarker } =>
  item.kind === "fade" && isFrame(item.node);

/**
 * Timeline の layers (最上位、または塊 (GroupNode) の内部 layers) を下
 * (index 0) から積み、layer 内の item を `<Sequence>` として並べる。fade は
 * フェード付きの `<AbsoluteFill>`、cut はフェード無しの `<AbsoluteFill>` に
 * 変換する。`crossfade` で直前と繋がる item は、その内側を `<FadeLayer>` で
 * 包み遷移区間の opacity を 0 から 1 に上げる (fade の場合は FadeLayer の
 * 外側に置き、乗算にする)。`crossfade` の `audio: true` は、入る側・出る側
 * それぞれの `<GainLayer>` で重なり区間の音量の率を等パワー曲線で交差させる
 * (出る側は次の item の `transitionIn` で特定する。crossfade は解決結果の
 * 配列に入らないため隣接する item が対になる)。`frame()` を含む layer は、
 * それより下の layer の
 * 合成結果を `<FrameEffects>` で包む (AviUtl のフレームバッファ型。塊の中に
 * `frame()` は置けない (resolveLayer が throw する) ため、groupFrom !== 0
 * の呼び出しでは現れない)。`sample()` の item は `<Sampled>` が毎フレーム
 * render を呼ぶ。塊 (`item.group`) の item は、内部 layers を再帰的に同じ
 * 関数で描く。
 *
 * item.at・item.duration は常に動画先頭からの絶対秒で持つ (塊の中の item も
 * 同じ)。groupFrom はこの layers の原点 (最上位なら 0、塊の内部ならその塊
 * 自身の絶対 from) の絶対フレームで、`<Sequence>` の from は絶対フレームを
 * 求めた後に groupFrom を引いて相対化する (二重の丸めを避けるため、秒を
 * 直接引かず、フレームに丸めた後に引く)。`sample()` の `from` も同じ相対値を
 * 渡すことで、Sequence の入れ子で `useCurrentFrame()` が塊の先頭からの
 * 0 起点になる Remotion の挙動と揃い、`SampleTime.absolute` が「item が
 * 属する塊 (最上位なら動画) の先頭からの秒」になる。
 */
const renderLayers = (
  layers: readonly ResolvedLayer[],
  fps: number,
  groupFrom: number,
): React.ReactNode => {
  let below: React.ReactNode = null;

  layers.forEach((layer, layerIndex) => {
    const frameItems = layer.filter(isFrameItem);
    const nodeItems = layer.filter((item) => !isFrameItem(item));

    const content = (
      <>
        {nodeItems.map((item, itemIndex) => {
          const { from: absoluteFrom, durationInFrames } = toFrameSpan(
            item.at,
            item.duration,
            fps,
          );
          const from = absoluteFrom - groupFrom;

          const rawNode = item.node;

          const node: React.ReactNode = item.group !== undefined
            ? (
              renderLayers(item.group.layers, fps, absoluteFrom)
            )
            : isSample(rawNode)
            ? <Sampled render={rawNode.render} from={from} fps={fps} />
            : (
              rawNode as React.ReactNode
            );

          const body = item.kind === "fade"
            ? (
              <FadeLayer
                durationInFrames={durationInFrames}
                inFrames={toFrame(item.in, fps)}
                outFrames={toFrame(item.out, fps)}
                audio={item.audio}
              >
                {node}
              </FadeLayer>
            )
            : <AbsoluteFill>{node}</AbsoluteFill>;

          // crossfade の出る側は、この layer の解決結果 (nodeItems) で
          // 自分の直後にある item の transitionIn で特定する。crossfade
          // 自体は解決結果の配列に入らないため、隣接する item が対になる。
          const overlapIn = item.transitionIn
            ? transitionFrames({
              at: item.at,
              duration: item.transitionIn.duration,
              fps,
            })
            : 0;
          const next = nodeItems[itemIndex + 1];

          const gainInFrames = item.transitionIn?.audio ? overlapIn : 0;
          const gainOutFrames = next?.transitionIn?.audio
            ? transitionFrames({
              at: next.at,
              duration: next.transitionIn.duration,
              fps,
            })
            : 0;

          const bodyWithGain = gainInFrames > 0 || gainOutFrames > 0
            ? (
              <GainLayer
                durationInFrames={durationInFrames}
                inFrames={gainInFrames}
                outFrames={gainOutFrames}
              >
                {body}
              </GainLayer>
            )
            : body;

          return (
            <Sequence
              key={itemIndex}
              from={from}
              durationInFrames={durationInFrames}
              name={`layer ${layerIndex}: ${item.kind}`}
            >
              {item.transitionIn
                ? (
                  <FadeLayer
                    durationInFrames={durationInFrames}
                    inFrames={overlapIn}
                    outFrames={0}
                    audio={false}
                  >
                    {bodyWithGain}
                  </FadeLayer>
                )
                : bodyWithGain}
            </Sequence>
          );
        })}
      </>
    );

    below = frameItems.length > 0
      ? (
        <FrameEffects items={frameItems} fps={fps}>
          {below}
        </FrameEffects>
      )
      : below;

    below = (
      <Fragment key={layerIndex}>
        {below}
        {content}
      </Fragment>
    );
  });

  return below;
};

/**
 * timeline() が組み立てた Timeline を描画する。実体は renderLayers() で、
 * 動画のドメイン (章・写真・ED 等) は知らず、ReactNode と秒だけを扱う。
 */
export const Stage: React.FC<Props> = ({ timeline }) => {
  const { fps } = timeline;

  return (
    <ThemeRoot>
      <AbsoluteFill style={{ backgroundColor: getSetup().theme.palette.black }}>
        {renderLayers(timeline.layers, fps, 0)}
      </AbsoluteFill>
    </ThemeRoot>
  );
};

/**
 * sample() の node を毎フレーム呼ぶ。`from` は Sequence の from (toFrameSpan
 * の結果) で、絶対秒 (SampleTime.absolute) の計算に使う。Sequence の内側で
 * 使うため useCurrentFrame() は 0 起点。
 */
const Sampled: React.FC<{
  render: (t: SampleTime) => React.ReactNode;
  from: number;
  fps: number;
}> = ({ render, from, fps }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {render({ frame, seconds: frame / fps, absolute: (from + frame) / fps })}
    </>
  );
};

/**
 * fade アイテムの不透明度を、Sequence 内 (0 起点) の frame から計算して当てる。
 * `audio` が true なら音量の率 (gain、fadeGain。fadeOpacity と違い両端で
 * 0 に届く) を FadeGainContext に配る (親から受け継いだ gain との乗算)。
 * false なら Provider を置かず、親の gain をそのまま子に通す。
 */
const FadeLayer: React.FC<{
  durationInFrames: number;
  inFrames: number;
  outFrames: number;
  audio: boolean;
  children: React.ReactNode;
}> = ({ durationInFrames, inFrames, outFrames, audio, children }) => {
  const frame = useCurrentFrame();
  const opacity = fadeOpacity({ frame, durationInFrames, inFrames, outFrames });
  const parentGain = useFadeGain();

  return (
    <AbsoluteFill style={{ opacity }}>
      {audio
        ? (
          <FadeGainContext.Provider
            value={parentGain *
              fadeGain({ frame, durationInFrames, inFrames, outFrames })}
          >
            {children}
          </FadeGainContext.Provider>
        )
        : children}
    </AbsoluteFill>
  );
};

/**
 * crossfade (audio: true) の重なり区間で、音量の率 (gain、crossfadeGain。
 * 等パワー曲線) を FadeGainContext に配る (親から受け継いだ gain との乗算)。
 * FadeLayer と違い opacity・AbsoluteFill は持たない (率を配るだけ)。
 */
const GainLayer: React.FC<{
  durationInFrames: number;
  inFrames: number;
  outFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, inFrames, outFrames, children }) => {
  const frame = useCurrentFrame();
  const parentGain = useFadeGain();

  return (
    <FadeGainContext.Provider
      value={parentGain *
        crossfadeGain({ frame, durationInFrames, inFrames, outFrames })}
    >
      {children}
    </FadeGainContext.Provider>
  );
};

/**
 * frame() の item がある layer で、それより下の layer の合成結果 (children)
 * を包み、opacity を frame() の item の fadeOpacity にする (現在フレーム
 * が item の区間外なら 1)。Stage は Composition の直下で描かれるため
 * useCurrentFrame() は絶対フレーム (Sequence に包まれていない)。
 */
const FrameEffects: React.FC<{
  items: readonly ResolvedFadeItem[];
  fps: number;
  children: React.ReactNode;
}> = ({ items, fps, children }) => {
  const frame = useCurrentFrame();
  const opacity = frameEffectsOpacity({ frame, fps, items });

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
