// 利用側の設定値 (ADR-0012)。app/index.ts (ブラウザ) と watcher
// (scripts/voice.ts、Node) の両方がこのファイルを読む。
//
// Remotion を import しないこと。watcher は Node からこのファイルを動的
// import() するため、remotion や CSS Modules を辿ると読めなくなる。timeline の
// 読み込み関数 (loadTimeline) はバンドラの静的解析が要るため app/index.ts に
// 置き、ここには置かない。

export { theme } from "../theme/index.ts";

/** REMOTION_PROJECT が未設定・空のときに読む project の slug (ADR-0002)。 */
export const defaultProject = "00000000-sample";
