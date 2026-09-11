// テストの共通セットアップ。Temporal (ADR-0007) の polyfill を読み、lib に
// 利用側の値を渡す (ADR-0012)。テストは利用側のリポジトリの中身
// (theme/index.ts・projects/00000000-sample) をそのまま使う。
import "temporal-polyfill/global";
import { configure } from "../setup.ts";
import { theme } from "../../theme/index.ts";

configure({
  theme,
  defaultProject: "00000000-sample",
  loadTimeline: (slug) => import(`../../projects/${slug}/timeline.ts`),
});
