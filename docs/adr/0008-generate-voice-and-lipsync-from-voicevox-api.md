---
status: accepted
date: 2026-09-08T13:45:25Z
refs: [2, 10]
tags: [voicevox, lipsync, node]
---

# ADR-0008: セリフ音声と口パクデータを VOICEVOX ENGINE の API から生成する

## Context

モトブログのセリフは VOICEVOX のキャラクター (青山龍星) の音声で、字幕と立ち絵の口パクを伴う。音声をどう作り、口パクのデータをどこから得るかを決める。既存動画は AviUtl と PSDToolKit で、VOICEVOX の GUI から書き出した wav と、母音ごとの口パーツの切り替えで作っていた。

VOICEVOX ENGINE は LAN 上の別サーバで HTTP API として稼働している。2026-09-06 から 07 にかけて、この API を実機で確認した。

- `/audio_query` は文章を受け取り、mora ごとの子音・母音とそれぞれの長さ (秒) を含む query を返す。無声化した母音は大文字、促音は `cl`、句読点の休止は `pause_mora` で表される。
- `/synthesis` はその query から wav (24kHz・mono) を返す。query の `speedScale`・`pitchScale` 等を書き換えて合成できる。
- 台本 4 文で、mora の長さの合計と wav の実尺の差は −21 ms から +19 ms だった。
- 固有名詞の読み間違いが出る (「浄土平」が「じょうどたいら」)。平仮名で渡すと正しく読む。VOICEVOX のエディタが解釈する `{漢字|よみ}` の記法は、API はそのまま文として読み、解釈しない。
- lab ファイル (音素のタイミング) を返すエンドポイントは無い。
- `/user_dict_word` でエンジンのユーザ辞書に読みを登録できる。

mora の母音区間をそのまま口パクのタイムラインにし、母音ごとに色を変えた矩形を描く仮実装で、音声と口の切り替わりが合うことを確認した。

スクリプトのランタイムは、リポジトリが Node.js (Remotion) で動いていることを踏まえて Node.js に決めた。

## Decision Drivers

1. 台本を直せば、コマンドの再実行だけで音声と口パクを再生成できること
2. 口パクのタイミングが音声と 1 フレーム (33 ms) 以内で合うこと
3. 固有名詞の読みを直せること
4. GUI を経由せず、コマンドで再生成できること
5. ランタイムと依存を Remotion と同じ 1 系統に保つこと

## Considered Options

1. 台本を入力に、Node.js のスクリプトが VOICEVOX ENGINE の API で wav と口パク用データを生成する — 採用。GUI を経由しない。mora データの精度は口パクに足りる。
2. VOICEVOX のエディタで作った `.vvproj` を入力にする — 却下。GUI の操作が毎回要る。
3. lab ファイルから音素のタイミングを得る — 却下。ENGINE にエンドポイントが無く、エディタの書き出しに依存する。mora データで同じ情報が得られる。
4. wav の振幅から口の開きを決める — 却下。母音の区別ができず、mora データより精度が低い。
5. スクリプトを Deno で書く — 却下。ランタイムが 2 系統になる。

## Decision

- 読みは `{漢字|よみ}` の記法で台本に書く。読みが無い部分はそのまま読む。字幕には漢字表記を、合成には読みを使う。この展開はスクリプトが行う。繰り返し使う固有名詞は ENGINE のユーザ辞書に登録してもよい。
- 話者は VOICEVOX のスタイル id (`speaker`) で指定する。
- 音声と口パクデータの生成は Node.js のスクリプト (`scripts/` 配下、TypeScript) が行う。生成は `npm run dev` の watcher と `npm run render` の前段が行う ([ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md))。ENGINE の URL は環境変数 `VOICEVOX_URL` で渡し、既定の置き場は `.env` とする。
- スクリプトはセリフごとに `/audio_query` を呼んで query を得て、`/synthesis` でその query から wav を合成する。
- 生成物 (wav と JSON) は `public/projects/<slug>/lines/` に置く。生成物はコミットしない ([ADR-0002](./0002-project-directory-layout.md))。
- JSON は次の項目を持つ。
  - `text`: 字幕の表記。
  - `voice`: 合成に使った声質。
  - `reading`: 合成に使った読み。
  - `duration`: wav の実尺 (秒)。
  - `lipsync`: 口パク用の母音区間の列。
  - `generatedAt`: 生成した時刻。
- 生成物のファイル名と timeline.ts への載せ方は [ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) で決める。

## Consequences

### 利点

- 台本を直せば、スクリプトの再実行で音声・口パクを追従させられる。
- 口パクのタイミングが合成エンジンの mora データから決まり、音声解析を要しない。

### 代償

- 動画を作るたびに VOICEVOX ENGINE が稼働している必要がある。生成物をコミットしないため、音声を復元するには常に ENGINE が要る。
- イントネーションの手直しはこの ADR では扱わない。読み・ユーザ辞書・query の上書きで対処できる余地はある。
- `tsx` 等、TypeScript をそのまま実行する devDependency が要る。

### 禁止事項

- 生成した wav と sidecar JSON をコミットすること。
- VOICEVOX エディタの `.vvproj` を音声生成の入力にすること。

## Assumptions

| 前提                                                                    | 状態   | 確認方法 / 結果                                                                  |
| ----------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| API の自動イントネーションが、エディタでの手直し無しで公開品質に足りる  | 未検証 | 実際の動画 1 本分を合成して聞き、手直しが要った箇所の数を数える                  |
| mora の長さの合計と wav の実尺の差が、長い文でも 1 フレーム以内に収まる | 未検証 | 4 文 (最長 4 秒) で ±21 ms 以内 (2026-09-06)。長文と句読点の多い文で再確認する   |
| VOICEVOX ENGINE が LAN 上で稼働し続け、API の互換性が保たれる           | 未検証 | ENGINE を更新したときにスクリプトの生成結果 (query の項目と wav の尺) を確認する |

## References

- https://github.com/VOICEVOX/voicevox_engine : VOICEVOX ENGINE。API の仕様は稼働中のエンジンの `/openapi.json` で確認した。
- 設計整理 (2026-09-08): 現在の設計を 1 から記述し直した
