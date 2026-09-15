/**
 * 走行映像の src (staticFile() 済みの URL) から、Studio 用プロキシ
 * (`<basename>.preview.mp4`、convert が作る 540p の低解像度素材) の URL を
 * 返す (ADR-0013)。末尾が ".mp4" でない src (クエリ文字列付き等) はそのまま
 * 返す。プロキシが実際に存在するかは確認しない。
 */
export const previewSrc = (src: string): string => {
  if (!src.endsWith(".mp4")) {
    return src;
  }

  return `${src.slice(0, -".mp4".length)}.preview.mp4`;
};
