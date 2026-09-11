---
status: accepted
date: 2026-09-08T12:13:14Z
refs: [1, 2]
tags: [remotion, ffmpeg, convert]
---

# ADR-0003: ドラレコの原本を H.264 の変換済み素材に変換して使う

## Context

[ADR-0001](./0001-use-remotion-for-video-production.md) で Remotion を採用し、[ADR-0002](./0002-project-directory-layout.md) で動画固有の素材は `public/projects/<slug>/` に置くと決めた。モトブログの背景映像はドラレコの原本で、1 本が HEVC・1080p・24fps・約 43 分・約 8GB の長尺ファイルになる。原本は Windows 側のストレージ (WSL からは 9P 経由の `/mnt/c`) にあり、Remotion のプロジェクトは WSL の ext4 上にある。

Remotion の映像コンポーネントには次の事実がある。

- 公式は新規コードに `@remotion/media` の `<Video>` を推奨している。対応コーデックは H.264・VP8・VP9 等で、H.265 (HEVC) は含まれない。非対応のコーデックは `<OffthreadVideo>` にフォールバックし、レンダリング速度は `<Video>` より落ちる。
- `<Video>` と `<OffthreadVideo>` は `trimBefore`・`trimAfter` で再生区間をフレーム単位で指定できる。

2026-09-01 から 09-02 にかけて、上記の原本 1 本で取り込み方式を検証した。

- HEVC 原本を ext4 に置いて直接読むと、静止画 1 枚の取得に約 57 秒かかり、既定のタイムアウト (28 秒) を超える。
- H.264・30fps の変換済み素材を ext4 に置くと、静止画 1 枚が 4〜6 秒、10 秒のレンダリングが 54〜60 秒、深い位置からの 60 秒の持続レンダリングが 0.224 秒/フレームになる。`<OffthreadVideo>` へのフォールバックが起きていないことも確認した。
- シンボリックリンクで `public/` 配下に置いたファイルは、Remotion の配信サーバが拒否して 404 になる。
- 原本の変換は、NVENC で 8 分 48 秒・出力 4.80GB (`-cq 23`)、libx264 では約 10.8 倍の時間がかかる。WSL では ffmpeg が `libcuda.so.1` を見つけられず、`LD_LIBRARY_PATH=/usr/lib/wsl/lib` の指定で解決した。
- Remotion Studio のプレビューでは HEVC 原本も変換済み素材も即時に追従し、差は出なかった。ただし編集とレンダリングで参照する `src` は同じファイルになる。

## Decision Drivers

1. レンダリングが `<Video>` の本来の経路 (フォールバック無し) で動くこと
2. 静止画の取得がタイムアウト内に終わり、Studio と render の両方で実用になること
3. 台本や区間の変更で素材の再変換が発生しないこと
4. 変換時間とディスク使用量が 1 本あたり許容範囲に収まること
5. 原本に手を加えず、読み取りだけで済むこと

## Considered Options

1. 原本をファイル単位で H.264 の変換済み素材に変換し、`public/projects/<slug>/` に実体で置く — 採用。`<Video>` がフォールバック無しで読め、静止画・レンダリングともに実用の速度になる。区間は Remotion 側の trim で切るので、編集の変更で再変換が起きない。
2. HEVC 原本を直接読む — 却下。静止画 1 枚に約 57 秒かかりタイムアウトする。`<Video>` が HEVC を扱えず `<OffthreadVideo>` にフォールバックする。
3. シンボリックリンクで原本や変換済み素材を `public/` 配下に見せる — 却下。配信サーバが拒否する。
4. 9P (`/mnt/c`) 上の実体を `--public-dir` で参照する — 却下。ext4 と同等という計測は直前の複製でキャッシュが温まった状態の小さな読み取りによるもので、一般化できない。変換済み素材は ext4 上で生成されるため、9P に置き直す利点が無い。
5. 使う区間だけを切り出して変換する — 却下。台本や区間の変更のたびに再変換が要り、原本への往復が発生する。
6. libx264 だけで変換する — 却下。NVENC の約 10.8 倍の時間がかかる。NVENC が使えない環境の代替として残す。

## Decision

- ドラレコ原本 (HEVC) を timeline から直接参照しない。原本 1 ファイルを 1 つの H.264 の変換済み素材に変換し、`public/projects/<slug>/` に実体として置く。
- 変換済み素材は H.264・AAC・faststart とし、フレームレートは composition の fps に合わせる。GOP 長はフレームレートと同じ値 (1 秒ごとにキーフレーム) とする。
- 変換は ffmpeg で行う。NVENC (`h264_nvenc`、`-preset p4 -cq 23`) を優先し、失敗したときは libx264 (`-preset veryfast -crf 22`) にフォールバックする。WSL では `LD_LIBRARY_PATH=/usr/lib/wsl/lib` を付けて実行する。
- 原本に触れるのは変換時の読み取り 1 回だけとし、原本は書き換えない。原本の保管場所は [ADR-0002](./0002-project-directory-layout.md) に従いリポジトリの外とする。
- 使う区間は timeline で指定し、Remotion の `trimBefore`・`trimAfter` で切る。区間や台本の変更で再変換しない。
- 映像の描画には `@remotion/media` の `<Video>` を使う。
- 変換済み素材のファイル名は原本のファイル名の拡張子を `.mp4` に変えたものとし、既に存在する変換済み素材は再変換しない。
- fps は `src/theme/timing.ts` の `fps` 1 つを正本とし、convert (`npm run convert`、fps の指定を持たない) と composition (`timeline()` が theme から読む) が同じ値を使う。

## Consequences

### 利点

- 静止画とレンダリングが `<Video>` の本来の経路で動き、Studio でも render でも同じファイルを使える。
- 区間の調整が timeline の数値の変更で済み、原本を開き直さない。
- 変換は 1 本 1 回で、NVENC なら 10 分以内に終わる。

### 代償

- 原本 1 本につき約 9 分の変換と約 4.8GB のディスクが要る。
- NVENC に依存する。GPU が使えない環境では libx264 で約 10 倍の時間がかかる。WSL ではライブラリパスの指定が要る。
- composition の fps が原本 (24fps) と異なる場合、再標本化により原本と変換済み素材でフレームの対応が 1 対 1 にならない。
- 原本と変換済み素材の二重管理になり、変換済み素材は git 管理外なので復元には再変換が要る。
- 変換は非可逆の再エンコードで、変換済み素材の画質が完成動画の画質の上限になる。`remotion render` は Chrome が描いたフレームをさらに再エンコードする (H.264 の既定 CRF は 18、`--crf` で変更可) ため、完成動画は 2 回の非可逆エンコードを経る。変換のエンコード設定は NVENC の `-cq 23` と libx264 の `-crf 22` のどちらか一方が使われる。画質を上げるには変換の設定を変えて再変換した上で、render 側の設定も見る。
- fps の正本は theme の定数 1 つなので、その値を変えると変換済み素材は全部作り直しになる。convert は出力が既にあるファイルをスキップするため、作り直すには `public/projects/<slug>/` の変換済み mp4 を消してから再実行する。変換済み素材の fps を読んで composition と突き合わせる検査は持たない。

### 禁止事項

- HEVC 原本を timeline の `src` に指定すること。
- シンボリックリンクで素材を `public/` 配下に見せること。
- 区間の切り出しのために原本を再変換すること。
- `<OffthreadVideo>` へのフォールバックが起きる形式のファイルを変換済み素材として置くこと。

## Assumptions

| 前提                                                            | 状態   | 確認方法 / 結果                                                                                                                                      |
| --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-cq 23` の NVENC 出力が公開する動画の画質として足りる          | 未検証 | 完成した動画を公開解像度で視聴し、ブロックノイズや帯域不足が目立たないかを確認する                                                                   |
| 作業環境で NVENC が使い続けられる                               | 未検証 | 環境を変えたときに `scripts/convert/plan.ts` の NVENC 経路 (`probeArgs`・`encodeArgs`) が通るかを確認する (`scripts/convert-movie.ts` は I/O の配線) |
| 持続レンダリングの速度 (0.224 秒/フレーム) が試行錯誤を妨げない | 未検証 | [ADR-0001](./0001-use-remotion-for-video-production.md) の同じ前提と合わせて、実際の動画で計測する                                                   |

## References

- https://www.remotion.dev/docs/video-tags : `<Video>` (`@remotion/media`) の推奨と対応コーデック、`<OffthreadVideo>` との速度差。
- https://www.remotion.dev/docs/media/fallback : `<Video>` が `<OffthreadVideo>` にフォールバックする条件 (H.265 を含む)。
- https://www.remotion.dev/docs/media/video : `<Video>` の `trimBefore`・`trimAfter` の仕様。
- https://www.remotion.dev/docs/offthreadvideo : `<OffthreadVideo>` の位置づけ。
- 設計整理 (2026-09-08): 現在の設計を 1 から記述し直した
