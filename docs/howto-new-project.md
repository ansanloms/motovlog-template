# 新しい動画 project を作る手順

README の「新しい動画を作る」を、具体的なコマンドと timeline.ts の書き換え箇所まで落とした手順。例として slug `20260817-jododaira` (2026-08-17 撮影の浄土平) を使う。構成の決定は [ADR-0002](adr/0002-project-directory-layout.md)、変換済み素材への変換は [ADR-0003](adr/0003-convert-dashcam-footage-to-h264-proxy.md)、timeline の書き方は [ADR-0006](adr/0006-write-timeline-as-effects-dsl.md) にある。

## 前提

- `npm ci` が済んでいる (初回だけ)。
- ffmpeg が入っている。NVENC を使うなら NVIDIA GPU。WSL では nvenc を使う ffmpeg の呼び出しに `/usr/lib/wsl/lib` を `LD_LIBRARY_PATH` で渡す (`scripts/convert/plan.ts`)。
- ドラレコの原本 (HEVC) は Windows 側 (`/mnt/c`) に置いたままでよい。触るのは変換時の読み取り 1 回だけで、書き換えない。

## 手順

### 1. project を作る

slug は `YYYYMMDD-<name>` (日付 8 桁、ASCII 小文字の kebab-case)。サンプルをコピーして始める。

```
mkdir -p projects/20260817-jododaira
cp projects/00000000-sample/timeline.ts projects/20260817-jododaira/timeline.ts
```

### 2. ドラレコ原本を変換済み素材に変換する

```
npm run convert -- 20260817-jododaira /mnt/c/path/to/DASHCAM_20260816_133345.MP4
```

- 出力は `public/projects/20260817-jododaira/DASHCAM_20260816_133345.mp4` (原本の basename + `.mp4`)。既にあればスキップする。
- フレームレートは `src/theme/timing.ts` の `fps` に固定されており、指定オプションは無い。composition の fps と常に一致する。
- 原本 1 本 (約 43 分・8GB) で NVENC なら約 9 分、出力は約 5GB。NVENC が使えない環境では libx264 で約 10 倍かかる。
- `npm run` はリポジトリルートを cwd にするので原本は絶対パスで渡す。

### 3. timeline.ts を書く

時間はすべて秒。サンプルからコピーした内容を、少なくとも次のように直す。

- layer 0 (走行映像): `cut(video({ src: ... }), { duration: ... })`。`src` は変換済み素材のパス (`staticFile("projects/20260817-jododaira/DASHCAM_20260816_133345.mp4")`)。区間を絞るなら `video()` の `trimBefore` (秒) を使う。
- layer 1 以降 (OP・章タイトル・注釈・写真紹介等): `fade`・`cut` と要素ファクトリ (`thumbnail`・`chapterTitle`・`annotation`・`photoShowcase`) を組み合わせる。位置は省略 (直前の item の終端に連結)・`after: n` (直前の終端から n 秒後)・`at: n` (絶対秒) のいずれかで指定する。
- layer 内の item は時間が重ならないようにする。重なりや順序の乱れがあると `timeline()` が起動時に throw する。

項目の一覧と既定値は README の「timeline.ts の書き方」にある。

### 4. プレビューする

```
REMOTION_PROJECT=20260817-jododaira npx remotion studio
```

`.env` に `REMOTION_PROJECT=20260817-jododaira` を書いておけば、毎回環境変数を渡さなくてよい。timeline.ts を編集したら Studio 上で再読み込みし、反映されているか確認する。

### 5. レンダリングする

```
REMOTION_PROJECT=20260817-jododaira npx remotion render Motovlog out/20260817-jododaira.mp4
```

`out/` はコミットされない。

### 6. 公開したらタグを打つ

```
git add projects/20260817-jododaira/timeline.ts
git commit -m "feat: 20260817-jododaira の timeline を追加"
git tag render/20260817-jododaira
git push origin main render/20260817-jododaira
```

再現するときはタグを checkout して `npm ci` し、素材 (変換済み素材) を復元して render する。素材はコミットされていないので、原本と生成物の保管場所を別に持つ。

## git で扱うもの

- コミットする: `projects/<slug>/timeline.ts`、否定パターンで明示した自作素材。
- コミットしない: `public/projects/` 配下すべて、`public/assets/` 配下の第三者素材、`out/`。

動画 1 本ごとにブランチ `project/<slug>` を切って PR にするか、main に直接コミットするかは運用で決める。
