---
status: accepted
date: 2026-09-08T11:54:37Z
refs: [6]
tags: [remotion, timeline, effects]
---

# ADR-0009: timeline() に遷移 (crossfade)・frame()・アンカー (start/end) を足す

## Context

- [ADR-0006](./0006-write-timeline-as-effects-dsl.md) で `timeline(layers, options?)` の DSL を定めた。`layers` は layer の配列 (後ろが上)、layer 内は時間順で重ならず、位置は省略・`after`・`at` のいずれかで指定する。演出は `fade` と `cut` の 2 つ。
- この形でサンプルの timeline を書くと、次の 3 つが書けなかった。
  - 走行映像 A から B へのクロスフェード。B を別 layer に上げて `fade` で重ねる形になり、境目の演出が同じ layer の item と item の間に置けない。
  - layer 0 の走行映像と layer 1 の写真をまとめて黒へフェードアウトする演出。それぞれの opacity を独立に下げると写真が半透明になり下の映像が透けて見え、「合成した絵を薄くする」とは別の絵になる。CSS では親要素の `opacity` が子を合成した後に乗る (CSS Color Module Level 4 §3.3)。
  - 別 layer の item を基準にした位置指定。`after` は同じ layer の直前にしか効かず、「あの clip の終端の 2 秒前」は絶対秒を手で書くしかない。
- `Stage` は layer ごとに `AbsoluteFill` を並べ、item ごとに `Sequence` を置く。黒地は敷いておらず、opacity 0 のときに何が見えるかは Remotion の既定に依存している。
- `@remotion/transitions` の `TransitionSeries` は自身の子しか取れない ([ADR-0006](./0006-write-timeline-as-effects-dsl.md) に記載)。

## Decision Drivers

1. `timeline.ts` を平らな時間軸で読めること (時間が入れ子ごとに相対にならない)。
2. 演出の追加が `src/effects` の中で閉じ、`src/components` に触れないこと ([ADR-0006](./0006-write-timeline-as-effects-dsl.md))。
3. 書けない演出 (遷移・合成結果への効果・別 layer 基準の位置) を、既存の item の形を壊さずに足せること。

## Considered Options

論点と未決事項ごとに列挙する。

遷移について次の案を検討した。

1. layer 内の item と item の間に `crossfade({ duration })` を置く — 採用。遷移の位置が AviUtl のシーンチェンジや Remotion の `TransitionSeries.Transition` と同じで、layer 内の連結として読める。
2. 後ろの item を別 layer に上げて `fade` で重ねる — 却下。境目の演出が別の layer に散り、layer 内の連結として読めない。
3. `@remotion/transitions` を導入する — 却下。`TransitionSeries` は自身の子しか取れず、DSL が `Sequence` に平らに展開する構造と噛み合わない。必要な描画は opacity の変化だけで足りる。

合成結果への効果について次の案を検討した。

1. `frame()` を印として `fade(frame(), { ... })` を上の layer に置き、`Stage` が下の layer の合成結果を包んで効果をかける (AviUtl のフレームバッファ型、layer は平らなまま) — 採用。時間軸が平らなまま残る。
2. `fade(stack([...layers]), { ... })` の入れ子 — 却下。時間が入れ子ごとに相対になり、`timeline.ts` を平らな時間軸で読めなくなる。

別 layer 基準の位置について次の案を検討した。

1. item を変数に取り `start(item, offset?)`/`end(item, offset?)` を `at` に渡す — 採用。参照できるのを解決済みの item に限れば循環が起きない。
2. 絶対秒に `"12:34.5"` (mm:ss) 表記を許す — 却下。アンカーがあれば出番が減り、`at` の型が広がるだけになる。

黒地について次の案を検討した。

1. `Stage` の根に `palette.black` の背景を敷く — 採用。opacity 0 のときに何が見えるかを Remotion の透明の扱いに依存させない。
2. 敷かない — 却下。フェードアウトの到達色が描画環境に依存する。

## Decision

遷移について次を決めた。

- `crossfade({ duration })` は `Item` とは別の `Transition` で、layer の item と item の間にだけ置く。
- `Layer` は `readonly (Item | Transition)[]` とする。
- 遷移の直後の item の開始は「直前の item の終端 − 遷移の尺」に固定する。
- 遷移の直後の item に `at`/`after` があれば throw する。
- 次のいずれかなら throw する。
  - 遷移が layer の先頭・末尾にある。
  - 遷移が連続する。
  - 遷移の尺が正の有限でない。
  - 遷移の尺が直前の item の尺より長い、または直後の item の尺より長い (秒の値を直接比較する)。
  - 遷移のフレーム数 (直前の item の終端と、そこから遷移の尺を戻した位置を、それぞれフレームに丸めた差) が 1 に満たない。
  - 直後の item の開始フレームが、直前の item が単独で見え始めるフレーム (直前の item に遷移入りがあればその開始に遷移入りの尺を足した位置、無ければその開始を、フレームに丸めた値) より前。
  - 前後どちらかの item が `frame()` の item。
  - 直前の item が `out` を持つ fade である。
- 遷移は layer 内非重複の唯一の例外で、layer の総尺は遷移の尺だけ縮む。
- 描画は、遷移の直後の item を直前の item の上にマウントし、遷移の区間で opacity を 0 から 1 に上げる。直前の item は変えない。直後の item が `fade` で `in` を持つ場合は乗算する。
- `@remotion/transitions` は導入しない。

合成結果への効果について次を決めた。

- `frame()` は印 (`FrameMarker`) を返し、`fade(frame(), { ... })` で使う。
- `cut(frame(), ...)` は throw する。
- layer 0 の `frame()` は throw する。
- `Stage` は layer を下から `Fragment` で積み、layer 自体には要素を作らない。item は `Sequence` に置き、その内側を `AbsoluteFill` (fade は不透明度を当てたもの) で包む。
- layer に `frame()` の item があれば、それより下の layer の合成結果を `AbsoluteFill` で包み、その opacity を `frame()` の item の `fadeOpacity` にする (現在フレームが item の区間外なら 1)。その layer の `frame()` 以外の item は包んだ結果の上に兄弟として積む。
- `frame()` の無い layer は包まない。
- `frame()` の item の区間外では効果が消える (opacity は 1 に戻る)。フェードアウトで終わる動画は `frame()` の item の終端を動画の終端に合わせて書く。
- `Stage` の根に `palette.black` (`src/theme/tokens.ts`) の背景を敷く。

別 layer 基準の位置について次を決めた。

- `start(item, offset = 0)`/`end(item, offset = 0)` は `Anchor` を返し、`at: number | Anchor` に渡す。
- `after` は数値のままとする。
- `timeline()` は layer を下から、layer 内を前から解決し、解決済みの item を参照同一性で引ける表に積む。
- `Anchor` の参照先が未解決なら throw する。未解決とは次を指す。
  - 上の layer の item。
  - 同じ layer の後ろの item。
  - どの layer にも置かれていない item。
- 同じ item オブジェクトを 2 箇所に置いたら throw する。
- `end(item)` は解決後の終端 (遷移で縮んだ後の値) を指す。
- 解決した値には既存の時間順検査を適用する。
- mm:ss 表記は導入しない。

## Consequences

### 利点

- 遷移・合成結果への効果・別 layer 基準の位置を、`timeline.ts` の平らな時間軸のまま書ける。
- 追加はすべて `src/effects` の中で閉じ、`src/components` は変わらない。
- 時間解決 (`timeline()`) が純粋関数のままで、遷移・アンカーの解決を単体テストできる。

### 代償

- layer 内非重複の不変条件に例外 (遷移) ができ、`timeline()` の解決と `Stage` の描画が遷移を特別扱いする。
- `frame()` のある layer で `Stage` の DOM が 1 段深くなる。
- アンカーは item の参照同一性に依存するため、同じ item を複数箇所で使い回せない。
- `frame()` の効果は item の区間外で消える。

### 禁止事項

- 遷移を layer の先頭・末尾、または遷移の隣に置くこと。
- 遷移の直後の item に `at`/`after` を書くこと。
- `frame()` を `cut` や layer 0 に置くこと。
- `Anchor` で上の layer や同じ layer の後ろの item を参照すること。
- `src/effects` が `src/components`・`src/compositions`・`projects` を import すること ([ADR-0006](./0006-write-timeline-as-effects-dsl.md) の禁止事項を引き継ぐ)。

## Assumptions

| 前提                                                                             | 状態   | 確認方法 / 結果                                |
| -------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| 走行映像は不透明で、直後の item の opacity を上げるだけでクロスフェードになる    | 未検証 | サンプルの timeline で遷移を Studio で確認する |
| `frame()` の入れ子 1 段で render 時間が実用上変わらない                          | 未検証 | サンプルの render 時間を比較する               |
| 遷移の種類を増やすとき (ワイプ等) も、直後の item にかける効果の差し替えで足りる | 未検証 | ワイプを足すときに確認する                     |

## References

- [ADR-0006](./0006-write-timeline-as-effects-dsl.md)
- 2026-09-08: issue #59 に設計議論の案を残し、同日の会話で 3 論点と未決事項 (1 PR、案 1 の採用、黒地、mm:ss と音量の対象外) を決めた。
- AviUtl のシーンチェンジ・フレームバッファ、Remotion の `TransitionSeries.Transition` の位置付けを参考にした。
- [CSS Color Module Level 4 §3.3 Transparency: the opacity property](https://www.w3.org/TR/css-color-4/#transparency): opacity は要素全体 (内容を含む) にかかり、子孫ごとには適用されない。
