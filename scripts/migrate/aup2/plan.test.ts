import { describe, expect, it } from "vitest";
import { parseAup2 } from "./parse.ts";
import { parseCredits, planTimeline, volumePlan } from "./plan.ts";
import type { MigrateConfig } from "./plan.ts";

/**
 * 小さな .aup2 (30fps)。走行映像 2 本 (間にクロスフェード)、BGM、写真紹介、
 * 発話 1 本、声の無い字幕 1 本、ED のクレジット、立ち絵、帯、フレームバッファ
 * を 1 つずつ持つ。
 */
const FIXTURE = [
  "[scene.0]",
  "video.rate=30",
  "[1]",
  "layer=1",
  "frame=0,299",
  "[1.0]",
  "effect.name=動画ファイル",
  "再生位置=2.000,12.000,再生範囲,0",
  "ファイル=C:\\movie\\assets\\movies\\A.mp4",
  "[1.1]",
  "effect.name=映像再生",
  "音量=50.00",
  "[1.2]",
  "effect.name=フェード",
  "イン=0.50",
  "アウト=0.00",
  "[1.3]",
  "effect.name=音量フェード",
  "イン=1.00",
  "アウト=0.00",
  "[2]",
  "layer=1",
  "frame=300,899",
  "[2.0]",
  "effect.name=動画ファイル",
  "再生位置=0.000,20.000,再生範囲,0",
  "ファイル=C:\\movie\\assets\\movies\\B.mp4",
  "[2.1]",
  "effect.name=映像再生",
  "音量=100.00",
  "[3]",
  "layer=3",
  "frame=280,309",
  "[3.0]",
  "effect.name=シーンチェンジ",
  "種類=クロスフェード",
  "[4]",
  "layer=2",
  "frame=0,299",
  "[4.0]",
  "effect.name=音声ファイル",
  "再生位置=0.000,10.000,再生範囲,0",
  "ファイル=C:\\movie\\assets\\m1.wav",
  "[4.1]",
  "effect.name=音声再生",
  "音量=20.00",
  "[4.2]",
  "effect.name=音量フェード",
  "イン=0.00",
  "アウト=0.50",
  "[5]",
  "layer=4",
  "frame=240,299",
  "[5.0]",
  "effect.name=画像ファイル",
  "ファイル=C:\\movie\\assets\\images\\P1.jpg",
  "[6]",
  "layer=5",
  "frame=90,119",
  "group=1",
  "[6.0]",
  "effect.name=音声ファイル",
  "再生位置=0.000,1.000,再生範囲,0",
  "ファイル=C:\\movie\\assets\\lines\\001.wav",
  "[7]",
  "layer=9",
  "frame=90,125",
  "[7.0]",
  "effect.name=テキスト",
  "テキスト=こんにちは ",
  "[8]",
  "layer=9",
  "frame=150,179",
  "[8.0]",
  "effect.name=テキスト",
  "テキスト=(声の無い字幕)",
  "[9]",
  "layer=9",
  "frame=690,899",
  "[9.0]",
  "effect.name=テキスト",
  "テキスト=<s32>VOICEVOX: 話者\\n  <s20>https://example.test/",
  "[10]",
  "layer=7",
  "frame=60,299",
  "[10.0]",
  "effect.name=PSDファイル@PSDToolKit",
  "レイヤー=L.0 V.XXXX",
  "[10.1]",
  "effect.name=標準描画",
  "X=-700.00",
  "[10.2]",
  "effect.name=フェード",
  "イン=0.40",
  "アウト=0.00",
  "[11]",
  "layer=8",
  "frame=90,299",
  "[11.0]",
  "effect.name=図形",
  "[12]",
  "layer=10",
  "frame=270,299",
  "[12.0]",
  "effect.name=フレームバッファ",
  "[12.1]",
  "effect.name=フェード",
  "イン=0.00",
  "アウト=1.00",
].join("\r\n");

const config = (overrides: Partial<MigrateConfig> = {}): MigrateConfig => ({
  slug: "20260101-sample",
  character: "hero",
  project: {
    title: "タイトル",
    subtitle: "EP.1",
    date: {
      from: "2026-01-01T00:00[Asia/Tokyo]",
      to: "2026-01-02T00:00[Asia/Tokyo]",
    },
    distance: 12.5,
    ridingTime: { hours: 1, minutes: 2 },
    routes: ["A", "B"],
    chapters: [{ title: "第 1 章", subtitle: "CHAPTER 1" }],
    thumbnail: { photo: "P1.jpg", badge: "#1" },
  },
  expressions: {},
  timing: {
    fps: 30,
    openingDurationSec: 4.8,
    openingFadeInSec: 0.4,
    chapterTitleDurationSec: 2.4,
    endingDurationSec: 12,
    narrationRunGapSec: 5,
  },
  ...overrides,
});

const plan = (overrides: Partial<MigrateConfig> = {}) =>
  planTimeline(parseAup2(FIXTURE), config(overrides));

describe("volumePlan", () => {
  it("フェードが無ければ一定値にする", () => {
    expect(volumePlan({ level: 15, fadeIn: 0, fadeOut: 0, duration: 10 })).toBe(
      0.15,
    );
  });

  it("100 を超える音量は 1 に丸める", () => {
    expect(
      volumePlan({ level: 150, fadeIn: 0, fadeOut: 0, duration: 10 }),
    ).toBe(1);
  });

  it("イン・アウトを折れ線にする", () => {
    expect(
      volumePlan({ level: 50, fadeIn: 1, fadeOut: 2, duration: 10 }),
    ).toEqual([
      { at: 0, volume: 0 },
      { at: 1, volume: 0.5 },
      { at: 8, volume: 0.5 },
      { at: 10, volume: 0 },
    ]);
  });

  it("片側だけのフェードは反対側の端を保持する", () => {
    expect(
      volumePlan({ level: 100, fadeIn: 0, fadeOut: 1, duration: 5 }),
    ).toEqual([
      { at: 0, volume: 1 },
      { at: 4, volume: 1 },
      { at: 5, volume: 0 },
    ]);
  });

  it("イン + アウトが尺と等しければ三角形にする", () => {
    expect(
      volumePlan({ level: 50, fadeIn: 0.5, fadeOut: 0.5, duration: 1 }),
    ).toEqual([
      { at: 0, volume: 0 },
      { at: 0.5, volume: 0.5 },
      { at: 1, volume: 0 },
    ]);
  });

  it("イン + アウトが尺を超えたら throw する", () => {
    expect(() =>
      volumePlan({ level: 100, fadeIn: 3, fadeOut: 3, duration: 5 }),
    ).toThrow(/合計/);
  });
});

describe("parseCredits", () => {
  it("文字サイズ指定を落とし、ラベル: 値 の行だけを拾う", () => {
    expect(
      parseCredits(
        "<s32>VOICEVOX: 話者\\n  <s20>https://example.test/\\n\\n<s32>立ち絵: 作者",
      ),
    ).toEqual([{ VOICEVOX: "話者" }, { 立ち絵: "作者" }]);
  });

  it("全角コロンも区切りにする", () => {
    expect(parseCredits("立ち絵作者：Jacca")).toEqual([
      { 立ち絵作者: "Jacca" },
    ]);
  });

  it("空白の無い半角コロンでは割らない", () => {
    expect(parseCredits("12:30 出発")).toEqual([]);
  });
});

describe("planTimeline", () => {
  it("走行映像を秒に写し、クロスフェードで直後の開始を保つ", () => {
    const { videos } = plan();

    expect(videos).toHaveLength(2);
    expect(videos[0]).toEqual({
      ref: "clip1",
      src: "A.mp4",
      trimBefore: 2,
      // クロスフェードの尺 (1 秒) だけ尺を延ばす。
      volume: [
        { at: 0, volume: 0 },
        { at: 1, volume: 0.5 },
        { at: 11, volume: 0.5 },
      ],
      at: 4.8,
      duration: 11,
      in: 0.5,
      out: 0,
    });
    expect(videos[1]).toMatchObject({
      ref: "clip2",
      src: "B.mp4",
      trimBefore: 0,
      volume: 1,
      crossfadeIn: 1,
      at: 14.8,
      duration: 20,
    });
    // 直前の終端 - 遷移の尺 が直後の開始と一致する。
    expect(videos[0].at + videos[0].duration - 1).toBeCloseTo(videos[1].at, 6);
  });

  it("BGM を写す", () => {
    expect(plan().audios).toEqual([
      {
        src: "assets/bgm/m1.wav",
        trimBefore: 0,
        volume: [
          { at: 0, volume: 0.2 },
          { at: 9.5, volume: 0.2 },
          { at: 10, volume: 0 },
        ],
        at: 4.8,
        duration: 10,
      },
    ]);
  });

  it("OP・章タイトル・写真紹介・ED を時間順に並べる", () => {
    const { scenes } = plan();

    expect(scenes.map((scene) => scene.kind)).toEqual([
      "opening",
      "chapter",
      "photo",
      "ending",
    ]);
    expect(scenes[0]).toMatchObject({
      at: 0,
      photo: "photos/P1.jpg",
      badge: "#1",
      title: "タイトル",
    });
    // 章タイトルは帯の開始 (3 秒 + OP の 4.8 秒) に終わりを合わせる。
    expect(scenes[1]).toMatchObject({ at: 5.4, title: "第 1 章" });
    expect(scenes[2]).toMatchObject({
      at: 12.8,
      duration: 2,
      photos: ["photos/P1.jpg"],
    });
    expect(scenes[3]).toMatchObject({
      kind: "ending",
      anchor: "clip2",
      ending: { distance: 12.5, credits: [{ VOICEVOX: "話者" }] },
    });
  });

  it("立ち絵の左右と表情を写し、未割り当ては normal にして警告する", () => {
    const result = plan();

    expect(result.figures).toEqual([
      {
        at: 6.8,
        duration: 8,
        in: 0.4,
        out: 0,
        expression: "normal",
        side: "left",
      },
    ]);
    expect(result.warnings).toEqual([
      "立ち絵の表情が未割り当てです (normal に落とします): L.0 V.XXXX",
    ]);
  });

  it("表情の対応表があればそれを使う", () => {
    const result = plan({ expressions: { "L.0 V.XXXX": "teach" } });

    expect(result.figures[0].expression).toBe("teach");
    expect(result.warnings).toEqual([]);
  });

  it("発話と声の無い字幕を写し、ED の区間の字幕はクレジットに回す", () => {
    const { narration } = plan();

    expect(narration).toEqual([
      // 字幕の前後の空白は落とす。run の先頭は絶対秒。
      { kind: "line", at: 7.8, text: "こんにちは", expression: "normal" },
      // 直前との無音が silenceGap 未満なので after で繋ぐ。
      { kind: "subtitle", after: 1, duration: 1, text: "(声の無い字幕)" },
    ]);
  });

  it("無音が silenceGap 以上あいたら絶対秒に戻す", () => {
    const { narration } = plan({
      timing: { ...config().timing, narrationRunGapSec: 0.5 },
    });

    expect(narration[1]).toMatchObject({ at: 9.8 });
  });

  it("frame() は OP の立ち上がりを先頭に置く", () => {
    expect(plan().frames).toEqual([
      { at: 0, duration: 0.4, in: 0.4, out: 0, opening: true },
      { at: 13.8, duration: 1, in: 0, out: 1 },
    ]);
  });

  it("章の数が帯の本数と合わなければ警告する", () => {
    const base = config();
    const result = plan({
      project: { ...base.project, chapters: [] },
    });

    expect(result.warnings).toContainEqual(
      "章の数が合いません (帯 1 本、jododaira.json の chapters 0 件)",
    );
  });

  it("BGM の無い project でもセリフの音声を BGM にしない", () => {
    // 走行映像 1 本と、字幕の付いた 音声ファイル 1 本だけの project。
    const aup2 = parseAup2(
      [
        "[1]",
        "layer=1",
        "frame=0,899",
        "[1.0]",
        "effect.name=動画ファイル",
        "再生位置=0.000,30.000,再生範囲,0",
        "ファイル=C:\\movie\\A.mp4",
        "[2]",
        "layer=2",
        "frame=90,119",
        "[2.0]",
        "effect.name=音声ファイル",
        "再生位置=0.000,1.000,再生範囲,0",
        "ファイル=C:\\movie\\001.wav",
        "[3]",
        "layer=3",
        "frame=90,125",
        "[3.0]",
        "effect.name=テキスト",
        "テキスト=こんにちは",
      ].join("\r\n"),
    );
    const result = planTimeline(aup2, config());

    expect(result.audios).toEqual([]);
    expect(result.narration).toEqual([
      { kind: "line", at: 7.8, text: "こんにちは" },
    ]);
  });

  it("同じ開始フレームの テキスト が複数あれば警告する", () => {
    const aup2 = parseAup2(
      [
        "[1]",
        "layer=1",
        "frame=0,899",
        "[1.0]",
        "effect.name=動画ファイル",
        "再生位置=0.000,30.000,再生範囲,0",
        "ファイル=C:\\movie\\A.mp4",
        "[2]",
        "layer=3",
        "frame=90,125",
        "[2.0]",
        "effect.name=テキスト",
        "テキスト=1 行目",
        "[3]",
        "layer=4",
        "frame=90,125",
        "[3.0]",
        "effect.name=テキスト",
        "テキスト=2 行目",
      ].join("\r\n"),
    );

    expect(planTimeline(aup2, config()).warnings).toContainEqual(
      "同じ開始フレーム (90) の テキスト が複数あります ([2] を字幕にし、[3] は声の無い字幕として置きます)",
    );
  });

  /**
   * 走行映像 1 本 (frame 0..899) と、その終端を越える BGM 1 本 (frame
   * 600..1199)。BGM の `音量フェード` のイン・アウトを差し替えて、終端で詰めた
   * ときの扱いを見る。
   */
  const overhangingBgm = (fadeIn: string, fadeOut: string) =>
    parseAup2(
      [
        "[1]",
        "layer=1",
        "frame=0,899",
        "[1.0]",
        "effect.name=動画ファイル",
        "再生位置=0.000,30.000,再生範囲,0",
        "ファイル=C:\\movie\\A.mp4",
        "[2]",
        "layer=2",
        "frame=600,1199",
        "[2.0]",
        "effect.name=音声ファイル",
        "再生位置=0.000,20.000,再生範囲,0",
        "ファイル=C:\\movie\\m1.wav",
        "[2.1]",
        "effect.name=音量フェード",
        `イン=${fadeIn}`,
        `アウト=${fadeOut}`,
      ].join("\r\n"),
    );

  it("終端で詰めた尺にフェードアウトが収まらなければ throw する", () => {
    // frame 1199 -> 899 に詰めると尺は 10 秒。アウト 15 秒は収まらない。
    expect(() =>
      planTimeline(overhangingBgm("0.00", "15.00"), config()),
    ).toThrow(
      "aup2: [2] の終端を走行映像の終端に詰めた (frame 1199 -> 899、尺 10 秒) ため、音量フェード のイン (0 秒) + アウト (15 秒) が収まりません",
    );
  });

  it("イン + アウトの合計で見る (片側だけなら収まる値でも throw する)", () => {
    // 詰めた尺は 10 秒。イン 6 秒・アウト 5 秒はどちらも単独なら収まるが、
    // 合計 11 秒は収まらない (fade() の in + out > duration と同じ規則)。
    expect(() =>
      planTimeline(overhangingBgm("6.00", "5.00"), config()),
    ).toThrow(
      "aup2: [2] の終端を走行映像の終端に詰めた (frame 1199 -> 899、尺 10 秒) ため、音量フェード のイン (6 秒) + アウト (5 秒) が収まりません",
    );
  });

  it("詰めた尺にフェードアウトが収まるなら詰めたまま写す", () => {
    expect(
      planTimeline(overhangingBgm("0.00", "1.00"), config()).audios,
    ).toEqual([
      {
        src: "assets/bgm/m1.wav",
        trimBefore: 0,
        volume: [
          { at: 0, volume: 1 },
          { at: 9, volume: 1 },
          { at: 10, volume: 0 },
        ],
        at: 24.8,
        duration: 10,
      },
    ]);
  });

  it("再生位置 が無ければオブジェクト id を添えて throw する", () => {
    const aup2 = parseAup2(
      [
        "[1]",
        "layer=1",
        "frame=0,299",
        "[1.0]",
        "effect.name=動画ファイル",
        "ファイル=C:\\movie\\A.mp4",
      ].join("\r\n"),
    );

    expect(() => planTimeline(aup2, config())).toThrow(
      "aup2: [1] に 再生位置 がありません (元動画のどこから使うか決まりません)",
    );
  });

  it("再生位置 の開始が数値でなければオブジェクト id を添えて throw する", () => {
    const aup2 = parseAup2(
      [
        "[1]",
        "layer=1",
        "frame=0,299",
        "[1.0]",
        "effect.name=動画ファイル",
        "再生位置=,10.000,再生範囲,0",
        "ファイル=C:\\movie\\A.mp4",
      ].join("\r\n"),
    );

    expect(() => planTimeline(aup2, config())).toThrow(
      /\[1\] の 再生位置 の開始が数値ではありません/,
    );
  });

  it("走行映像が無ければ throw する", () => {
    expect(() =>
      planTimeline(parseAup2("[1]\nlayer=1\nframe=0,9\n"), config()),
    ).toThrow(/走行映像/);
  });
});
