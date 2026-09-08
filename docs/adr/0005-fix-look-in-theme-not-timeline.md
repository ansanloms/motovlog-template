---
status: accepted
date: 2026-09-08T12:13:14Z
refs: [4]
tags: [remotion, timeline, theme]
---

# ADR-0005: 見た目を timeline で変えず theme の定数に固定する

## Context

projects/<slug>/timeline.ts の要素 (コンポーネントの呼び出し) に色・書体・配置等の見た目の値を渡せる作りでは、動画ごとに見た目が変わりうる。[ADR-0004](./0004-define-tone-and-manner.md) で見た目を T&M に固定し、暗がりは自動で出すと決めた。

## Decision Drivers

1. T&M の「1 本ごとに変えない」
2. 見た目の正本を 1 つにする
3. timeline.ts は timing と素材参照だけを持つ

## Considered Options

1. コンポーネントの props に色・書体等の見た目の値を持たせず、`src/theme/tokens.ts` の定数から読む — 採用。
2. コンポーネントの props で見た目を上書きできるようにし、既定値を T&M にする — 却下。T&M が禁じる変更を props が許し、正本が 2 つになる。
3. props に見た目の値を持たせるが使わない — 却下。死んだフィールドになる。
4. Tailwind CSS — 却下。クラス文字列でトークンを表現するため、`src/theme/tokens.ts` の値を型で縛れない。
5. ゼロランタイム CSS-in-JS (vanilla-extract 等) — 却下。バンドラ (Rspack) 対応の検証が要り、このリポジトリの規模に見合わない。
6. ランタイム CSS-in-JS (styled-components・Emotion 等) — 却下。両者ともメンテナンスモードに入っている。

## Decision

- コンポーネントの props に色・書体等の見た目の値を持たせない。
- 見た目の値は `src/theme/tokens.ts` に置き、秒数は `src/theme/timing.ts` に置く。コンポーネントは `src/theme` から読む。
- 暗がりの区間は timeline の要素から導出する (導出の関数はこの ADR では決めない)。
- 見た目を変えるときは theme と T&M 文書を変え、timeline.ts は変えない。
- 見た目のトークン (色・書体・文字階層・配置) の正本は `src/theme/tokens.ts` とし、CSS からは CSS 変数 (`ThemeRoot` が流し込む) で参照する。
- 静的なスタイルは各コンポーネントの `*.module.css` に書き、トークンは `var(--...)` で参照する。色・サイズの値を CSS に直接書かない。
- フレームごとに変わる値 (不透明度・位置・スケール) はインラインスタイルで渡す。CSS の `transition`・`@keyframes` は使わない (Remotion のフレーム独立描画と同期しないため、https://www.remotion.dev/docs/troubleshooting/css-animations を参照)。
- 秒数のトークンは `src/theme/timing.ts` に置き、CSS 変数にしない。

## Consequences

### 利点

- コンポーネントの props が timing と素材参照に絞られる。

### 代償

- 動画ごとの例外的な見た目 (あるとしても) は timeline.ts で表現できない。

### 禁止事項

- 見た目の値をコンポーネントの props や timeline.ts に持たせること。
- コンポーネントが theme を迂回して色・サイズを持つこと。

## Assumptions

| 前提                               | 状態   | 確認方法 / 結果                                                |
| ---------------------------------- | ------ | -------------------------------------------------------------- |
| 見た目の例外が必要になる動画は無い | 未検証 | 動画を複数本作った後に、例外が必要になった事例の有無を確認する |

## References

- [CSS animations do not work correctly | Remotion](https://www.remotion.dev/docs/troubleshooting/css-animations)
- 設計整理 (2026-09-08): 現在の設計を 1 から記述し直した
