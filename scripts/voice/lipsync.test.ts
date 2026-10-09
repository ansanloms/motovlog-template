import { describe, expect, it } from "vitest";
import type { AudioQuery } from "./lipsync.ts";
import { queryToLipsync, queryTotalSeconds } from "./lipsync.ts";

// VOICEVOX ENGINE の /audio_query の実機応答 (2026-09-06〜07 の実機確認) を
// 固定データとして持つ。「今日は浄土平まで走ってきた。」の query。
const sampleQuery: AudioQuery = {
  accent_phrases: [
    {
      moras: [
        {
          consonant: "ky",
          consonant_length: 0.08707620203495026,
          vowel: "o",
          vowel_length: 0.08861343562602997,
          pitch: 4.807190418243408,
        },
        {
          consonant: null,
          consonant_length: null,
          vowel: "o",
          vowel_length: 0.06818090379238129,
          pitch: 4.7507243156433105,
        },
        {
          consonant: "w",
          consonant_length: 0.04426409304141998,
          vowel: "a",
          vowel_length: 0.0766732394695282,
          pitch: 4.443325519561768,
        },
      ],
      pause_mora: null,
    },
    {
      moras: [
        {
          consonant: "j",
          consonant_length: 0.09711184352636337,
          vowel: "o",
          vowel_length: 0.07306614518165588,
          pitch: 4.483874797821045,
        },
        {
          consonant: null,
          consonant_length: null,
          vowel: "o",
          vowel_length: 0.06289888918399811,
          pitch: 4.915137767791748,
        },
        {
          consonant: "d",
          consonant_length: 0.035563334822654724,
          vowel: "o",
          vowel_length: 0.05838634818792343,
          pitch: 4.941098690032959,
        },
        {
          consonant: "t",
          consonant_length: 0.0696735680103302,
          vowel: "a",
          vowel_length: 0.06460469961166382,
          pitch: 4.965012073516846,
        },
        {
          consonant: null,
          consonant_length: null,
          vowel: "i",
          vowel_length: 0.06284555792808533,
          pitch: 4.895452499389648,
        },
        {
          consonant: "r",
          consonant_length: 0.02893587201833725,
          vowel: "a",
          vowel_length: 0.07564616203308105,
          pitch: 4.65635347366333,
        },
        {
          consonant: "m",
          consonant_length: 0.04228898882865906,
          vowel: "a",
          vowel_length: 0.06335052102804184,
          pitch: 4.444681644439697,
        },
        {
          consonant: "d",
          consonant_length: 0.042911216616630554,
          vowel: "e",
          vowel_length: 0.0591520294547081,
          pitch: 4.365617752075195,
        },
      ],
      pause_mora: null,
    },
    {
      moras: [
        {
          consonant: "h",
          consonant_length: 0.0943276509642601,
          vowel: "a",
          vowel_length: 0.05172727257013321,
          pitch: 4.535003662109375,
        },
        {
          consonant: "sh",
          consonant_length: 0.08939161896705627,
          vowel: "i",
          vowel_length: 0.04347548633813858,
          pitch: 4.806936264038086,
        },
        {
          consonant: null,
          consonant_length: null,
          vowel: "cl",
          vowel_length: 0.11095145344734192,
          pitch: 0,
        },
        {
          consonant: "t",
          consonant_length: 0.023361802101135254,
          vowel: "e",
          vowel_length: 0.0428033247590065,
          pitch: 4.400651454925537,
        },
      ],
      pause_mora: null,
    },
    {
      moras: [
        {
          consonant: "k",
          consonant_length: 0.061680927872657776,
          vowel: "i",
          vowel_length: 0.022985205054283142,
          pitch: 4.429165840148926,
        },
        {
          consonant: "t",
          consonant_length: 0.06752686202526093,
          vowel: "a",
          vowel_length: 0.17732593417167664,
          pitch: 4.358666896820068,
        },
      ],
      pause_mora: null,
    },
  ],
  speedScale: 1,
  pitchScale: 0,
  intonationScale: 1,
  volumeScale: 1,
  pauseLengthScale: 1,
  pauseLength: null,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.1,
};

describe("queryToLipsync", () => {
  it("先頭エントリは prePhonemeLength + 最初の consonant_length から始まる", () => {
    const entries = queryToLipsync(sampleQuery);

    expect(entries[0].vowel).toBe("o");
    expect(entries[0].start).toBeCloseTo(0.18707620203495026, 6);
    expect(entries[0].end).toBeCloseTo(0.2756896376609802, 6);
  });

  it("speedScale で時刻が割られる (2 なら半分になる)", () => {
    const base = queryToLipsync(sampleQuery);
    const doubled = queryToLipsync({ ...sampleQuery, speedScale: 2 });

    expect(doubled[0].start).toBeCloseTo(base[0].start / 2, 6);
    expect(doubled[0].end).toBeCloseTo(base[0].end / 2, 6);
  });

  const withPause: AudioQuery = {
    accent_phrases: [
      {
        moras: [
          {
            consonant: null,
            consonant_length: null,
            vowel: "a",
            vowel_length: 0.1,
            pitch: 5.0,
          },
        ],
        pause_mora: {
          consonant: null,
          consonant_length: null,
          vowel: "pau",
          vowel_length: 0.2,
          pitch: 0,
        },
      },
    ],
    speedScale: 1,
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
    pauseLengthScale: 1,
    pauseLength: null,
    prePhonemeLength: 0,
    postPhonemeLength: 0,
  };

  it('pause_mora があれば vowel: "pau" のエントリになる', () => {
    const entries = queryToLipsync(withPause);

    expect(entries).toHaveLength(2);
    expect(entries[1].vowel).toBe("pau");
    expect(entries[1].start).toBeCloseTo(0.1, 9);
    expect(entries[1].end).toBeCloseTo(0.3, 9);
  });

  it("pauseLengthScale が 1 以外なら pause_mora の長さに反映される (pauseLength が null のとき)", () => {
    const scaled: AudioQuery = { ...withPause, pauseLengthScale: 2 };

    const entries = queryToLipsync(scaled);

    // 0.1 (先頭母音の end) から vowel_length (0.2) * pauseLengthScale (2) = 0.4 秒。
    expect(entries[1].start).toBeCloseTo(0.1, 9);
    expect(entries[1].end).toBeCloseTo(0.5, 9);
    expect(queryTotalSeconds(scaled)).toBeCloseTo(0.1 + 0.4 + 0, 9);
  });

  it("pauseLength が非 null なら pauseLengthScale より優先して絶対秒として使う", () => {
    const withAbsolutePause: AudioQuery = {
      ...withPause,
      pauseLengthScale: 2,
      pauseLength: 0.05,
    };

    const entries = queryToLipsync(withAbsolutePause);

    expect(entries[1].start).toBeCloseTo(0.1, 9);
    expect(entries[1].end).toBeCloseTo(0.15, 9);
  });

  it("無声化母音 (大文字) は小文字に正規化する", () => {
    const withDevoiced: AudioQuery = {
      accent_phrases: [
        {
          moras: [
            {
              consonant: "k",
              consonant_length: 0.05,
              vowel: "I",
              vowel_length: 0.05,
              pitch: 0,
            },
          ],
          pause_mora: null,
        },
      ],
      speedScale: 1,
      pitchScale: 0,
      intonationScale: 1,
      volumeScale: 1,
      pauseLengthScale: 1,
      pauseLength: null,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
    };

    const entries = queryToLipsync(withDevoiced);

    expect(entries[0].vowel).toBe("i");
  });

  it('"N" (撥音) は大文字のまま残す', () => {
    const withN: AudioQuery = {
      accent_phrases: [
        {
          moras: [
            {
              consonant: null,
              consonant_length: null,
              vowel: "N",
              vowel_length: 0.1,
              pitch: 5.0,
            },
          ],
          pause_mora: null,
        },
      ],
      speedScale: 1,
      pitchScale: 0,
      intonationScale: 1,
      volumeScale: 1,
      pauseLengthScale: 1,
      pauseLength: null,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
    };

    const entries = queryToLipsync(withN);

    expect(entries[0].vowel).toBe("N");
  });
});

describe("is_interrogative の上昇 mora", () => {
  const questionQuery: AudioQuery = {
    accent_phrases: [
      {
        moras: [
          {
            consonant: null,
            consonant_length: null,
            vowel: "a",
            vowel_length: 0.1,
            pitch: 5.0,
          },
        ],
        pause_mora: {
          consonant: null,
          consonant_length: null,
          vowel: "pau",
          vowel_length: 0.2,
          pitch: 0,
        },
        is_interrogative: true,
      },
    ],
    speedScale: 1,
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
    pauseLengthScale: 1,
    pauseLength: null,
    prePhonemeLength: 0,
    postPhonemeLength: 0,
  };

  it("queryToLipsync は末尾の mora と同じ母音・0.15 秒のエントリを pause_mora の前に足す", () => {
    const entries = queryToLipsync(questionQuery);

    expect(entries).toHaveLength(3);
    expect(entries[1].vowel).toBe("a");
    expect(entries[1].start).toBeCloseTo(0.1, 9);
    expect(entries[1].end).toBeCloseTo(0.25, 9);
    expect(entries[2].vowel).toBe("pau");
    expect(entries[2].start).toBeCloseTo(0.25, 9);
  });

  it("queryTotalSeconds は 0.15 秒増える (speedScale で割られる)", () => {
    const nonInterrogative: AudioQuery = {
      ...questionQuery,
      accent_phrases: [
        { ...questionQuery.accent_phrases[0], is_interrogative: false },
      ],
    };

    const base = queryTotalSeconds(nonInterrogative);
    const withUpspeak = queryTotalSeconds(questionQuery);

    expect(withUpspeak).toBeCloseTo(base + 0.15, 6);

    const doubledBase = queryTotalSeconds({
      ...nonInterrogative,
      speedScale: 2,
      pitchScale: 0,
      intonationScale: 1,
      volumeScale: 1,
      pauseLengthScale: 1,
    });
    const doubledWithUpspeak = queryTotalSeconds({
      ...questionQuery,
      speedScale: 2,
      pitchScale: 0,
      intonationScale: 1,
      volumeScale: 1,
      pauseLengthScale: 1,
    });

    expect(doubledWithUpspeak).toBeCloseTo(doubledBase + 0.15 / 2, 6);
  });

  it("末尾 mora の pitch が 0 (無声化) なら上昇 mora を足さない", () => {
    const devoicedQuestionQuery: AudioQuery = {
      ...questionQuery,
      accent_phrases: [
        {
          ...questionQuery.accent_phrases[0],
          moras: [{ ...questionQuery.accent_phrases[0].moras[0], pitch: 0 }],
        },
      ],
    };

    const entries = queryToLipsync(devoicedQuestionQuery);

    expect(entries).toHaveLength(2);
    expect(entries[1].vowel).toBe("pau");

    expect(queryTotalSeconds(devoicedQuestionQuery)).toBeCloseTo(
      queryTotalSeconds({
        ...devoicedQuestionQuery,
        accent_phrases: [
          {
            ...devoicedQuestionQuery.accent_phrases[0],
            is_interrogative: false,
          },
        ],
      }),
      6,
    );
  });
});

describe("queryTotalSeconds", () => {
  it("prePhonemeLength・mora 合計・pause_mora・postPhonemeLength を合算する", () => {
    // 手組みの固定データ (実機応答ではない)。0.1 + 0.924 + 0.1 = 0.924 秒に
    // なるよう長さを調整してある。
    const query: AudioQuery = {
      accent_phrases: [
        {
          moras: [
            {
              consonant: "k",
              consonant_length: 0.08,
              vowel: "o",
              vowel_length: 0.09,
              pitch: 5.0,
            },
            {
              consonant: null,
              consonant_length: null,
              vowel: "o",
              vowel_length: 0.07,
              pitch: 5.0,
            },
          ],
          pause_mora: null,
        },
        {
          moras: [
            {
              consonant: "t",
              consonant_length: 0.07,
              vowel: "a",
              vowel_length: 0.08,
              pitch: 5.0,
            },
          ],
          pause_mora: {
            consonant: null,
            consonant_length: null,
            vowel: "pau",
            vowel_length: 0.2,
            pitch: 0,
          },
        },
        {
          moras: [
            {
              consonant: "sh",
              consonant_length: 0.06,
              vowel: "i",
              vowel_length: 0.074,
              pitch: 5.0,
            },
          ],
          pause_mora: null,
        },
      ],
      speedScale: 1,
      pitchScale: 0,
      intonationScale: 1,
      volumeScale: 1,
      pauseLengthScale: 1,
      pauseLength: null,
      prePhonemeLength: 0.1,
      postPhonemeLength: 0.1,
    };

    expect(queryTotalSeconds(query)).toBeCloseTo(0.924, 6);
  });

  it("speedScale で時刻が割られる (2 なら半分になる)", () => {
    const base = queryTotalSeconds(sampleQuery);
    const doubled = queryTotalSeconds({ ...sampleQuery, speedScale: 2 });

    expect(doubled).toBeCloseTo(base / 2, 6);
  });
});
