// 下部の暗がりの表示区間を発話 (line) の列から導く (ADR-0010, ADR-0004,
// ADR-0005)。
//
// 規則は T&M (docs/design/tone-and-manner.md)「出入りのタイミング」節。
// 秒数は src/theme/timing.ts の bandTiming (leadIn / silenceGap / fadeOut)。
//
// 入力は line() ごとの { start, speechEnd, captionEnd } (narration.ts が
// 求める。すべて秒の絶対値)。
// - start: 発話の開始。
// - speechEnd: 音声が鳴っている終端。start + 実尺 と captionEnd の小さい方
//   (字幕の尺より音声が長ければ Sequence で切れるため)。
// - captionEnd: 字幕が消える時刻 (start + 字幕の尺)。
//
// 手順:
// 1. lines を start 順に並べる。
// 2. 先頭の line からグループを作る (groupStart は最初の line の start)。
//    グループは speechEnd・captionEnd それぞれの最大値 (running max) を
//    持ち、2 本目以降は、その running max と比べて次のどちらかに当てはまれば
//    同じグループに含める。
//    - グループの speechEnd の running max から次の start までが
//      silenceGap 以内 (無音が silenceGap を超えて続いていない)。
//    - 分けるとグループ (captionEnd の running max + fadeOut) と次の
//      区間 (次の start - leadIn) が重なってしまう (captionEnd の
//      running max + fadeOut > 次の start - leadIn)。
//    含めると判定したら、その line の speechEnd・captionEnd で running max
//    を更新する。どちらにも当てはまらなければグループを閉じて区間にし、
//    次の line から新しいグループを始める (running max もその line の値で
//    初期化する)。
// 3. 各グループを区間に変換する。開始は groupStart - leadIn (0 未満なら
//    0)、終了はグループ内の captionEnd の最大 (running max) + fadeOut。
//    fadeIn は通常 leadIn だが、開始を 0 に切り詰めたときはその分短くする。
//    最後のグループも同じ規則で閉じる (保持しない)。
// 4. 手順 2 のグループ化の条件 (分けると区間同士が重なるなら分けずに繋ぐ)
//    により、求めた区間は時間順で重ならない。
//
// 例 (leadIn 0.2、silenceGap 5、fadeOut 0.4):
// - 通常の発話 (duration を明示しない) は captionEnd = speechEnd + tail
//   (subtitleTiming.tail、narration.ts が計算) になるので、区間の終端は
//   speechEnd + tail + fadeOut = 音声終了 + 0.8 秒。line1 が speechEnd
//   2.9 秒・captionEnd 3.3 秒 (start 1.0 秒)、line2 が speechEnd 7.96 秒・
//   captionEnd 8.36 秒 (start 4.0 秒、サンプル project の値) の場合: 隙間
//   (4.0 - 2.9 = 1.1 秒) は silenceGap 以内なので 1 グループ。暗がりは
//   0.8 秒から出て 0.2 秒でフェードインし、8.36 + 0.4 = 8.76 秒まで続き、
//   最後の 0.4 秒でフェードアウトする。
// - line2 が 10.0 秒に始まる場合: 隙間 7.1 秒 (2.9 との差) で silenceGap
//   を超え、重なりもしないので 2 グループ。1 つ目は 3.3 + 0.4 = 3.7 秒で
//   消え、9.8 秒 (10.0 - leadIn) から出直す。

/** 秒。フェードイン・アウトを含む区間。fadeIn は leadIn を start の 0 clamp 分だけ短縮した実効フェードイン秒。 */
export type BandSpan = {
  /** 区間の開始秒 (フェードイン込み)。 */
  start: number;
  /** 区間の尺 (秒、フェードイン・アウトを含む)。 */
  duration: number;
  /** 実効フェードイン秒。start を 0 に clamp した分だけ leadIn より短くなる。 */
  fadeIn: number;
};

/**
 * 発話 (line) の列から下部の暗がりの表示区間 (フェードイン・アウトを含む)
 * の列を求める。近接する発話 (隙間が silenceGap 以内、または分けると
 * 区間同士が重なる) は 1 つの区間に統合し、それ以外は字幕が消えた直後
 * (captionEnd) からフェードアウトして閉じる。アルゴリズムの詳細はファイル
 * 冒頭のコメントを参照。
 */
export const computeBandSpans = (
  lines: ReadonlyArray<{
    /** 発話の開始秒 (絶対値)。 */
    start: number;
    /** 音声が鳴っている終端秒 (start + 実尺 と captionEnd の小さい方)。 */
    speechEnd: number;
    /** 字幕が消える時刻 (start + 字幕の尺)。 */
    captionEnd: number;
  }>,
  opts: {
    /** 語り出しの何秒前から出すか (= フェードイン秒)。 */
    leadIn: number;
    /** 無音が何秒続いたら消すか (次の発話との統合閾値でもある)。 */
    silenceGap: number;
    /** フェードアウトの尺 (秒)。 */
    fadeOut: number;
  },
): BandSpan[] => {
  const { leadIn, silenceGap, fadeOut } = opts;

  if (lines.length === 0) {
    return [];
  }

  const sorted = [...lines].sort((a, b) => a.start - b.start);

  const spans: BandSpan[] = [];
  let groupStart = sorted[0].start;
  let groupSpeechEndMax = sorted[0].speechEnd;
  let groupCaptionEndMax = sorted[0].captionEnd;

  for (let i = 1; i < sorted.length; i++) {
    const line = sorted[i];

    const withinSilenceGap = line.start - groupSpeechEndMax <= silenceGap;
    const wouldOverlapIfSplit =
      groupCaptionEndMax + fadeOut > line.start - leadIn;

    if (withinSilenceGap || wouldOverlapIfSplit) {
      groupSpeechEndMax = Math.max(groupSpeechEndMax, line.speechEnd);
      groupCaptionEndMax = Math.max(groupCaptionEndMax, line.captionEnd);
      continue;
    }

    spans.push(toSpan(groupStart, groupCaptionEndMax, leadIn, fadeOut));
    groupStart = line.start;
    groupSpeechEndMax = line.speechEnd;
    groupCaptionEndMax = line.captionEnd;
  }

  spans.push(toSpan(groupStart, groupCaptionEndMax, leadIn, fadeOut));

  return spans;
};

const toSpan = (
  groupStart: number,
  groupCaptionEndMax: number,
  leadIn: number,
  fadeOut: number,
): BandSpan => {
  const start = Math.max(0, groupStart - leadIn);
  const end = groupCaptionEndMax + fadeOut;
  // groupStart - start と等価だが、浮動小数の誤差 (例: 1 - 0.7) を避けるため
  // clamp 前の leadIn と groupStart の min で求める。
  const fadeIn = Math.min(leadIn, groupStart);

  return { start, duration: end - start, fadeIn };
};
