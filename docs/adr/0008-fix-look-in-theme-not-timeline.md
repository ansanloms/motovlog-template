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

1. `style`・`subtitleBands` を schema から外し、見た目は `src/theme/tokens.ts` の定数にする — 採用。
2. `style` を残し既定値を T&M にする — 却下。T&M が禁じる変更を schema が許し、正本が 2 つになる。
3. `style` を残して無視する — 却下。死んだフィールドになる。
4. Tailwind CSS — 却下。クラス文字列でトークンを表現するため、`src/theme/tokens.ts` の値を型で縛れない。
5. ゼロランタイム CSS-in-JS (vanilla-extract 等) — 却下。バンドラ (Rspack) 対応の検証が要り、このリポジトリの規模に見合わない。
6. ランタイム CSS-in-JS (styled-components・Emotion 等) — 却下。両者ともメンテナンスモードに入っている。

## Decision

- timeline schema から `style` と `subtitleBands` を外す。
- 見た目の値は `src/theme/tokens.ts` に置き、秒数は `src/theme/timing.ts` に置く。コンポーネントは `src/theme` から読む。
- 暗がりの区間は lines の start と duration から `src/timeline/band.ts` で導く。
- 見た目を変えるときは theme と T&M 文書を変え、timeline は変えない。
- `version` は 1 のままとする。理由: 運用開始前で既存の timeline は無い ([ADR-0000](./0000-record-architecture-decisions.md) の例外)。
- 見た目のトークン (色・書体・文字階層・配置) の正本は `src/theme/tokens.ts` とし、CSS からは CSS 変数 (`ThemeRoot` が流し込む) で参照する。
- 静的なスタイルは各コンポーネントの `*.module.css` に書き、トークンは `var(--...)` で参照する。色・サイズの値を CSS に直接書かない。
- フレームごとに変わる値 (不透明度・位置・スケール) はインラインスタイルで渡す。CSS の `transition`・`@keyframes` は使わない (Remotion のフレーム独立描画と同期しないため。https://www.remotion.dev/docs/troubleshooting/css-animations)。
- 秒数のトークンは `src/theme/timing.ts` に置き、CSS 変数にしない。

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
- 調査 (2026-09-08): CSS Modules は webpack・Vite・Rspack で標準サポートされ、ランタイム CSS-in-JS はメンテナンスモード、ゼロランタイム系は保守状況に差がある。
- [CSS animations do not work correctly | Remotion](https://www.remotion.dev/docs/troubleshooting/css-animations)
