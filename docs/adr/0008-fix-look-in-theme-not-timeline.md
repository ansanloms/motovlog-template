---
status: accepted
date: 2026-09-07T12:03:09Z
refs: [4, 7]
tags: [remotion, timeline, schema, theme]
---

# ADR-0008: 見た目を timeline で変えず theme の定数に固定する

## Context

[ADR-0004](./0004-timeline-schema-design.md) の timeline は `style` と `subtitleBands` を持つ。前者は字幕と帯の見た目、後者は手置きの帯を指す。[ADR-0007](./0007-define-tone-and-manner.md) で見た目を T&M に固定し、暗がりは lines から自動で出すと決めた。

## Decision Drivers

1. T&M の「1 本ごとに変えない」
2. 見た目の正本を 1 つにする
3. timeline は timing と素材参照だけを持つ

## Considered Options

1. `style`・`subtitleBands` を schema から外し、見た目は `src/theme.ts` の定数にする — 採用。
2. `style` を残し既定値を T&M にする — 却下。T&M が禁じる変更を schema が許し、正本が 2 つになる。
3. `style` を残して無視する — 却下。死んだフィールドになる。

## Decision

- timeline schema から `style` と `subtitleBands` を外す。
- 見た目の値は `src/theme.ts` に置き、コンポーネントはそこから読む。
- 暗がりの区間は lines の start と duration から `src/timeline/band.ts` で導く。
- 見た目を変えるときは theme と T&M 文書を変え、timeline は変えない。
- `version` は 1 のままとする。理由: 運用開始前で既存の timeline は無い ([ADR-0000](./0000-record-architecture-decisions.md) の例外)。

## Consequences

### 利点

- schema が timing と素材参照に絞られる。

### 代償

- 動画ごとの例外的な見た目 (あるとしても) は timeline で表現できない。

### 禁止事項

- 見た目のフィールドを timeline に足すこと。
- コンポーネントが theme を迂回して色・サイズを持つこと。

## Assumptions

| 前提                                     | 状態   | 確認方法 / 結果                                             |
| ----------------------------------------- | ------ | ------------------------------------------------------------ |
| 見た目の例外が必要になる動画は無い       | 未検証 | 動画を複数本作った後に、例外が必要になった事例の有無を確認する |

## References

- [ADR-0004](./0004-timeline-schema-design.md)
- [ADR-0007](./0007-define-tone-and-manner.md)
- ユーザとの検討 (2026-09-07): コンポーネント単位で issue を切り timeline の組み立ては最後に行う判断。
