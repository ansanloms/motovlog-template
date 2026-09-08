// CSS に置けない値 (フレーム計算に使う秒数) はここに集める。
// T&M「出入りのタイミング」節。
// 30fps でフレーム割りできる値 (6f / 150f / 12f)。
export const bandTiming = {
  leadIn: 0.2, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 5, // 無音が何秒続いたら消すか
  fadeOut: 0.4,
} as const;

/** 章タイトルの出入りのタイミング (T&M「出入りのタイミング」節)。 */
export const chapterTiming = { fade: 0.2, hold: 2 } as const; // 6f / 60f / 6f at 30fps
/** 立ち絵の出入りのタイミング (T&M「出入りのタイミング」節)。 */
export const characterTiming = { fade: 0.2 } as const; // 6f at 30fps
/** OP の尺とフェードイン秒 (黒地から)。フェードアウトは無し。 */
export const openingTiming = { duration: 4.8, fadeIn: 0.4 } as const; // 黒から 0.4 秒
/** ED の尺。カットイン、フェードなし。 */
export const endingTiming = { duration: 12 } as const; // カットイン、フェードなし
/** サムネ用フレームの尺と、ED からのクロスフェード秒。 */
export const thumbnailFrameTiming = { duration: 4.8, crossfade: 4.8 } as const; // ED の上にクロスフェード

/** 章タイトルの表示区間の長さ (秒)。フェードイン + 保持 + フェードアウト。 */
export const chapterTitleDurationSec =
  chapterTiming.fade * 2 + chapterTiming.hold;
