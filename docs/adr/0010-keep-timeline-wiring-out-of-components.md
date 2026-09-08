---
status: accepted
date: 2026-09-08T05:48:11Z
tags: [remotion, timeline, components]
---

# ADR-0010: timeline の配線を components に置かず tracks に分ける

## Context

`src/components/` には、見た目だけを描くコンポーネント (`VerticalNote`・`PhotoShowcase`・`OpeningFrame`・`Ending` 等) と、`src/timeline/` の値を読んで区間を計算し `<Sequence>` を組む配線 (`DashcamTrack`・`Overlays`・`Bgm`・`VoiceLines`・`Subtitles`・`SubtitleBand`) が同居していた。ファイル名も `Track` を持つもの (`DashcamTrack`) と持たないもの (`Overlays`・`Bgm`) が混在していた。`ChapterTitle` はフェード (`useCurrentFrame`・`useVideoConfig`・`fadeEnvelope`) を自身の内部に持っていた。PR のレビューで、`components/` を見ただけでは配線か見た目かの境界が読めないという指摘があった。

## Decision Drivers

1. `components/` を見ただけで、見た目だけか配線を含むかが判別できる
2. 境界を人力のレビューでなく機械 (ESLint) で守れる
3. 既存の挙動 (レンダリング結果) を変えない

## Considered Options

1. `src/components/` に見た目、`src/tracks/` に配線を分けてファイル名・export 名を揃える — 採用。
2. 1 ファイルに同居させ続ける — 却下。境界がレビューでしか守れず、レビューで指摘が出た実態がある。
3. `components/` の中でサブディレクトリだけ分ける (`components/tracks/`・`components/ui/` 等) — 却下。ディレクトリ名が `src/` 直下に出ないため、`no-restricted-imports` の対象パターン (`src/components/**`) で見た目側だけを縛れず、境界が名前から読めない。
4. `ui/` と `tracks/` に改名する (`components` 自体を廃止) — 却下。見た目側はコンポーネントそのものであり、`components` という名前を変える理由が無い。

## Decision

- `src/components/`: 見た目だけのコンポーネント。固定の props (文字列・数値・URL・Temporal の値) を受けて描く。`src/timeline/`・`src/tracks/` と、`remotion` のフレーム API・媒体要素 (禁止事項に列挙する) を import しない。不透明度などフレーム依存の値も props に持たない (`tracks` が `AbsoluteFill` で包んで掛ける)。
- `src/tracks/`: timeline の track ごとに 1 ファイル。ファイル名と export 名は単数形とし、`Track` の接尾辞は付けない。`VoicedTimeline` の該当 track を受け取り、`src/timeline/` で区間とフェードを計算し、`<Sequence>` を組んで `components` に props を渡す。媒体要素 (禁止事項に列挙する) はここに置く。
- `src/compositions/Motovlog.tsx`: `tracks` を並べるだけにし、`components/` を直接 import しない。
- `overlays` の差し込みは `Video` を含むため例外とし、配置 (位置・倍率) の style も `tracks/Overlay.tsx` に置く。
- 境界は ESLint (`no-restricted-imports`) で守る。禁止事項に列挙した import を `src/components/**` に対して機械的に止める。
- `ChapterTitle` はフェードを持たず、`title`・`subtitle` の描画だけを行う。フェードは呼び出し側の `tracks` が掛ける。

## Consequences

### 利点

- `components/` を見れば、見た目だけであることが名前とディレクトリの位置から分かる。
- ESLint が `components/` への timeline・remotion フレーム API の import を機械的に止める。

### 代償

- ファイル数が増える (`components/` と `tracks/` に分かれる)。
- `Subtitles`・`SubtitleBand` を、文字の描画 (`components/Subtitle`) と暗がりの描画 (`components/SubtitleBand`)・区間計算 (`tracks/Line`) に割る手間が増える。
- `overlays` だけ配置の style を `tracks/Overlay.tsx` に置く例外を持ち、他の track と扱いが揃わない。
- 禁止する import は `remotion` の export の一部を列挙する方式 (denylist) のため、Remotion を更新したときに新しいフレーム API・媒体要素が一覧に無いか見直す必要がある。

### 禁止事項

- `components/` から `src/timeline/` と `tracks/` を import すること。
- `components/` から `remotion` のフレーム API (`useCurrentFrame`・`useVideoConfig`・`Sequence`・`Series`・`Loop`・`Freeze`) を import すること。
- `components/` から媒体要素 (`remotion` の `Audio`・`Video`・`OffthreadVideo`・`Html5Audio`・`Html5Video`・`AnimatedImage`、および `@remotion/media` のすべて) を import すること。
- `tracks/` に見た目の CSS (`*.module.css`) を書くこと。ただし `overlays` の配置 (位置・倍率) の style は除く。

## Assumptions

| 前提                                                                                                               | 状態   | 確認方法 / 結果                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint の `no-restricted-imports` override が `src/components/**` への違反を検出し、`src/tracks/**` では検出しない | 検証済 | 一時ファイルで `components/` に (1) `useCurrentFrame` (`remotion`)・`../timeline/frames.ts` の import、(2) `Audio` (`@remotion/media`)・`../tracks/Line.tsx` の import を書き、`npx eslint` がそれぞれ 2 件のエラーで落ち、同じ import を `tracks/` に書いて通ることを確認した、`Freeze`・`AnimatedImage` の import も同様に検出することを確認した (2026-09-08) |

## References

- ユーザとの検討 (2026-09-08): `src/components/` から timeline の配線を分離し `src/tracks/` を新設する方針、境界を ESLint で守る方針の合意。
