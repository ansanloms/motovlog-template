# motovlog-template

モトブログ動画 1 本を「タイムライン定義 1 ファイル + 素材」で記述するための Remotion テンプレート。

走行映像 (ドラレコ相当)・写真/動画の差し込み・BGM・セリフ音声・字幕・立ち絵・エンディングといった
トラックを、時間 (秒単位) で記述したタイムライン定義から自動的に組み立てる。

このリポジトリでは土台のみを実装しており、次は別 issue で対応する。

- リップシンク (立ち絵の口パク同期): issue #2
- 立ち絵の中身の描画: issue #3
- 運用フロー・タイムライン定義の作り方の詳細な手引き: issue #6

## セットアップ

```sh
npm i
```

## プレビュー

```sh
npm run dev
```

Remotion Studio が起動し、`src/data/sample.ts` のサンプルタイムラインをプレビューできる。

サンプルタイムラインは `public/sample/` 配下の素材を参照する (このディレクトリは
gitignore 済みで、リポジトリには含まれない)。プレビュー前に次のファイルを自分で
用意する必要がある。

| ファイル                  | 用途                      |
| ------------------------- | ------------------------- |
| `public/sample/clip1.mp4` | 走行映像 (メインクリップ) |
| `public/sample/bgm.wav`   | BGM                       |
| `public/sample/line1.wav` | セリフ音声 1              |
| `public/sample/line2.wav` | セリフ音声 2              |

内容は問わないので、手元にある任意の mp4/wav ファイルをリネームして置けばよい。
実素材を編集用の軽量プロキシに変換する場合は、後述の `scripts/make-proxy.sh` を使う。

## レンダー

```sh
npx remotion render Motovlog out/output.mp4
```

## タイムライン定義の書き方

タイムライン定義は `src/timeline/schema.ts` の zod スキーマ (`timelineSchema`) に従う。
時間はすべて秒単位 (number) で指定する。

| フィールド          | 内容                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`              | 解像度・フレームレート (`width`/`height`/`fps`)                                                                                                                                                                                                                                                                                                                                                                       |
| `clips`             | メイン映像トラック (走行映像)。`start` を持たない順序リストで、各クリップの絶対位置は `gapBefore`/`crossfadeIn`/`duration` から導出される (`gapBefore`: 直前クリップ終端からの空白秒。先頭クリップはタイムライン先頭からの空白。`crossfadeIn`: 直前クリップとのオーバーラップ秒)。`gapBefore` と `crossfadeIn` の同時指定、先頭クリップの `crossfadeIn` 指定、直前クリップの露出長 (`duration - crossfadeIn`) を超える `crossfadeIn` は不可 |
| `overlays`          | 写真・動画の差し込み (フェード・拡縮・位置指定)。`volume`/`sourceFrom` は `kind: "video"` 専用で、`kind: "image"` の要素に 0 以外を指定するとスキーマ検証エラーになる (`volume` の既定は無音、`sourceFrom` は元動画内の開始秒)。video overlay の `fadeIn`/`fadeOut` は映像の不透明度と音量の両方のフェードに使われる                                                                                                       |
| `bgm`               | BGM トラック (フェードイン/アウト)                                                                                                                                                                                                                                                                                                                                                                                    |
| `lines`             | セリフ (音声 + 字幕表示文)                                                                                                                                                                                                                                                                                                                                                                                            |
| `subtitleBands`     | 字幕背景帯の表示区間                                                                                                                                                                                                                                                                                                                                                                                                  |
| `characterSegments` | 立ち絵の表示区間 (このテンプレートでは枠のみ。中身は issue #3)                                                                                                                                                                                                                                                                                                                                                        |
| `ending`            | エンディング (黒フェード + クレジット文言)。フェード長は `fadeDuration` (既定 1.0 秒)                                                                                                                                                                                                                                                                                                                                 |
| `style`             | 字幕・帯の見た目 (フォントサイズ・色・縁取り等)                                                                                                                                                                                                                                                                                                                                                                       |

素材ファイルは `public/` 配下に置き、タイムライン定義からは `public/` 相対のパスで参照する。

`default` 付きの項目 (`fadeDuration`・`subtitleTail` 等) は省略可能。省略した場合は
`calculateMetadata` 内での parse で default 値が補完される。`meta`・`style`
(および `style.subtitle`/`style.band`) や `overlays`・`bgm`・`lines`・
`subtitleBands`・`characterSegments` はコンテナごと丸ごと省略可能 (`clips` は必須)。

## フォント

字幕・立ち絵まわりのフォントは `@remotion/google-fonts/NotoSansJP` (`src/fonts.ts`) を使う。
Noto Sans JP は unicode-range によって 100 を超えるフォントチャンクに分割されているため、
`subsets: ["japanese"]` を指定していても実際には多数のチャンクを Google Fonts から取得する。
レンダー時にネットワークリクエストに関する警告が多数出力されるが、これは正常な挙動であり
エラーではない。

ネットワークに依存したくない場合 (オフライン環境・CI 等) は、`@remotion/fonts` を使って
`public/fonts/` 配下に置いたローカルフォントファイルへ差し替えられる。

## プロキシ生成

編集用の軽量プロキシ動画を作るスクリプトを用意している。

```sh
scripts/make-proxy.sh <入力ファイル>...
```

各入力ファイルを `public/proxies/<basename>.mp4` として書き出す (既に存在する場合はスキップする)。
出力先は拡張子を除いた basename だけで決まるため、拡張子違いで同じ basename になる入力
(例: `clip.mov` と `clip.mp4`) を同時に渡すとエラーになり、実行前に拒否される。

NVENC (NVIDIA のハードウェアエンコード) を優先して使い、失敗した場合は自動的に libx264 (CPU
エンコード) にフォールバックする。WSL 環境で NVENC を使うには CUDA 関連のライブラリを読み込む
必要があるため、スクリプト内で `LD_LIBRARY_PATH=/usr/lib/wsl/lib` を設定している。

出力のフレームレートは環境変数 `PROXY_FPS` で指定できる (既定 30)。

```sh
PROXY_FPS=24 scripts/make-proxy.sh <入力ファイル>...
```
