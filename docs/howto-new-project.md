# 新しい動画 project を作る手順

README の「新しい動画を作る」を、具体的なコマンドと timeline.json の書き換え箇所まで落とした手順。例として slug `20260817-jododaira` (2026-08-17 撮影の浄土平) を使う。構成の決定は [ADR-0002](adr/0002-project-directory-layout.md)、プロキシ変換は [ADR-0003](adr/0003-convert-dashcam-footage-to-h264-proxy.md)、timeline の形式は [ADR-0004](adr/0004-timeline-schema-design.md) にある。

## 前提

- `npm ci` が済んでいる (初回だけ)。
- ffmpeg と jq が入っている。NVENC を使うなら NVIDIA GPU。WSL では `/usr/lib/wsl/lib` のライブラリを `make-proxy.sh` が自動で読む。
- ドラレコの原本 (HEVC) は Windows 側 (`/mnt/c`) に置いたままでよい。触るのは変換時の読み取り 1 回だけで、書き換えない。

## 手順

### 1. project を作る

slug は `YYYYMMDD-<name>` (日付 8 桁、ASCII 小文字の kebab-case)。サンプルをコピーして始める。

```
mkdir -p projects/20260817-jododaira
cp projects/00000000-sample/timeline.json projects/20260817-jododaira/timeline.json
```

### 2. ドラレコ原本をプロキシに変換する

```
scripts/make-proxy.sh 20260817-jododaira /mnt/c/path/to/DASHCAM_20260816_133345.MP4
```

- 出力は `public/projects/20260817-jododaira/DASHCAM_20260816_133345.mp4` (原本の basename + `.mp4`)。既にあればスキップする。
- フレームレートは `projects/<slug>/timeline.json` の `meta.fps` に合わせる (無ければ 30)。timeline を先に作っておくとその fps で変換される。
- 原本 1 本 (約 43 分・8GB) で NVENC なら約 9 分、出力は約 5GB。NVENC が使えない環境では libx264 で約 10 倍かかる。
- `npm run proxy -- <slug> <原本>` でも呼べるが、`npm run` はリポジトリルートを cwd にするので原本は絶対パスで渡す。

### 3. セリフ音声を置く

VOICEVOX で書き出した wav を `public/projects/<slug>/` に置く。

```
mkdir -p public/projects/20260817-jododaira
cp ~/somewhere/line1.wav ~/somewhere/line2.wav public/projects/20260817-jododaira/
```

各 wav の実尺は timeline の `lines[].duration` に書く。ffprobe で取れる。

```
ffprobe -v error -show_entries format=duration -of csv=p=0 public/projects/20260817-jododaira/line1.wav
```

口パクデータの生成 (issue #2) と立ち絵 (issue #3) は未実装で、今は音声と字幕だけになる。

### 4. BGM・効果音を置く

`public/assets/bgm/`・`public/assets/se/` に置く。`public/assets/` 配下は既定でコミットされない。自作で再配布できる素材をコミットするときは `.gitignore` の末尾に否定パターンを足す (書式は `.gitignore` の注記)。第三者の素材はコミットしない。

### 5. timeline.json を書く

時間はすべて秒。サンプルからコピーした後、少なくとも次を直す。

- `meta`: 1920×1080・30fps ならそのまま。
- `clips`: 順序リスト。`src` はプロキシのパス (`projects/20260817-jododaira/DASHCAM_20260816_133345.mp4`)、`sourceFrom` は原本の何秒目から使うか、`duration` は使う長さ。2 本目以降は `gapBefore` で間を空けるか、`crossfadeIn` で重ねて繋ぐ。両方は指定できない。
- `lines`: セリフごとに `id`・`audio` (`projects/20260817-jododaira/line1.wav`)・`start`・`duration` (wav の実尺)・`text` (字幕)。音声区間が重なると検証エラーになる。
- `bgm`: `src` は `assets/bgm/<file>`、`start`・`duration`、`fadeIn`・`fadeOut`。
- `ending`: 暗転を始める秒 `fadeToBlackStart` と、`text`・`start`・`duration` を持つ `credits`。クレジットには使用した音声合成のキャラクター・立ち絵の作者・BGM の表記を、各素材の利用規約に従って書く。
- `overlays`・`subtitleBands`・`characterSegments`: 使わなければコンテナごと省略できる。`--props` で渡した timeline はサンプルの値と混ざらない。

項目の一覧と既定値は README の「timeline.json の書き方」にある。

### 6. プレビューする

```
npx remotion studio --props=projects/20260817-jododaira/timeline.json
```

Studio の props パネルには timeline.json の内容が入った状態で開く。パネルで値を変えても timeline.json には戻らないので、編集はファイルを直して Studio を開き直す。

### 7. レンダリングする

```
npx remotion render Motovlog out/20260817-jododaira.mp4 --props=projects/20260817-jododaira/timeline.json
```

`out/` はコミットされない。

### 8. 公開したらタグを打つ

```
git add projects/20260817-jododaira/timeline.json
git commit -m "feat: 20260817-jododaira の timeline を追加"
git tag render/20260817-jododaira
git push origin main render/20260817-jododaira
```

再現するときはタグを checkout して `npm ci` し、素材 (プロキシ・音声・BGM) を復元して render する。素材はコミットされていないので、原本と生成物の保管場所を別に持つ。

## git で扱うもの

- コミットする: `projects/<slug>/timeline.json`、否定パターンで明示した自作素材。
- コミットしない: `public/projects/` 配下すべて、`public/assets/` 配下の第三者素材、`out/`。

動画 1 本ごとにブランチ `project/<slug>` を切って PR にするか、main に直接コミットするかは運用で決める。
