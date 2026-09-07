# motovlog-template

Remotion でモトブログ動画を作るためのエンジン。動画 1 本 = 1 project とし、timeline の定義 (TypeScript) と素材からレンダリングする。設計上の決定は `docs/adr/` にある。

## 前提

- Node.js と npm (`npm ci` で依存を入れる)
- ffmpeg (原本の変換。NVENC を使う場合は NVIDIA GPU。WSL では `/usr/lib/wsl/lib` のライブラリを使う)

## ディレクトリ構成

([ADR-0002](docs/adr/0002-project-directory-layout.md) の要約)

- `src/`: エンジン (Composition・コンポーネント・schema)
- `projects/<slug>/timeline.ts`: 動画の定義。コミットする
- `projects/<slug>/voice.json`: 音声生成の結果 (`lines[].audio`・`duration` 等)。コミットする ([ADR-0006](docs/adr/0006-generate-voice-and-lipsync-from-voicevox-api.md))
- `public/projects/<slug>/`: 動画固有の素材 (変換済み素材・セリフ音声等)。コミットしない
- `public/assets/<種別>/`: 共通素材。`bgm`・`se`・`characters/<name>`・`fonts`。既定でコミットしない。再配布できる自作素材は `.gitignore` の否定パターンで明示してコミットする
- `<slug>` は `YYYYMMDD-<name>` (例: `20260817-jododaira`)

## 新しい動画を作る

1. slug を決めて `projects/<slug>/timeline.ts` を作る。`projects/00000000-sample/timeline.ts` をコピーして書き換えるのが早い。
2. ドラレコ原本を変換済み素材に変換する: `npm run convert -- <slug> <原本>...`。出力は `public/projects/<slug>/<basename>.mp4`。詳細は「変換済み素材の生成」。
3. セリフ音声 (wav) を `public/projects/<slug>/` に置く。音声生成スクリプトで `projects/<slug>/voice.json` を生成する ([ADR-0006](docs/adr/0006-generate-voice-and-lipsync-from-voicevox-api.md))。口パクデータの生成 (issue #2) と立ち絵 (issue #3) は未実装で、現状は音声と字幕だけになる。
4. BGM・効果音は `public/assets/bgm/`・`public/assets/se/` に置く。`public/assets/` 配下は既定でコミットされない。自作の素材をコミットするときは `.gitignore` の末尾に否定パターンを足す (除外パターンより前に書くと効かない)。書式はファイル 1 つなら `!public/assets/se/click.wav`、ディレクトリ丸ごとなら `!public/assets/characters/aoyama/**`、種別より深い階層のファイルだけなら親ディレクトリを先に戻してから書く (`!public/assets/bgm/album` の次の行に `!public/assets/bgm/album/x.wav`)。第三者の素材はコミットしない。
5. timeline.ts に clips・lines・bgm 等を書く (「timeline.ts の書き方」)。素材のパスは `public/` 相対 (`projects/<slug>/clip1.mp4`、`assets/bgm/xxx.wav`)。
6. プレビュー: `.env` に `REMOTION_PROJECT=<slug>` を書くか、`REMOTION_PROJECT=<slug> npx remotion studio` で渡して起動する。
7. レンダリング: `REMOTION_PROJECT=<slug> npx remotion render Motovlog out/<slug>.mp4`
8. 公開したら `git tag render/<slug>` を打つ。再現はタグを checkout して `npm ci` し、素材を復元して render する。

具体的なコマンドと timeline.ts の書き換え箇所は [docs/howto-new-project.md](docs/howto-new-project.md) にある。

### クレジット

使用した素材 (音声合成のキャラクター、立ち絵の作者、BGM 等) の利用規約に従ったクレジットを `ending.credits.text` に書く。

## サンプル project

slug の日付部分は `00000000` にしている (実際の project は `YYYYMMDD` を使う。サンプルだけの例外)。

`projects/00000000-sample/timeline.ts`・`voice.json` が同梱されている。素材はコミットされていないので、次の 3 種類を `public/` 配下に用意する。

| 素材                                                                             | 内容                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4`     | ドラレコの変換済み素材。`npm run convert -- 00000000-sample <原本>` で作る。別のファイルを使うなら timeline.ts の `clips[0].src` を出力名に合わせる                                             |
| `public/assets/bgm/m1.wav`                                                        | BGM                                                                                                                                                                                              |
| `public/projects/00000000-sample/line1.wav`・`line2.wav`                          | セリフ音声。VOICEVOX で「今日は浄土平まで走ってきた。」「磐梯吾妻スカイラインは、紅葉の時期が一番きれいだ。」を合成したもの。実尺は `voice.json` に書く ([ADR-0006](docs/adr/0006-generate-voice-and-lipsync-from-voicevox-api.md)) |

素材が手元に無い場合は、次の ffmpeg で同名の合成素材を作れば代わりに使える。既に同名のファイルがあれば `-n` により上書きせずに終了する。本物の素材 (特に `public/assets/bgm/m1.wav`) を上書きしないため。

```sh
mkdir -p public/projects/00000000-sample public/assets/bgm
ffmpeg -n -f lavfi -i testsrc=size=1920x1080:rate=30:duration=12 -f lavfi -i sine=frequency=440:duration=12 -pix_fmt yuv420p -shortest public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4
ffmpeg -n -f lavfi -i sine=frequency=220:duration=20 public/assets/bgm/m1.wav
ffmpeg -n -f lavfi -i sine=frequency=880:duration=2.2 public/projects/00000000-sample/line1.wav
ffmpeg -n -f lavfi -i sine=frequency=880:duration=4 public/projects/00000000-sample/line2.wav
```

素材を置けば Studio と render が動く (`REMOTION_PROJECT` は未設定でよく、既定でこのサンプルを読む)。代替の合成動画は変換済み素材と同じファイル名なので、実素材に切り替えるときは `public/projects/00000000-sample/` の代替ファイルを消してから `npm run convert -- 00000000-sample <原本>` を実行する (既存があると skip される)。

## timeline.ts の書き方

timeline 定義は `projects/<slug>/timeline.ts` が `export default` する TypeScript のオブジェクトで、`src/timeline/schema.ts` の zod スキーマ (`timelineSchema`) に従う ([ADR-0004](docs/adr/0004-timeline-schema-design.md))。`defineTimeline` (`src/timeline/schema.ts` からの export) でオブジェクトを包むと型補完が効く (実行時は入力をそのまま返すだけで parse はしない)。

```ts
import { defineTimeline } from "../../src/timeline/schema";

export default defineTimeline({
  // JSON と違いコメントが書け、start を式 (前のクリップの尺からの計算等) で書ける。
  clips: [{ src: "projects/20260817-jododaira/clip1.mp4", duration: 12 }],
  // ...
});
```

時間はすべて秒 (number) で指定する。`version` (省略時 1) を持ち、互換性を切る変更をするときに上げる。

| フィールド          | 内容                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`           | schema のバージョン。省略時 1                                                                                                                                                                                                                                                                                                                                                                                        |
| `meta`              | 解像度・フレームレート (`width`/`height`/`fps`)                                                                                                                                                                                                                                                                                                                                                                       |
| `clips`             | メイン映像トラック (走行映像)。`start` を持たない順序リストで、各クリップの絶対位置は `gapBefore`/`crossfadeIn`/`duration` から導出される (`gapBefore`: 直前クリップ終端からの空白秒。先頭クリップはタイムライン先頭からの空白。`crossfadeIn`: 直前クリップとのオーバーラップ秒)。`gapBefore` と `crossfadeIn` の同時指定、先頭クリップの `crossfadeIn` 指定、直前クリップの露出長 (`duration - crossfadeIn`) を超える `crossfadeIn` は不可 |
| `overlays`          | 写真・動画の差し込み (フェード・位置指定)。`scale` はフレームに収めた上での倍率。`volume`/`sourceFrom` は `kind: "video"` 専用で、`kind: "image"` の要素に 0 以外を指定するとスキーマ検証エラーになる (`volume` の既定は無音、`sourceFrom` は元動画内の開始秒)。video overlay の `fadeIn`/`fadeOut` は映像の不透明度と音量の両方のフェードに使われる |
| `bgm`               | BGM トラック (フェードイン/アウト)                                                                                                                                                                                                                                                                                                                                                                                    |
| `lines`             | セリフ (字幕表示文と表示開始秒)。`audio`・`duration` は timeline.ts には書かず、`voice.json` に持つ (「音声生成の結果」)。音声区間 `[start, start + duration)` は互いに重ならないこと (`voice.json` と合成した後に検証、重なると検証エラー)。字幕は次のセリフの開始で切れる                                                                                                                                                                                                                                                                          |
| `subtitleBands`     | 字幕背景帯の表示区間                                                                                                                                                                                                                                                                                                                                                                                                  |
| `characterSegments` | 立ち絵の表示区間 (現状は枠のみ。中身は issue #3)                                                                                                                                                                                                                                                                                                                                                                      |
| `ending`            | エンディング (黒フェード + クレジット文言)。フェード長は `fadeDuration` (既定 1.0 秒)                                                                                                                                                                                                                                                                                                                                 |
| `style`             | 字幕・帯の見た目 (フォントサイズ・色・縁取り等)                                                                                                                                                                                                                                                                                                                                                                       |

`clips` は `gapBefore`・`crossfadeIn` から位置が決まる (絶対時刻を持たない) のに対し、`clips` 以外のトラック (`overlays`・`bgm`・`lines`・`subtitleBands`・`characterSegments`・`ending`) は `start`+`duration` の絶対時刻で位置を指定する。

`default` 付きの項目 (`fadeDuration`・`subtitleTail` 等) は省略可能で、省略した場合は `calculateMetadata` 内での parse で default 値が補完される。`meta`・`style` (および `style.subtitle`/`style.band`) や `overlays`・`bgm`・`lines`・`subtitleBands`・`characterSegments` はコンテナごと丸ごと省略可能 (`clips` は必須)。

project の選択は環境変数 `REMOTION_PROJECT` (slug) で行う。`.env` に書くか `REMOTION_PROJECT=<slug> npx remotion studio` のように渡す。未設定・空ならサンプル project (`00000000-sample`) を読む。`--props` は使わない。

`projects/*/timeline.ts` と `voice.json` はすべてバンドルに含まれる (Rspack の動的 import の性質)。どれか 1 つでも timeline.ts の構文誤り・import の解決失敗、または voice.json の JSON 構文誤りがあると、選んでいない project でも Studio と render が起動しない。書きかけの project はこの 2 ファイルを置かないか、構文が通る状態に保つ。schema 違反や voice.json の欠落などの実行時エラーは選んだ project だけに閉じる。

## 音声生成の結果 (voice.json)

`lines[].audio`・`duration` は `projects/<slug>/voice.json` に line の `id` をキーとして持つ ([ADR-0006](docs/adr/0006-generate-voice-and-lipsync-from-voicevox-api.md))。音声生成スクリプトで生成する。読み込み時に timeline.ts の `lines` と `id` で合成し、対応する音声が無い line があれば「音声が未生成です」というエラーで拒否する。timeline.ts に `audio`・`duration` を手で書かない。

## フォント

字幕・立ち絵まわりのフォントは `@remotion/google-fonts/NotoSansJP` (`src/fonts.ts`) を使う。Noto Sans JP は unicode-range によって 100 を超えるフォントチャンクに分割されているため、`subsets: ["japanese"]` を指定していても実際には多数のチャンクを Google Fonts から取得する。レンダー時にネットワークリクエストに関する警告が多数出力されるが、これは正常な挙動でありエラーではない。

ネットワークに依存したくない場合 (オフライン環境・CI 等) は、`@remotion/fonts` を使って `public/assets/fonts/` 配下に置いたローカルフォントファイルへ差し替えられる ([ADR-0002](docs/adr/0002-project-directory-layout.md))。

## 変換済み素材の生成

ドラレコ原本 (HEVC) は Remotion に直接読ませず、H.264 の変換済み素材に変換して使う ([ADR-0003](docs/adr/0003-convert-dashcam-footage-to-h264-proxy.md))。この変換は非可逆の再エンコードで、変換済み素材の画質が完成動画の画質の上限になる。`remotion render` は Chrome が描いたフレームをさらに再エンコードする (H.264 の既定 CRF は 18) ため、完成動画は 2 回の非可逆エンコードを経る。変換のエンコード設定は NVENC の `-cq 23` と libx264 の `-crf 22` のどちらか一方が使われる。

    npm run convert -- <slug> <入力ファイル>...

`npm run` はリポジトリルートを cwd にして実行するため、入力ファイルは絶対パスで渡す。

- 出力先は `public/projects/<slug>/<basename>.mp4` ([ADR-0002](docs/adr/0002-project-directory-layout.md))。既に存在するファイルはスキップする。
- `<slug>` は `YYYYMMDD-<name>` (ASCII 小文字の kebab-case)。形式が違うとエラーになる。
- フレームレートは `projects/<slug>/timeline.ts` の `meta.fps` に合わせる (`convert-movie.ts` が読む)。GOP 長は fps と同じ (1 秒ごとにキーフレーム)。timeline.ts が無い・読めない場合はフォールバックせずエラーで止まる。
- 起動時に NVENC が使えるかを確認し、使えなければ libx264 を使う。NVENC が使える場合でも、あるファイルの変換に失敗したときはそのファイルだけ libx264 で再試行する。一度 libx264 に落ちたら以降のファイルも libx264 で変換する。WSL で NVENC を使うために `LD_LIBRARY_PATH=/usr/lib/wsl/lib` をスクリプト内で設定している。
- 拡張子違いで同じ basename になる入力 (例: `clip.mov` と `clip.mp4`) を同時に渡すとエラーになる。

## License

Remotion は個人利用は無料だが、組織によっては company license が必要になる。[Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
