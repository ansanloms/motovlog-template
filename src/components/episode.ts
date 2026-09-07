// 話数 (OP のバッジと ED の右上) の書式。timeline.ts の `episode` (構造化データ)
// から表示用の文字列を組み立てる。

export type Episode = { number: number; area: string; road?: string };

// OP バッジ: "#12 愛媛 / 国道378号" (road が無ければ "#12 愛媛")。
export const episodeBadge = (episode: Episode): string =>
  `#${episode.number} ${episode.area}` +
  (episode.road ? ` / ${episode.road}` : "");

// ED 右上: "EP.12 / 愛媛"。
export const episodeHeader = (episode: Episode): string =>
  `EP.${episode.number} / ${episode.area}`;
