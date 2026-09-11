// 利用側 (app/・theme/・projects/・characters/) の値を lib に渡すレジストリ
// (ADR-0012)。利用側の入口 (app/index.ts) で configure() を 1 回呼び、lib 内は
// getSetup() で読む。
//
// React の context ではなくモジュール単位のレジストリにしているのは、値を読む
// 場所がブラウザの描画中に限らないため。narration() は timeline.ts のモジュール
// 評価時に動き、composition の props には関数を載せられず (ADR-0006)、watcher
// (scripts/voice.ts) は Node で同じ値を要る。

import { PALETTE_KEYS } from "./theme/tokens.ts";
import type { Palette } from "./theme/tokens.ts";
import type { Narrator } from "./theme/voice.ts";
import { VOICE_KEYS } from "./voice/cache.ts";

/** 利用側が持つ見た目と声の値。 */
export type Theme = {
  /** T&M「カラー」節のパレット。 */
  readonly palette: Palette;
  /** 既定の話者と声質 (ADR-0010)。 */
  readonly narrator: Narrator;
};

/** configure() に渡すもの。 */
export type Setup = {
  readonly theme: Theme;
  /**
   * projects/<slug>/timeline.ts を読む関数。バンドラが静的解析できる形の
   * import() を利用側に書かせるため、lib からは関数として受け取る。
   * default export の検査は lib (src/project/load.ts) が行う。
   */
  readonly loadTimeline: (slug: string) => Promise<{ default: unknown }>;
  /** REMOTION_PROJECT が未設定・空のときに読む project の slug。 */
  readonly defaultProject: string;
};

let current: Setup | undefined;

/** palette の色に許す形。themeCssVars() が rgba() の合成に使う (src/theme/cssVars.ts)。 */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * theme の値が揃っているかを見る。揃っていないまま通すと、どちらもエラー無しで
 * 間違った成果物になるため、入口で止める。
 *
 * - narrator: 欠けた項目は resolveVoice() (src/voice/key.ts) が undefined を
 *   埋め、VOICEVOX ENGINE が黙って既定値で合成する。
 * - palette: 欠けた項目は themeCssVars() が `undefined` の CSS 変数として流し、
 *   その色を使う箇所だけが初期値で描かれる。
 */
const assertTheme = (theme: Theme): void => {
  // 利用側の app/config.ts は watcher (scripts/voice.ts) が動的 import() で
  // 読むため、型の付かない値が来ることがある。unknown として見る。
  const narrator: Record<string, unknown> = theme?.narrator ?? {};
  const palette: Record<string, unknown> = theme?.palette ?? {};

  const badVoices = VOICE_KEYS.filter((key) => !Number.isFinite(narrator[key]));

  if (badVoices.length > 0) {
    throw new Error(
      `configure(): theme.narrator の項目が数値ではありません: ${badVoices.join("・")}`,
    );
  }

  const missingColors = PALETTE_KEYS.filter(
    (key) => typeof palette[key] !== "string",
  );

  if (missingColors.length > 0) {
    throw new Error(
      `configure(): theme.palette の項目がありません: ${missingColors.join("・")}`,
    );
  }

  const badColors = PALETTE_KEYS.filter(
    (key) => !HEX_COLOR.test(String(palette[key])),
  );

  if (badColors.length > 0) {
    throw new Error(
      `configure(): theme.palette の色は #rrggbb の形で書いてください: ${badColors
        .map((key) => `${key}=${String(palette[key])}`)
        .join("・")}`,
    );
  }
};

/**
 * 利用側の入口で 1 回だけ呼ぶ。後から呼べば上書きする。theme が揃っていなければ
 * 何も記録せずに throw する。
 */
export const configure = (setup: Setup): void => {
  assertTheme(setup.theme);
  current = setup;
};

/** configure() で渡された値を読む。未設定なら呼ぶ場所を示して throw する。 */
export const getSetup = (): Setup => {
  if (current === undefined) {
    throw new Error(
      "motovlog-template が未設定です。利用側の入口 (app/index.ts) で configure({ theme, loadTimeline, defaultProject }) を呼んでください。",
    );
  }

  return current;
};
