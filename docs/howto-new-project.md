# 新しい動画 project を作る手順

README の「新しい動画を作る」を、具体的なコマンドと timeline.ts の書き換え箇所まで落とした手順。例として slug `20260817-jododaira` (2026-08-17 撮影の浄土平) を使う。構成の決定は [ADR-0002](adr/0002-project-directory-layout.md)、変換済み素材への変換は [ADR-0003](adr/0003-convert-dashcam-footage-to-h264-proxy.md)、timeline の形式は [ADR-0004](adr/0004-timeline-schema-design.md) にある。

## 前提

- `npm ci` が済んでいる (初回だけ)。
- ffmpeg が入っている。NVENC を使うなら NVIDIA GPU。WSL では `/usr/lib/wsl/lib` のライブラリを `scripts/convert-movie.ts` が自動で読む。
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
- フレームレートは `projects/<slug>/timeline.ts` の `meta.fps` に合わせる (timeline.ts を先に作っておく。無い・読めない場合はエラーになる)。
- 原本 1 本 (約 43 分・8GB) で NVENC なら約 9 分、出力は約 5GB。NVENC が使えない環境では libx264 で約 10 倍かかる。
- `npm run` はリポジトリルートを cwd にするので原本は絶対パスで渡す。

### 3. セリフ音声を生成する

セリフの台本は timeline.ts の `lines[].text` に書く (次の手順)。音声 (wav) と `lines[].audio`・`duration` は音声生成スクリプトで生成する ([ADR-0006](adr/0006-generate-voice-and-lipsync-from-voicevox-api.md))。生成結果は `projects/<slug>/voice.json` に書かれ、wav は `public/projects/<slug>/` に置かれる。`lines[].audio`・`duration` を timeline.ts に手で書かない。

口パクデータの生成 (issue #2) は未実装。立ち絵は `characterSegments` (`src`・`side`) で PNG 1 枚を出せるが、目パチ・口パクは未実装 (#39)。

### 4. BGM・効果音を置く

`public/assets/bgm/`・`public/assets/se/` に置く。`public/assets/` 配下は既定でコミットされない。自作で再配布できる素材をコミットするときは `.gitignore` の末尾に否定パターンを足す (書式は `.gitignore` の注記)。第三者の素材はコミットしない。

### 5. timeline.ts を書く

時間はすべて秒。サンプルからコピーした `defineTimeline({...})` の中身を、少なくとも次のように直す。

- `meta`: 1920×1080・30fps ならそのまま。
- `opening`: OP とサムネ用フレームの絵。走行写真の `photo`、バッジの文字列の `badge` (例 `"#12 愛媛 / 国道378号"`)、地名の `title` (最大 12 文字、`\n` で改行可)、立ち絵 png の `character`。
- `clips`: 順序リスト。`src` は変換済み素材のパス (`projects/20260817-jododaira/DASHCAM_20260816_133345.mp4`)、`sourceFrom` は原本の何秒目から使うか、`duration` は使う長さ。2 本目以降は `gapBefore` で間を空けるか、`crossfadeIn` で重ねて繋ぐ。両方は指定できない。
- `lines`: セリフごとに `id`・`start`・`text` (字幕)。`audio`・`duration` は timeline.ts には書かず、音声生成スクリプトが `voice.json` に書く (「3. セリフ音声を生成する」)。音声区間が重なると `voice.json` との合成後に検証エラーになる。
- `bgm`: `src` は `assets/bgm/<file>`、`start`・`duration`、`fadeIn`・`fadeOut`。
- `characterSegments`: `start`・`duration`、`src` (public 相対の PNG 1 枚)、`side` (`left` 既定 / `right`)。区間は互いに重ならないこと。フェード 0.2 秒は theme。
- `chapters`・`notes`・`photos`: 章タイトル (`start`・`title`、番号は `start` 順の 1 始まり)、右端の縦書き注釈 (`start`・`duration`・`text`)、写真紹介 (`start`・`duration`・`src` 1〜2 枚)。それぞれ互いに重ならないこと。`opening` があるときは OP の後に、`ending` があるときは ED の前に収める。
- `ending`: 走行データとクレジット。最後のクリップからカットインする秒 `start`、上段左の文字列 `title` (既定 `"RIDE LOG"`)、上段右の文字列 `subtitle` (例 `"EP.12 / 愛媛"`)、`date` (`from`・`to` の `Temporal.ZonedDateTime`。例 `Temporal.ZonedDateTime.from("2026-08-15T00:00[Asia/Tokyo]")`)、`distance` (km の数値)、`ridingTime` (`Temporal.Duration`)、`routes` (経由地の文字列配列)、`credits` (`Record<string, string>[]`。1 要素が 1 行、URL は書かず概要欄に置く)。日付・時間の型は [ADR-0009](adr/0009-use-temporal-for-dates-and-times.md) を参照。クレジットには使用した音声合成のキャラクター・立ち絵の作者・BGM の表記を、各素材の利用規約に従って書く。
- `overlays`・`characterSegments`・`chapters`・`notes`・`photos`・`opening`・`ending`: 使わなければコンテナごと省略できる。

項目の一覧と既定値は README の「timeline.ts の書き方」にある。

### 6. プレビューする

```
REMOTION_PROJECT=20260817-jododaira npx remotion studio
```

`.env` に `REMOTION_PROJECT=20260817-jododaira` を書いておけば、毎回環境変数を渡さなくてよい。timeline.ts を編集したら Studio 上で再読み込みし、反映されているか確認する。

### 7. レンダリングする

```
REMOTION_PROJECT=20260817-jododaira npx remotion render Motovlog out/20260817-jododaira.mp4
```

`out/` はコミットされない。

### 8. 公開したらタグを打つ

```
git add projects/20260817-jododaira/timeline.ts projects/20260817-jododaira/voice.json
git commit -m "feat: 20260817-jododaira の timeline を追加"
git tag render/20260817-jododaira
git push origin main render/20260817-jododaira
```

再現するときはタグを checkout して `npm ci` し、素材 (変換済み素材・音声・BGM) を復元して render する。素材はコミットされていないので、原本と生成物の保管場所を別に持つ。

## git で扱うもの

- コミットする: `projects/<slug>/timeline.ts`・`voice.json`、否定パターンで明示した自作素材。
- コミットしない: `public/projects/` 配下すべて、`public/assets/` 配下の第三者素材、`out/`。

動画 1 本ごとにブランチ `project/<slug>` を切って PR にするか、main に直接コミットするかは運用で決める。
