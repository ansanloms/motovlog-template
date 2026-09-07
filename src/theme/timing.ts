// CSS に置けない値 (フレーム計算に使う秒数) はここに集める。
// T&M「出入りのタイミング」節。
// 30fps でフレーム割りできる値 (6f / 150f / 12f)。
export const bandTiming = {
  leadIn: 0.2, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 5, // 無音が何秒続いたら消すか
  fadeOut: 0.4,
} as const;
