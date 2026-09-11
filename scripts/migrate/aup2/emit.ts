// 中間表現 (plan.ts) を projects/<slug>/timeline.ts のソースにする (#5)。
//
// 出力はサンプル timeline (projects/00000000-sample/timeline.ts) と同じ構造に
// する。import は lib の 5 入口だけを通し (ADR-0012)、layer の並びは
// 走行映像 → OP・章タイトル・写真紹介・ED → 立ち絵 → BGM → frame() →
// narration() の 2 layer。秒数は plan.ts が丸めた値をそのまま書く。
//
// 整形は prettier に任せる (emitTimeline() は整形前のソースを返す純粋関数、
// formatTimeline() が prettier を掛ける)。

import prettier from "prettier";
import type {
  FigurePlan,
  FramePlan,
  NarrationPlan,
  ScenePlan,
  TimelinePlan,
  VideoPlan,
  VolumePlan,
} from "./plan.ts";

/** 生成物の先頭に置く但し書き。 */
const HEADER = [
  "// このファイルは scripts/migrate/aup2 が AviUtl ExEdit2 の project ファイル",
  "// (.aup2) から生成した。編集してよいが、再生成すると上書きされる。写像の",
  "// 規則と再生成の手順は scripts/migrate/README.md にある。",
].join("\n");

/** 数値を秒として書く (小数第 3 位まで)。 */
const num = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;

  return String(Object.is(rounded, -0) ? 0 : rounded);
};

/** 文字列をソース中のリテラルにする。 */
const str = (value: string): string => JSON.stringify(value);

/** volume (一定値または折れ線) を書く。 */
const volumeSource = (volume: VolumePlan): string => {
  if (typeof volume === "number") {
    return num(volume);
  }

  const points = volume
    .map((point) => `{ at: ${num(point.at)}, volume: ${num(point.volume)} }`)
    .join(", ");

  return `[${points}]`;
};

/** cut()/fade() のオプションを書く。in/out がどちらも 0 なら cut() にする。 */
const placed = (
  node: string,
  options: {
    readonly at?: string;
    readonly duration?: string;
    readonly in?: number;
    readonly out?: number;
  },
): string => {
  const fields = [
    ...(options.at !== undefined ? [`at: ${options.at}`] : []),
    ...(options.duration !== undefined
      ? [`duration: ${options.duration}`]
      : []),
  ];

  if (!options.in && !options.out) {
    return `cut(${node}, { ${fields.join(", ")} })`;
  }

  return `fade(${node}, { ${[
    ...fields,
    ...(options.in ? [`in: ${num(options.in)}`] : []),
    ...(options.out ? [`out: ${num(options.out)}`] : []),
  ].join(", ")} })`;
};

/** 走行映像 1 本を const 宣言として書く。 */
const videoSource = (video: VideoPlan): string => {
  const node = `video({ src: asset(${str(video.src)}), trimBefore: ${num(
    video.trimBefore,
  )}, volume: ${volumeSource(video.volume)} })`;

  return `const ${video.ref} = ${placed(node, {
    // crossfade の直後の item に at は書けない (DSL が開始を固定する)。
    at: video.crossfadeIn === undefined ? num(video.at) : undefined,
    duration: num(video.duration),
    in: video.in,
    out: video.out,
  })};`;
};

/** OP・章タイトル・写真紹介・ED を書く。 */
const sceneSource = (scene: ScenePlan, character: string): string => {
  if (scene.kind === "opening") {
    const node = `thumbnail({ photo: asset(${str(scene.photo)}), badge: ${str(
      scene.badge,
    )}, title: ${str(scene.title)}, character: ${character} })`;

    return placed(node, {
      at: num(scene.at),
      duration: "openingTiming.duration",
    });
  }

  if (scene.kind === "chapter") {
    const node = `chapter({ title: ${str(scene.title)}, subtitle: ${str(
      scene.subtitle,
    )} })`;

    return `fade(${node}, { at: ${num(
      scene.at,
    )}, duration: chapterDurationSec, in: chapterTiming.fade, out: chapterTiming.fade })`;
  }

  if (scene.kind === "photo") {
    const photos = scene.photos
      .map((photo) => `asset(${str(photo)})`)
      .join(", ");

    return placed(`photoShowcase({ photos: [${photos}] })`, {
      at: num(scene.at),
      duration: num(scene.duration),
    });
  }

  const { ending } = scene;
  const credits = ending.credits
    .map(
      (credit) =>
        `{ ${Object.entries(credit)
          .map(([key, value]) => `${str(key)}: ${str(value)}`)
          .join(", ")} }`,
    )
    .join(", ");

  const node = [
    "ending({",
    `title: ${str(ending.title)},`,
    `subtitle: ${str(ending.subtitle)},`,
    "date: {",
    `from: Temporal.ZonedDateTime.from(${str(ending.date.from)}),`,
    `to: Temporal.ZonedDateTime.from(${str(ending.date.to)}),`,
    "},",
    `distance: ${num(ending.distance)},`,
    `ridingTime: Temporal.Duration.from({ hours: ${num(
      ending.ridingTime.hours,
    )}, minutes: ${num(ending.ridingTime.minutes)} }),`,
    `routes: [${ending.routes.map((route) => str(route)).join(", ")}],`,
    `credits: [${credits}],`,
    "})",
  ].join("\n");

  return `cut(${node}, { at: end(${scene.anchor}, -endingTiming.duration), duration: endingTiming.duration })`;
};

/**
 * 立ち絵 1 区間を書く。speech は narration() の戻り値を参照する。発話が
 * 1 本も無い project では `const n` を書かないため、空配列を渡す。
 */
const figureSource = (
  figure: FigurePlan,
  character: string,
  speech: string,
): string =>
  placed(
    `figure(${character}, { expression: ${str(
      figure.expression,
    )}, speech: ${speech}, side: ${str(figure.side)} })`,
    {
      at: num(figure.at),
      duration: num(figure.duration),
      in: figure.in,
      out: figure.out,
    },
  );

/** frame() のフェード 1 区間を書く。 */
const frameSource = (item: FramePlan): string => {
  if (item.opening) {
    return `fade(frame(), { at: ${num(
      item.at,
    )}, duration: openingTiming.fadeIn, in: openingTiming.fadeIn })`;
  }

  return placed("frame()", {
    at: num(item.at),
    duration: num(item.duration),
    in: item.in,
    out: item.out,
  });
};

/** 発話の位置指定 (`at` か `after` のどちらか一方)。 */
const narrationPlacement = (item: NarrationPlan): string =>
  item.at !== undefined
    ? `at: ${num(item.at)}`
    : `after: ${num(item.after ?? 0)}`;

/** 発話 (または声の無い字幕) 1 件を書く。 */
const narrationSource = (item: NarrationPlan, character: string): string => {
  const placement = narrationPlacement(item);

  if (item.kind === "subtitle") {
    return `cut(subtitle({ text: ${str(item.text)} }), { ${placement}, duration: ${num(
      item.duration,
    )} })`;
  }

  const fields = [
    `text: ${str(item.text)}`,
    `by: ${character}`,
    ...(item.expression !== undefined
      ? [`expression: ${str(item.expression)}`]
      : []),
  ];

  return `cut(line({ ${fields.join(", ")} }), { ${placement} })`;
};

/**
 * import 文をまとめて書く (使うものだけ)。利用側 (projects/**) が見てよい
 * のは lib の 5 入口だけなので (ADR-0012)、compositions も theme も
 * index から引く。
 */
const importsSource = (plan: TimelinePlan): string => {
  const hasOpening = plan.scenes.some((scene) => scene.kind === "opening");
  const hasChapter = plan.scenes.some((scene) => scene.kind === "chapter");
  const hasPhoto = plan.scenes.some((scene) => scene.kind === "photo");
  const hasEnding = plan.scenes.some((scene) => scene.kind === "ending");
  const hasSubtitle = plan.narration.some((item) => item.kind === "subtitle");
  const hasLine = plan.narration.some((item) => item.kind === "line");

  const components = [
    ...(plan.audios.length > 0 ? ["audio"] : []),
    ...(hasChapter ? ["chapter"] : []),
    ...(hasEnding ? ["ending"] : []),
    ...(hasPhoto ? ["photoShowcase"] : []),
    ...(hasSubtitle ? ["subtitle"] : []),
    ...(plan.videos.length > 0 ? ["video"] : []),
  ];

  const effects = [
    ...(plan.videos.some((video) => video.crossfadeIn !== undefined)
      ? ["crossfade"]
      : []),
    "cut",
    ...(hasEnding ? ["end"] : []),
    "fade",
    ...(plan.frames.length > 0 ? ["frame"] : []),
    "timeline",
  ];

  const compositions = [
    ...(plan.figures.length > 0 ? ["figure"] : []),
    ...(hasLine ? ["line"] : []),
    ...(plan.narration.length > 0 ? ["narration"] : []),
    ...(hasOpening ? ["thumbnail"] : []),
  ];

  const theme = [
    ...(hasChapter ? ["chapterDurationSec", "chapterTiming"] : []),
    ...(hasEnding ? ["endingTiming"] : []),
    ...(hasOpening || plan.frames.some((item) => item.opening)
      ? ["openingTiming"]
      : []),
  ];

  return [
    `import { staticFile } from "remotion";`,
    `import { ${plan.character} } from "../../characters/${plan.character}.ts";`,
    ...(components.length > 0
      ? [
          `import { ${components.join(", ")} } from "../../src/components/index.tsx";`,
        ]
      : []),
    ...(compositions.length > 0
      ? [
          `import { ${compositions.join(", ")} } from "../../src/compositions/index.ts";`,
        ]
      : []),
    `import { ${effects.join(", ")} } from "../../src/effects/index.ts";`,
    ...(theme.length > 0
      ? [`import { ${theme.join(", ")} } from "../../src/theme/index.ts";`]
      : []),
  ].join("\n");
};

/**
 * 中間表現を timeline.ts のソース (整形前) にする。layer の並びは
 * 走行映像 → OP・章タイトル・写真紹介・ED → 立ち絵 → BGM → frame() →
 * narration() の 2 layer。走行映像は ED のアンカー (end()) に使うため
 * const に取る。
 */
export const emitTimeline = (plan: TimelinePlan): string => {
  const { character } = plan;
  // 発話が 1 本も無ければ narration() を呼ばないため、立ち絵には空の
  // speech を渡す (口パク・表情の切り替えは起きず、表情は初期値のまま)。
  const speech = plan.narration.length > 0 ? "n.speech" : "[]";

  const videoLayer = plan.videos
    .flatMap((video) => [
      ...(video.crossfadeIn !== undefined
        ? [`crossfade({ duration: ${num(video.crossfadeIn)} })`]
        : []),
      video.ref,
    ])
    .join(",\n");

  const layers = [
    `// layer 0: 走行映像\n[\n${videoLayer},\n]`,
    ...(plan.scenes.length > 0
      ? [
          `// layer 1: OP・章タイトル・写真紹介・ED\n[\n${plan.scenes
            .map((scene) => sceneSource(scene, character))
            .join(",\n")},\n]`,
        ]
      : []),
    ...(plan.figures.length > 0
      ? [
          `// layer 2: 立ち絵\n[\n${plan.figures
            .map((figure) => figureSource(figure, character, speech))
            .join(",\n")},\n]`,
        ]
      : []),
    ...(plan.audios.length > 0
      ? [
          `// layer 3: BGM\n[\n${plan.audios
            .map((item) =>
              placed(
                `audio({ src: staticFile(${str(
                  item.src,
                )}), trimBefore: ${num(item.trimBefore)}, volume: ${volumeSource(
                  item.volume,
                )} })`,
                { at: num(item.at), duration: num(item.duration) },
              ),
            )
            .join(",\n")},\n]`,
        ]
      : []),
    ...(plan.frames.length > 0
      ? [
          `// layer 4: 下の layer の合成結果に掛ける黒からの立ち上がり・黒落ち\n[\n${plan.frames
            .map(frameSource)
            .join(",\n")},\n]`,
        ]
      : []),
    ...(plan.narration.length > 0
      ? ["// layer 5・6: 暗がりと発話 (narration() の戻り値)\n...n.layers"]
      : []),
  ];

  const body = [
    HEADER,
    "",
    importsSource(plan),
    "",
    `const asset = (path: string) => staticFile(\`projects/${plan.slug}/\${path}\`);`,
    "",
    ...plan.videos.map(videoSource),
    "",
    ...(plan.narration.length > 0
      ? [
          `const n = await narration([\n${plan.narration
            .map((item) => narrationSource(item, character))
            .join(",\n")},\n]);`,
          "",
        ]
      : []),
    `export default timeline([\n${layers.join(",\n")},\n]);`,
    "",
  ];

  return body.join("\n");
};

/** 生成したソースを prettier で整形する (リポジトリの .prettierrc に従う)。 */
export const formatTimeline = async (
  source: string,
  filepath: string,
): Promise<string> => {
  const options = await prettier.resolveConfig(filepath);

  return prettier.format(source, {
    ...options,
    filepath,
    parser: "typescript",
  });
};
