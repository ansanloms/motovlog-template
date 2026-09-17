---
status: accepted
date: 2026-09-17T05:00:00Z
refs: [6, 9, 10, 11]
tags: [remotion, timeline, effects, narration, figure]
---

# ADR-0014: timeline に塊 (group) を入れ、narration を塊として置き、立ち絵を発話の括りで出す

## Context

- [ADR-0006](./0006-write-timeline-as-effects-dsl.md) の DSL は `timeline(layers)` の 1 段で、item の位置は動画の先頭からの絶対秒か同じ layer の直前の item からの相対秒で書く。layer の入れ子は無い。
- [ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md) はアンカー (`start()`/`end()`) と `until` を足し、item を別の item 基準で置けるようにした。アンカーの参照先はどの layer の item でもよく、`timeline()` は依存関係の順で解決する。narration の入力 item を参照するには、`cut(line(...))` を const に取り出して `narration()` の配列と立ち絵の item の両方から参照する必要がある。
- [ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) と [ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md) で、発話は `narration()` が暗がりと発話の 2 layer に組み立てる。立ち絵は書き手が `figure()` の item を立ち絵 layer に手で置き、`narration()` が返す `speech` (動画の先頭からの絶対秒) を渡して口パクと表情を合わせる。
- 浄土平 (`projects/20260813-jododaira/timeline.ts`) は発話 51 行と立ち絵 6 item を持つ。立ち絵の item は発話の区間に合わせて置くもので、位置と尺は絶対秒か、区間の先頭と末尾の行への参照で書く。どちらの書き方でも、行を足すか区間を変えるたびに立ち絵の側を直す。
- `Stage` は `Composition` の直下で描かれ、`frame()` の効果と `sample()` の `absolute` は `useCurrentFrame()` が動画の絶対フレームであることに依存している。Remotion の `<Sequence>` の内側では `useCurrentFrame()` が `from` 分だけ付け替えられて 0 起点になる。
- 次の 3 つの要望はいずれも「内部に時間原点を持つ塊を timeline に置く」ことで書ける。
  - 章ごとに timeline を分けて最後に結合したい。
  - narration を `clip1` の 2 秒後のように置きたい。
  - 立ち絵の範囲の中で発話を書きたい。

## Decision Drivers

1. 発話を足したり動かしたりしたとき、立ち絵の位置と尺を書き直さずに済むこと。
2. 塊 (章・narration) を他の item と同じ書き口で置けること。書き口は `cut`/`fade`、`at`/`after`/`until`、アンカーを指す。
3. `src/effects` の item の形と `Stage` の描画規則を壊さず、既存の演出 (crossfade・`frame()`・アンカー) がそのまま使えること。
4. 塊の外から塊の中の item を参照できること。理由: BGM や黒落ちを発話に合わせるため。

## Considered Options

塊の表し方について次の案を検討した。

1. `group(layers)` が返す node を `cut()`/`fade()` で置き、`timeline()` が塊の開始を解決してから内部 layer を「開始 + 相対秒」で解決する — 採用。塊が item の形に収まり、位置・尺・遷移・アンカーの規則を増やさない。
2. `timeline()` の戻り値 (`Timeline`) をそのまま node として置く — 却下。`Timeline` は解決済み (絶対秒・`source` 無し) で、塊の外から内部の item をアンカーで参照できない。fps・幅・高さも塊ごとには持たない。
3. layer は平らなまま、`narration()` が絶対秒の layer を返す現状を維持し、立ち絵だけアンカーで結ぶ — 却下。行を参照するために `cut(line(...))` を const に取り出す書き方が残り、発話の並びと立ち絵の対応が timeline.ts の離れた場所に散る。

narration の置き方について次の案を検討した。

1. `narration()` が塊の node を返し、`cut(n, { at })`/`fade(n, { at, in, out })` で置く — 採用。位置・尺・フェードの書き口が他の node と同じになる。
2. `narration(items, { at, duration })` のように `narration()` 自身が Placement を受ける — 却下。`fade` の `in`/`out` や `until` を `narration()` にも複製することになる。
3. `narration()` を絶対秒のまま残し、章分割だけ塊で書く — 却下。narration が章の塊の中に入れないため、章を動かすと発話の絶対秒を書き直す。

立ち絵の出し方について次の案を検討した。

1. `figure(character, options, items)` で発話の行を括り、`narration()` が括りごとに立ち絵の item を作る — 採用。立ち絵の範囲が発話の並びの中に書かれ、行を足しても範囲が追従する。
2. 書き手が立ち絵の item を手で置き、`start(lineItem)`/`end(lineItem)` で結ぶ — 却下。行を const に取り出す必要があり、範囲の意図が離れた場所に散る。
3. `narration()` が無音の長さから立ち絵の出入りを自動で決める — 却下。左右の切り替えや写真紹介中の非表示は無音の長さからは決まらず、結局同じ情報を別の形で書く。

塊の中の `sample()` の時刻について次の案を検討した。

1. `absolute` を「属する塊の先頭からの秒」と定義し直す — 採用。`narration()` が作る `speech` と立ち絵の `sample()` が同じ塊の座標で比較できる。
2. `Stage` が塊の入れ子を辿って動画の絶対秒を渡す — 却下。`speech` の側も絶対秒に直す必要があり、塊を動かすと両方が変わる。

## Decision

塊について次を決めた。

- `group(layers)` は `GroupNode` (`kind: "group"`、`layers`) を返す。`cut()`・`fade()` の node に置ける。
- 塊の中の item の `at` は塊の先頭からの秒とする。`after`・省略・アンカー・`until`・crossfade は塊の中でも同じ規則で使える。
- 塊の `duration` を省略したときは内部の全 item の終端の最大値を尺とする。`duration` または `until` を明示したとき、内部の item がその尺を超えたら throw する。
- `timeline()` は塊の開始を解決してから内部 layer を解決し、内部 item を共有の解決表に絶対秒で登録する。塊の外の item は `start()`/`end()` で塊の中の item を参照できる。塊の中の item は塊の外の item を参照できない (throw する)。
- 塊の中に塊を置ける。
- 塊の中に `frame()` の item を置いたら throw する。
- `Stage` は塊を `<Sequence>` で置き、内部 item の `from` は「絶対フレーム − 塊のフレーム」で求める。理由: 塊と内部で丸めを重ねない。
- `SampleTime.absolute` は「item が属する塊 (最上位なら動画) の先頭からの秒」とする。

narration について次を決めた。

- `narration(items, options?)` は `GroupNode` を返す。内部 layer は下から立ち絵・暗がり・発話の 3 つとする。`speech` も持つ (塊の先頭からの秒)。
- 行の `at` は塊の先頭からの秒とする。`narration()` の入力 item にアンカーと `until` は使えない (変更なし)。
- 塊は `cut(n, { at })`/`fade(n, { at, in, out })` で置く。位置と尺の規則は他の node と同じとする。
- `narration()` の入力 item への `source` の登録 ([ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md)) は維持する。塊の外から `start(lineItem)` で行を参照できる。

立ち絵について次を決めた。

- `figure(character, { side?, in?, out?, lead?, tail? }, items)` は括り (`FigureGroup`) を返し、`narration()` の入力配列に item と混ぜて置く。
- `narration()` は括りの中の行を配列の順のまま平らにして解決し、括りごとに立ち絵の item を 1 つ作って立ち絵 layer に置く。位置は「括りの最初の行の開始 − lead」、終端は「括りの最後の行の字幕の終端 + tail」とする。`in`/`out` があれば `fade`、無ければ `cut` で置く。
- `lead`・`tail` の既定値は theme の `characterTiming.lead`・`characterTiming.tail` とする。
- 位置が塊の先頭より前になったら throw する。括り同士が重なったら throw する。
- 括りの立ち絵は塊の `speech` のうち同じ character のものを見る。表情は `line()` の指定を括りをまたいで引き継ぐ ([ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md) の規則)。
- `figure()` の `sample()` を返す形は公開しない。立ち絵は括りでだけ出す。

既存の ADR について次を決めた。

- [ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md) の Decision Driver「timeline.ts を平らな時間軸で読めること」を外す。塊の中の時間は塊相対とし、動画の絶対秒は塊の位置から導く。
- [ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md) の「書き手が立ち絵 layer の item を分けて書く」と `speech.at` が絶対秒である記述を、本 ADR の規則に置き換える。

## Consequences

### 利点

- 発話の行を足す・動かすとき、立ち絵の位置と尺を直さずに済む。
- narration と章を `clip1` の 2 秒後のように置け、塊ごとに動かせる。
- 塊の中の item を塊の外からアンカーで参照できるので、BGM や黒落ちを発話に合わせられる。

### 代償

- 動画の絶対秒が timeline.ts のどこにも書かれなくなる。ある時刻に何があるかは Studio のタイムラインで見るか、塊の位置を足し算する。
- `sample()` の `absolute` が塊相対になり、塊をまたぐ時刻の比較はできない。目パチの位相は塊ごとに始まる。
- 塊の中では `frame()` が使えない。合成結果への効果は最上位の layer に置く。
- `narration()` の出力 layer の順 (立ち絵・暗がり・発話) は固定で、塊の外の layer を間に挟めない。立ち絵と字幕はまとめて塊の z 位置に置かれる。

### 禁止事項

- 塊の中の item が塊の外の item をアンカーで参照すること。
- 塊の中に `frame()` の item を置くこと。
- `narration()` の外で立ち絵の item を手で置くこと。理由: 時刻の原点が合わない。
- `narration()` の入力 item にアンカー・`until` を渡すこと。

## Assumptions

| 前提                                                                                        | 状態   | 確認方法 / 結果                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Remotion の `<Sequence>` の入れ子で `useCurrentFrame()` が内側の `from` 基準の 0 起点になる | 検証済 | [ADR-0006](./0006-write-timeline-as-effects-dsl.md) の Context に記録。`Stage` の `Sampled` が同じ前提で動いている |
| 立ち絵の出入りは発話の区間 (最初の行 − lead、最後の行 + tail) で表せる                      | 未検証 | 浄土平の 6 区間を括りで書き直し、書き換え前の位置と尺が lead/tail で再現できるかを確認する                         |
| 塊の外から塊の中の行を参照する用途 (BGM・黒落ち) がある                                     | 未検証 | 浄土平の BGM と黒落ちを発話基準に書き直す機会に確認する                                                            |

## References

- [ADR-0006](./0006-write-timeline-as-effects-dsl.md)、[ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md)、[ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md)、[ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md)
- ユーザからの依頼 (2026-09-16): 章ごとに timeline を切って、最後に cut や fade で結合したい
- ユーザからの依頼 (2026-09-17): 立ち絵の範囲の中でナレーションを設定したい。narration に位置を持たせて `clip1` の 2 秒後から置けるようにしたい。narration の塊は最前面に置く
- `projects/20260813-jododaira/timeline.ts` の立ち絵 6 item と発話 51 行 (2026-09-17 時点)
