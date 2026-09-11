// 利用側 (app/・theme/・projects/・characters/) の値を lib に渡すレジストリ
// (ADR-0012)。利用側の入口 (app/index.ts) で configure() を 1 回呼び、lib 内は
// getSetup() で読む。
//
// React の context ではなくモジュール単位のレジストリにしているのは、値を読む
// 場所がブラウザの描画中に限らないため。narration() は timeline.ts のモジュール
// 評価時に動き、composition の props には関数を載せられず (ADR-0006)、watcher
// (scripts/voice.ts) は Node で同じ値を要る。

import type { Palette } from "./theme/tokens.ts";
import type { Narrator } from "./theme/voice.ts";

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

/** 利用側の入口で 1 回だけ呼ぶ。後から呼べば上書きする。 */
export const configure = (setup: Setup): void => {
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
