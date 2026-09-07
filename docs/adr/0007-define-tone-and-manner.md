---
status: accepted
date: 2026-09-07T12:03:09Z
refs: [1, 4]
tags: [design, tone-and-manner]
---

# ADR-0007: 車載動画のトンマナを定める

## Context

シリーズとして動画を積み上げるのに、色・文字・配置・出し方のトンマナ (以下 T&M) が無い。既存の timeline ([ADR-0004](./0004-timeline-schema-design.md)) は `style` と `subtitleBands` を持つ。前者は見た目、後者は手置きの帯を指す。そのため動画ごとに見た目を手で置ける。字幕の見た目を issue で個別に決めようとして、基準が先に要ると分かった。

## Decision Drivers

1. 1 本ごとに見た目を変えない
2. 走行映像を主役にし編集は静かに足す
3. ニコニコのコメント弾幕 (上部 1/3) と干渉しない

## Considered Options

1. T&M 文書を正本にし、コードはそれに従う — 採用。
2. 動画ごとに timeline で見た目を決める — 却下。T&M の「1 本ごとに変えない」に反し、基準が散る。
3. Claude Design 上の deck を正本にする — 却下。本人しか開けず、リポジトリの外にある。

## Decision

- 見た目と出し方の値の詳細は `docs/design/tone-and-manner.md` を正とする。
- 書体は Noto Sans JP のみで weight は 400・500・600 とする (文書「タイポグラフィ」節)。
- 字幕は 44px、`--ink-video` (#F2F4EF)、影なし、縁取りと箱を使わず下部の暗がりの上に置く (文書「タイポグラフィ」節)。
- 暗がりは lines から自動で出す (手置きしない) (文書「字幕の出し方」節)。
- 上部 1/3 に常設情報を置かない (文書「画面配置」節)。
- 速度・地名・時刻の常時表示をしない (文書「やらないこと」節)。
- トークン名は design の `:root` と同名にする。
- T&M を変えるときは文書・`src/theme/` (tokens.ts と timing.ts)・本 ADR を更新する。

## Consequences

### 利点

- 見た目の判断を毎回しなくてよい。

### 代償

- T&M の変更は上記 3 箇所に及ぶ。

### 禁止事項

- T&M 文書に無い見た目をコンポーネントに足すこと。

## Assumptions

| 前提                             | 状態   | 確認方法 / 結果                       |
| -------------------------------- | ------ | -------------------------------------- |
| 弾幕は上部 1/3 に溜まる          | 未検証 | 投稿後に確認する                       |
| 字幕 2 行 28 文字で足りる        | 未検証 | #31 の text 形式で確認する             |

## References

- ユーザ作成の Claude Design プロジェクト (2026-09-07): deck 10 面と画面サンプル A〜E。要点は `docs/design/tone-and-manner.md` に転記。
- 同プロジェクトの 2026-09-08 版: CSS 変数の定義、影の削除、暗がりの濃度変更。要点は `docs/design/tone-and-manner.md` に転記。
- 同プロジェクトの 2026-09-08 版 deck: タイミング面の追加、値の更新。要点は `docs/design/tone-and-manner.md` に転記。
- ユーザとの検討 (2026-09-07): weight の読み替え、暗がりの高さと消え方、字幕を消すタイミングの決定。
- [ADR-0001](./0001-use-remotion-for-video-production.md)
- [ADR-0004](./0004-timeline-schema-design.md)
