// CSS に置けない値 (フレーム計算に使う秒数) はここに集める。
// T&M「画面配置」「字幕の出し方」節。
export const bandTiming = {
  leadIn: 0.3, // 語り出しの何秒前から出すか (= フェードイン秒)
  silenceGap: 5, // 無音が何秒続いたら消すか
  fadeOut: 0.5,
} as const;
