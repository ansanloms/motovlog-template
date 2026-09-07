// 下部の暗がりの表示区間を lines から導く (ADR-0007, ADR-0008)。
//
// 手置きの帯 (旧 subtitleBands) を廃し、ナレーションの区間から自動で導出する。
// 規則は T&M (docs/design/tone-and-manner.md)「出入りのタイミング」節。
// 秒数は src/theme/timing.ts の bandTiming (leadIn / silenceGap / fadeOut)。
//
// 手順:
// 1. lines を start 順に並べる。各 line の「ナレーション区間」は
//    [start, start + duration]。
// 2. 先頭の line からグループを作る。グループは groupStart (最初の
//    ナレーション開始) と groupEnd (これまでのナレーション終了の最大値) を持つ。
// 3. 次の line の start - groupEnd が閾値 (silenceGap + fadeOut + leadIn)
//    以内なら同じグループに含めて groupEnd を伸ばす。超えていれば
//    グループを閉じて区間にし、新しいグループを始める。
// 4. 各グループを区間に変換する。開始は groupStart - leadIn (0 未満なら 0)、
//    終了は groupEnd + silenceGap + fadeOut。fadeIn は通常 leadIn だが、
//    開始を 0 に切り詰めたときはその分短くする。
//
// 閾値に fadeOut と leadIn を足すのは、隙間が silenceGap をわずかに超える
// ときに「消えかけ」と「出直し」の Sequence が重なり、不透明度が二重に
// 掛かるのを避けるため。T&M の「無音 5 秒で消す」からのずれは最大
// fadeOut + leadIn (0.6 秒) に収まる。
//
// 例 (leadIn 0.2、silenceGap 5、fadeOut 0.4、閾値 5.6):
// - line1 が 1.0〜2.9 秒、line2 が 4.0〜7.96 秒 (サンプル project の値):
//   隙間は 1.1 秒で閾値以内なので 1 グループ。暗がりは 0.8 秒から出て
//   0.2 秒でフェードインし、7.96 + 5 + 0.4 = 13.36 秒まで続き、
//   最後の 0.4 秒でフェードアウトする。
// - line2 が 10.0 秒に始まる場合: 隙間 7.1 秒で閾値を超えるので 2 グループ。
//   暗がりは 2.9 + 5.4 = 8.3 秒でいったん消え、9.8 秒から出直す。

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
