// 下部の暗がりの表示区間を lines から導く (ADR-0007, ADR-0008)。
//
// 手置きの帯 (旧 subtitleBands) を廃し、語りの区間から自動で導出する。
// T&M (docs/design/tone-and-manner.md)「字幕の出し方」節の規則:
// - 暗がりは語り出しの leadIn 秒前からフェードインする。
// - 音声終了後 silenceGap 秒以内に次の語りが始まれば、暗がりは出したままにする。
// - 次の語りとの間隔が (silenceGap + fadeOut + leadIn) を超えたら、暗がりを
//   いったんフェードアウトさせ、次の語り出しの leadIn 秒前から出し直す
//   (フェードアウトと次のフェードインが重ならないよう、フェードの分を足した
//   値で判定する)。

export type BandSpan = { start: number; duration: number; fadeIn: number }; // 秒。フェードイン・アウトを含む区間。fadeIn は leadIn を start の 0 clamp 分だけ短縮した実効フェードイン秒

export const computeBandSpans = (
  lines: ReadonlyArray<{ start: number; duration: number }>,
  opts: { leadIn: number; silenceGap: number; fadeOut: number },
): BandSpan[] => {
  const { leadIn, silenceGap, fadeOut } = opts;

  if (lines.length === 0) {
    return [];
  }

  const sorted = [...lines].sort((a, b) => a.start - b.start);
  const mergeThreshold = silenceGap + fadeOut + leadIn;

  const spans: BandSpan[] = [];
  let groupStart = sorted[0].start;
  let groupEnd = sorted[0].start + sorted[0].duration;

  for (let i = 1; i < sorted.length; i++) {
    const line = sorted[i];
    const lineEnd = line.start + line.duration;

    if (line.start - groupEnd <= mergeThreshold) {
      groupEnd = Math.max(groupEnd, lineEnd);
      continue;
    }

    spans.push(toSpan(groupStart, groupEnd, leadIn, silenceGap, fadeOut));
    groupStart = line.start;
    groupEnd = lineEnd;
  }

  spans.push(toSpan(groupStart, groupEnd, leadIn, silenceGap, fadeOut));

  return spans;
};

const toSpan = (
  groupStart: number,
  groupEnd: number,
  leadIn: number,
  silenceGap: number,
  fadeOut: number,
): BandSpan => {
  const start = Math.max(0, groupStart - leadIn);
  const end = groupEnd + silenceGap + fadeOut;
  // groupStart - start と等価だが、浮動小数の誤差 (例: 1 - 0.7) を避けるため
  // clamp 前の leadIn と groupStart の min で求める。
  const fadeIn = Math.min(leadIn, groupStart);

  return { start, duration: end - start, fadeIn };
};
