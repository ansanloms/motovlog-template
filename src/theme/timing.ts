// CSS に置けない値 (フレーム計算に使う秒数) はここに集める。
// T&M「出入りのタイミング」節。
export const bandTiming = {
  leadIn: 0.24, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 4.8, // 無音が何秒続いたら消すか
  fadeOut: 0.48,
} as const;
