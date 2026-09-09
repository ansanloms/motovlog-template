// CSS に置けない値 (フレーム計算に使う秒数) はここに集める。
// T&M「出入りのタイミング」節。
// 秒数は `fps` でフレーム割りできる値に揃える (timing.test.ts が検査する)。

/** T&M の fps。尺の秒数はこの値でフレーム割りできる値に揃える。 */
export const fps = 30;

export const bandTiming = {
  leadIn: 0.2, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 5, // 無音が何秒続いたら消すか (次の発話との統合閾値でもある)
  fadeOut: 0.4,
} as const;

/** セリフ字幕の尾 (音声終了後、字幕を残す秒数)。bandTiming.fadeOut と同値だが意味が違う。 */
export const subtitleTiming = { tail: 0.4 } as const;

/** 章タイトルの出入りのタイミング (T&M「出入りのタイミング」節)。 */
export const chapterTiming = { fade: 0.2, hold: 2 } as const; // 6f / 60f / 6f at 30fps
/** 立ち絵の出入りのタイミング (T&M「出入りのタイミング」節)。 */
export const characterTiming = {
  fade: 0.2, // 6f at 30fps
  blinkInterval: 4, // 目パチの周期 (秒)。区間の頭は開眼、末尾で閉じる
  blinkClosed: 0.1, // 閉眼の尺 (秒)。blinkInterval の末尾側に置く
} as const;
/** OP の尺とフェードイン秒 (黒地から)。フェードアウトは無し。 */
export const openingTiming = { duration: 4.8, fadeIn: 0.4 } as const; // 黒から 0.4 秒
/** ED の尺。カットイン、フェードなし。 */
export const endingTiming = { duration: 12 } as const; // カットイン、フェードなし
/** サムネ用フレームの尺と、ED からのクロスフェード秒。 */
export const thumbnailFrameTiming = { duration: 4.8, crossfade: 4.8 } as const; // ED の上にクロスフェード

/** 章タイトルの表示尺 (フェードイン + 保持 + フェードアウト)。 */
export const chapterTitleDurationSec =
  chapterTiming.fade * 2 + chapterTiming.hold;
