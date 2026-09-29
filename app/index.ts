// Remotion の入口 (motovlog の ADR-0012)。remotion.config.ts の setEntryPoint()
// がこのファイルを指す。lib (motovlog) に利用側の値を渡してから composition を
// 登録する。

import "temporal-polyfill/global";
import { registerRoot } from "remotion";
import { configure, RemotionRoot } from "motovlog";
import { defaultProject, theme } from "./config.ts";

configure({
  theme,
  defaultProject,
  // ディレクトリ部分をリテラルで書いた import() でないとバンドラ (Rspack) が
  // 解決できないため、テンプレートリテラルの形は変えないこと。
  loadTimeline: (slug) => import(`../projects/${slug}/timeline.ts`),
});

registerRoot(RemotionRoot);
