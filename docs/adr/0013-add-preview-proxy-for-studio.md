---
status: accepted
date: 2026-09-14T19:35:10Z
refs: [3]
tags: [remotion, ffmpeg, studio]
---

# ADR-0013: Studio 用に変換済み素材から低解像度のプロキシを作り、render では本体を使う

## Context

[ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md) で、ドラレコの原本を H.264 の変換済み素材に変換して使うと決めた。変換済み素材は 1080p30 の H.264、ビットレートは約 14Mbps、1 本あたり 1〜6GB になる。timeline.ts の `video()` の `trimBefore` は、この変換済み素材の深い位置までシークして再生を始めることがある。

映像の描画には `@remotion/media` の `<Video>` を使っている。`<Video>` は Remotion Studio では WebCodecs でブラウザ内デコードを行い、解像度や画質を落とすプロパティを持たない。Remotion Studio のドキュメントにも、プレビューの解像度を落とす設定は見当たらない。走行映像の切り替えでは `crossfade` を使っており、遷移の尺の間は 2 つの `<Video>` が同時にマウントされる。

## Decision Drivers

1. `npm run dev` (Remotion Studio) で使える fps が出ること
2. `remotion render` の画質は変換済み素材 (本体) の画質のままにすること
3. 既存 project (変換済み素材だけが存在し、プロキシが無い project) にもプロキシを追加できること

## Considered Options

1. 現状のまま、本体のビットレートを下げる — 却下。完成動画の画質の上限を下げることになり、Studio の fps のためだけに render の画質を犠牲にする。
2. `--public-dir` で Studio の参照先をプロキシ専用ディレクトリに切り替える — 却下。`public/` には音声キャッシュ等、Studio 使用中に書き込まれる素材が同居しており、参照先を丸ごと切り替えられない。
3. プロキシが無いときに本体へフォールバックする (HEAD で存在確認) — 却下。マウントのたびに HTTP の往復が余分に発生する。[ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md) がフォールバックの発生する状態を避ける方針とも合わない。
4. 原本 (HEVC) からプロキシを生成する — 却下。原本は変換後にマウントされていないことがあり、その状態ではプロキシを作れない。変換済み素材から生成すれば、原本が無くても既存 project にプロキシを追加できる。
5. 採用。変換済み素材から `<basename>.preview.mp4` (sidecar) を生成し、`Video` が `useRemotionEnvironment().isRendering` で本体とプロキシを切り替える。

## Decision

- convert (`npm run convert`) は、各入力の変換済み素材 `<basename>.mp4` に加えて、そこから Studio 用プロキシ `<basename>.preview.mp4` を生成する。
- プロキシは変換済み素材 (本体) を入力にして生成する。原本 (HEVC) を直接の入力にしない。
- プロキシのエンコード設定は次のとおりとする。
  - 解像度は 540p (`scale=-2:540`)。
  - GOP 長は本体と同じ値。
  - 映像は nvenc `-cq 30`、libx264 `-crf 30`。
  - 音声は再エンコードせずコピー。
- プロキシが既に存在する入力は再生成をスキップする (本体と同じ規約)。
- 入力のファイル名が `.preview.mp4` で終わるものは、convert が本体としてもプロキシとしても処理せずスキップする。理由: README の後付け手順 (`*.mp4` の glob) が生成済みのプロキシも拾うため。
- `src/components/Video.tsx` は `useRemotionEnvironment().isRendering` が false (Studio) のときプロキシを読む。true (render) のとき本体を読む。
- components 層は `remotion` から `useRemotionEnvironment` を import してよい (ESLint の許可リストに追加する)。
- プロキシが無い場合の救済 (本体へのフォールバック等) は持たない。無ければ convert を再実行してプロキシを作る。
- timeline.ts は引き続き本体のファイル名だけを参照する。`.preview.mp4` を直接指定しない。

## Consequences

### 利点

- Remotion Studio での走行映像の再生が、より小さい解像度のデコードで済むようになる。
- render で参照するファイルは本体のままで、完成動画の画質は変わらない。
- 既存 project も、変換済み素材を入力にして `npm run convert` を再実行すればプロキシを追加できる。

### 代償

- プロキシの分だけディスク使用量が増える (本体 1 本につき 1 つ)。
- 変換済み素材の生成 (原本 → 本体) に加えて、本体 → プロキシの非可逆な再エンコードがもう 1 回増える。プロキシは Studio 表示専用で render には使わないため、完成動画の画質には影響しない。
- Studio で見える映像は本体・render より低い解像度になる。
- 既存 project ([ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md) の運用開始後に変換済みの project) は、プロキシが無い状態のままでは Studio で `<basename>.preview.mp4` が 404 になる。本体を入力にして convert を再実行し、プロキシを追加する必要がある。

### 禁止事項

- プロキシを `remotion render` の `src` に使うこと。
- プロキシを原本 (HEVC) から作ること。
- timeline.ts で `.preview.mp4` を直接指定すること。

## Assumptions

| 前提                                                             | 状態   | 確認方法 / 結果                                                                  |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| 540p・`-cq 30`/`-crf 30` のプロキシで Studio の fps が実用になる | 未検証 | `npm run dev` で走行映像のあるタイムラインを再生し、fps が使える速度かを確認する |

## References

- [ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md): 変換済み素材 (本体) の生成方針。プロキシはこの本体から作る。
- ユーザからの依頼 (2026-09-15): npm run dev で fps が出ないので Studio 用の低解像度プロキシを作る
- https://www.remotion.dev/docs/use-remotion-environment : `useRemotionEnvironment()` の戻り値 (`isStudio`・`isRendering` 等)。
- https://www.remotion.dev/docs/video-tags#using-a-different-tag-in-preview-and-rendering : Studio と render で異なる実装を切り替える書き方。
