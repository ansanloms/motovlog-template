---
status: accepted
date: 2026-09-08T12:13:14Z
refs: [6]
tags: [remotion, temporal, timeline]
---

# ADR-0007: 日付と時間は Temporal で表し Date を使わない

## Context

timeline に走行日・走行時間を書く必要が出た (ED の走行データ)。JavaScript の `Date` はタイムゾーンを持たず、暦日と時刻と経過時間の区別が無い。Temporal API は `ZonedDateTime` (ゾーン付きの日時)・`PlainDate`・`Duration` (経過時間の量) を型で区別する。Node 24.19 と TypeScript 5.9.3 には Temporal が無く、TypeScript 6.0 で型が入る。`temporal-polyfill` はグローバルに Temporal を入れられ、5.9 向けの型定義を持つ。Remotion の `calculateMetadata` が返す props は JSON 化できる値に限られ、例外は `Date`・`Map`・`Set`・`staticFile()` だけである。詳細は https://www.remotion.dev/docs/calculate-metadata を参照。

## Decision Drivers

1. 暦日・日時・経過時間を型で区別する
2. タイムゾーンを値に持たせる
3. 将来ネイティブ実装に置き換えられる
4. Remotion の props の制約を守る
5. 違反を静的解析で止める

## Considered Options

1. Temporal + ポリフィル (グローバル) — 採用。
2. `Date` のまま — 却下。ゾーンと経過時間を表せない。
3. `@js-temporal/polyfill` (named export) — 却下。全ファイルで import が要り、ネイティブ移行時に書き換えが要る。
4. 日付を文字列で書き Temporal で検証だけする — 却下。timeline に書く値が型を持たない。

## Decision

- 日付・日時・経過時間は Temporal で表す (`ZonedDateTime`・`Duration` 等)。
- `Date` は使わず、ESLint の `no-restricted-globals` で止める。
- ポリフィルは `temporal-polyfill` をバンドルの入口・vitest の setup・`scripts/convert-movie.ts` でグローバルに入れる。
- Composition の props は slug のみで Temporal の値を含まない ([ADR-0006](./0006-write-timeline-as-effects-dsl.md))。timeline.ts からコンポーネントへは Temporal のインスタンスをそのまま渡す。Temporal の値を Composition の props に載せる必要が生じたときは、読み込み時に ISO 文字列へ変換する関数を別途置く。
- 表示のタイムゾーンは値自身のゾーンとする。

## Consequences

### 利点

- 暦日・日時・経過時間を型で区別できる。
- 日時の値がタイムゾーンを持つ。
- ネイティブ実装へ移行するときは import の削除だけで済む。

### 代償

- `temporal-polyfill` への依存が増える。
- `projects/<slug>/timeline.ts` に `Temporal.*.from()` を書く手間が増える。

### 禁止事項

- `Date` を使うこと。
- Temporal のインスタンスを Remotion の props に載せること。
- 日時を文字列のまま timeline に書くこと。

## Assumptions

| 前提                                                                                        | 状態   | 確認方法 / 結果                     |
| ------------------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| Chromium 149 (Remotion のレンダリング用) でポリフィルがネイティブと衝突しない               | 未検証 | render で確認する                   |
| TypeScript 6.0 へ上げたときに `temporal-polyfill/types/global` の参照を外せば型が重複しない | 未検証 | TypeScript 6.0 へ上げた際に確認する |

## References

- https://www.remotion.dev/docs/calculate-metadata : `calculateMetadata` の props が JSON 化できる値に限られ、`Date`・`Map`・`Set`・`staticFile()` が例外であること。
- https://github.com/fullcalendar/temporal-polyfill/blob/main/README.md : `temporal-polyfill/global` でのグローバル導入と、TypeScript 6.0 未満向けの `temporal-polyfill/types/global` の型参照。
- 設計整理 (2026-09-08): 現在の設計を 1 から記述し直した
