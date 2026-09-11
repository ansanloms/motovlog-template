// テストの共通セットアップ。Temporal (ADR-0007) の polyfill を読み、lib に
// 利用側の値を渡す (ADR-0012)。テストは利用側のリポジトリの中身
// (theme/index.ts・projects/00000000-sample) をそのまま使う。
//
// lib (src/) の外に置く。lib から利用側 (theme/index.ts) を静的に import する
// ことは ADR-0012 が禁じており、src/ に置くとその禁止に触れる (eslint.config.mjs
// の src/** の no-restricted-imports)。
import "temporal-polyfill/global";
import { configure } from "../src/setup.ts";
import { theme } from "../theme/index.ts";

configure({
  theme,
  defaultProject: "00000000-sample",
  loadTimeline: (slug) => import(`../projects/${slug}/timeline.ts`),
});
