---
status: accepted
date: 2026-09-06T15:21:14Z
refs: [2, 4]
tags: [voicevox, lipsync, node]
---

# ADR-0006: セリフ音声と口パクデータを VOICEVOX ENGINE の API から生成する

## Context

モトブログのセリフは VOICEVOX のキャラクター (青山龍星) の音声で、字幕と立ち絵の口パクを伴う。[ADR-0004](./0004-timeline-schema-design.md) の timeline は `lines` に `audio`・`start`・`duration`・`text` を持つが、音声をどう作り、口パクのデータをどこから得るかは決めていない。既存動画は AviUtl と PSDToolKit で、VOICEVOX の GUI から書き出した wav と、母音ごとの口パーツの切り替えで作っていた。

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

1. 台本の変更が 1 か所 (timeline) で済み、音声と字幕と口パクが自動で追従すること
2. 口パクのタイミングが音声と 1 フレーム (33 ms) 以内で合うこと
3. 固有名詞の読みを台本の中で直せること
4. GUI を経由せず、コマンドで再生成できること
5. ランタイムと依存を Remotion と同じ 1 系統に保つこと

## Considered Options

1. timeline の `lines` に台本と話者を書き、Node.js のスクリプトが VOICEVOX ENGINE の API で wav と mora データを生成する — 採用。台本が timeline に一元化され、GUI を経由しない。mora データの精度は口パクに足りる。schema をスクリプトから直接 import できる。
2. VOICEVOX のエディタで作った `.vvproj` を入力にする — 却下。台本が `.vvproj` と timeline の 2 か所に分かれ、GUI の操作が毎回要る。エディタでの手直しが必要になったときは、query を取り込む経路を後から足せる。
3. lab ファイルから音素のタイミングを得る — 却下。ENGINE にエンドポイントが無く、エディタの書き出しに依存する。mora データで同じ情報が得られる。
4. wav の振幅から口の開きを決める — 却下。母音の区別ができず、mora データより精度が低い。
5. スクリプトを Deno で書く — 却下。ランタイムが 2 系統になり、Remotion 側の schema を import できない。

## Decision

- セリフの台本は timeline の `lines[].text` に書く。字幕もこの `text` から作る。
- `lines[]` に話者 `speaker` (VOICEVOX の style id) を持たせる。timeline のトップレベルに既定の話者を置き、`lines[].speaker` はそれを上書きする。
- 読みは `{漢字|よみ}` の記法で `text` に書く。字幕には漢字を、合成には読みを使う。この展開はスクリプトが行う。繰り返し使う固有名詞は ENGINE のユーザ辞書に登録してもよい。
- 音声と口パクデータの生成は Node.js のスクリプト (`scripts/` 配下、TypeScript) が行い、`npm run` から呼べるようにする。ENGINE の URL は環境変数で渡す。
- スクリプトは `lines` ごとに `/audio_query` と `/synthesis` を呼び、wav を `public/projects/<slug>/lines/<id>.wav` に、口パクデータを `public/projects/<slug>/lines/<id>.lipsync.json` に書く。同じ `text` と `speaker` で生成済みの line は再生成しない。
- 口パクデータは母音区間の配列 (`start`・`end` は秒、`vowel` は a・i・u・e・o・N・cl・pau) とする。子音の区間は直前の母音の口形を維持する扱いで、配列には含めない。
- スクリプトは `lines[].audio`・`lines[].lipsync`・`lines[].duration` を timeline に書き戻す。`duration` は wav の実尺とする。
- schema は `lines[].speaker`・`lines[].lipsync` を optional で足し、`lines[].duration` は生成前に省略できるようにする。`calculateMetadata` は `duration` の無い line を「音声が未生成」として明確なエラーで拒否する。互換性を切らないため `version` は 1 のまま。
- 立ち絵の口パクは `CharacterLayer` が口パクデータを読み、母音を口パーツに対応付けて描く。`cl`・`pau` と配列の範囲外は閉口とする。口パーツの規約は立ち絵の ADR で決める。

## Consequences

### 利点

- 台本を timeline で直せば、`npm run` 1 回で音声・字幕・口パクが追従する。
- 口パクのタイミングが合成エンジンの mora データから決まり、音声解析を要しない。
- 生成物は `public/projects/<slug>/` に閉じ、timeline には人が書く値と生成結果の要点 (`duration`) だけが残る。

### 代償

- 動画を作るたびに VOICEVOX ENGINE が稼働している必要がある。タグからの再現でも、音声を復元するには ENGINE が要る。
- イントネーションの手直しはエディタでできず、`text` の読み・ユーザ辞書・query の上書き (必要になったら足す) で行う。
- スクリプトが timeline.json を書き換えるため、人の編集とスクリプトの書き戻しが同じファイルに入る。
- `tsx` 等、TypeScript をそのまま実行する devDependency が 1 つ増える。

### 禁止事項

- 台本を timeline 以外の場所 (`.vvproj`・別ファイル) に正本として置くこと。
- 生成した wav と口パクデータをコミットすること。
- `lines[].duration` を手で書くこと (wav の実尺とずれる)。

## Assumptions

| 前提                                                                    | 状態   | 確認方法 / 結果                                                                  |
| ----------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| API の自動イントネーションが、エディタでの手直し無しで公開品質に足りる  | 未検証 | 実際の動画 1 本分を合成して聞き、手直しが要った箇所の数を数える                  |
| mora の長さの合計と wav の実尺の差が、長い文でも 1 フレーム以内に収まる | 未検証 | 4 文 (最長 4 秒) で ±21 ms 以内 (2026-09-06)。長文と句読点の多い文で再確認する   |
| VOICEVOX ENGINE が LAN 上で稼働し続け、API の互換性が保たれる           | 未検証 | ENGINE を更新したときにスクリプトの生成結果 (query の項目と wav の尺) を確認する |

## References

- [ADR-0002](./0002-project-directory-layout.md): 生成物の置き場 `public/projects/<slug>/` と、それをコミットしない決定。
- [ADR-0004](./0004-timeline-schema-design.md): `lines` の形式と、互換性を切らないフィールド追加の規則。
- VOICEVOX ENGINE の API の実機確認 (2026-09-06〜07): `/audio_query` の mora データ、`/synthesis` の wav、4 文での長さの差、`{漢字|よみ}` を API が解釈しないこと、母音ごとの矩形による口パクの確認。
- ユーザとの検討 (2026-09-06〜07): 入力を timeline の台本にする判断、`{漢字|よみ}` の記法、`duration` の書き戻し、ランタイムを Node.js にする判断。
- https://github.com/VOICEVOX/voicevox_engine : VOICEVOX ENGINE。API の仕様は稼働中のエンジンの `/openapi.json` で確認した。
