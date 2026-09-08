# motovlog-template

Remotion でモトブログ動画を作るためのエンジン。動画 1 本 = 1 project とし、timeline の定義 (TypeScript) と素材からレンダリングする。設計上の決定は `docs/adr/` にある。

## 前提

- Node.js と npm (`npm ci` で依存を入れる)
- ffmpeg (原本の変換。NVENC を使う場合は NVIDIA GPU。WSL では `/usr/lib/wsl/lib` のライブラリを使う)

## ディレクトリ構成

([ADR-0002](docs/adr/0002-project-directory-layout.md) の要約)

- `src/`: エンジン (Composition・コンポーネント・演出の DSL)
- `projects/<slug>/timeline.ts`: 動画の定義。コミットする
- `public/projects/<slug>/`: 動画固有の素材 (変換済み素材・セリフ音声等)。コミットしない
- `public/assets/<種別>/`: 共通素材。`bgm`・`se`・`characters/<name>`・`fonts`。既定でコミットしない。再配布できる自作素材は `.gitignore` の否定パターンで明示してコミットする
- `<slug>` は `YYYYMMDD-<name>` (例: `20260817-jododaira`)

## 新しい動画を作る

1. slug を決めて `projects/<slug>/timeline.ts` を作る。`projects/00000000-sample/timeline.ts` をコピーして書き換えるのが早い。
2. ドラレコ原本を変換済み素材に変換する: `npm run convert -- <slug> <原本>...`。出力は `public/projects/<slug>/<basename>.mp4`。詳細は「変換済み素材の生成」。
3. timeline.ts に走行映像・章タイトル・注釈・発話等の要素を書く (「timeline.ts の書き方」)。素材のパスは `public/` 相対 (`projects/<slug>/clip1.mp4`、`projects/<slug>/photos/photo-01.jpg`)。
4. プレビュー: `.env` に `REMOTION_PROJECT=<slug>` と `VOICEVOX_URL=<VOICEVOX ENGINE の URL>` を書く。`npm run dev` で起動する。timeline.ts を監視して発話の音声キャッシュを生成しつつ Remotion Studio を起こす。`VOICEVOX_URL` が無いと watcher は生成せず、発話 (`narration()`) を含む project は Studio がキャッシュを 30 秒待った後エラーになる。発話の無い project は影響を受けない。
5. レンダリング: `REMOTION_PROJECT=<slug> npm run render -- out/<slug>.mp4`。先に音声キャッシュを生成してからレンダリングする。
6. 公開したら `git tag render/<slug>` を打つ。再現はタグを checkout して `npm ci` し、素材を復元して render する。

具体的なコマンドと timeline.ts の書き換え箇所は [docs/howto-new-project.md](docs/howto-new-project.md) にある。

## サンプル project

slug の日付部分は `00000000` にしている (実際の project は `YYYYMMDD` を使う。サンプルだけの例外)。

`projects/00000000-sample/timeline.ts` が同梱されている。素材はコミットされていないので、次を `public/` 配下に用意する。

| 素材                                                                          | 内容                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4` | ドラレコの変換済み素材。`npm run convert -- 00000000-sample <原本>` で作る。別のファイルを使うなら timeline.ts の `src` を出力名に合わせる |
| `public/projects/00000000-sample/photos/photo-03.jpg`                         | サムネに使う走行写真                                                                                                                       |
| `public/projects/00000000-sample/photos/photo-01.jpg`・`photo-02.jpg`         | 写真紹介に使う走行写真                                                                                                                     |
| `public/assets/characters/4.png`                                              | サムネに使う立ち絵の png                                                                                                                   |

素材が手元に無い場合、走行映像は次の ffmpeg で同名の合成素材を作れば代わりに使える。既に同名のファイルがあれば `-n` により上書きせずに終了する。

```sh
mkdir -p public/projects/00000000-sample
ffmpeg -n -f lavfi -i testsrc=size=1920x1080:rate=30:duration=40 -pix_fmt yuv420p public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4
```

写真 (`photos/photo-01.jpg`・`photo-02.jpg`・`photo-03.jpg`) と立ち絵 (`assets/characters/4.png`) はイラスト素材で ffmpeg では代替できない。手元の JPG/PNG を同名で置けばサムネ・写真紹介の見た目は仮のものになるが Studio と render は動く。代替の合成動画は変換済み素材と同じファイル名なので、実素材に切り替えるときは代替ファイルを消してから `npm run convert -- 00000000-sample <原本>` を実行する (既存があると skip される)。

素材を置けば Studio と render が動く (`REMOTION_PROJECT` は未設定でよく、既定でこのサンプルを読む)。

## timeline.ts の書き方

timeline 定義は `projects/<slug>/timeline.ts` が `export default` する、`src/effects` の関数 (`timeline`・`fade`・`cut`) の呼び出しで書く ([ADR-0006](docs/adr/0006-write-timeline-as-effects-dsl.md))。

```ts
import { staticFile } from "remotion";
import { chapterTitle, thumbnail, video } from "../../src/components/index.tsx";
import { cut, fade, timeline } from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  openingTiming,
} from "../../src/theme/timing.ts";

const asset = (path: string) =>
  staticFile(`projects/20260817-jododaira/${path}`);

export default timeline([
  [
    // layer 0: 走行映像
    cut(video({ src: asset("clip1.mp4") }), { duration: 36.4 }),
  ],
  [
    // layer 1: OP と章タイトル
    fade(
      thumbnail({
        photo: asset("photos/photo-01.jpg"),
        badge: "#1 福島 / 磐梯吾妻スカイライン",
        title: "浄土平まで\n走ってきた",
        character: staticFile("assets/characters/4.png"),
      }),
      { duration: openingTiming.duration, in: openingTiming.fadeIn },
    ),
    fade(chapterTitle({ title: "浄土平へ", subtitle: "CHAPTER 1" }), {
      after: 0.2,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
  ],
]);
```

`timeline(layers, options?)` の `layers` は layer (item の配列) の配列。layer は z 順を表し、配列の後ろが上に重なる。layer 内の item は時間が重ならず、時間順に並べる (`crossfade` の遷移の尺だけ重なるのが唯一の例外)。`options` は `width`・`height` のみ (既定 1920×1080)。fps は project ごとに指定せず、`src/theme/timing.ts` の `fps` を使う。

layer 内の item の位置は次のいずれかで指定する。

- 省略: 同じ layer の直前の item の終端に連結する (最初の item は 0 秒から)。
- `after: n`: 直前の item の終端から n 秒後。
- `at: n`: 絶対秒。

`at` と `after` は同時に指定できない。時間はすべて秒で書く。

演出は `fade(node, options)`・`cut(node, options)` の 2 つ。`options` は上記の位置指定に加え、`duration` (表示秒数)、`fade` はさらに `in`・`out` (フェードイン・アウトの秒数、既定 0) を持つ。

layer 内の item と item の間には `crossfade({ duration })` を置ける。直後の item は直前の終端から遷移の尺だけ戻って始まり、その区間で重なる (直後の item に `at`/`after` は書けない)。`timeline()` は、遷移が layer の先頭・末尾にある、遷移が連続する、遷移の尺が前後どちらかの item の尺より長い、遷移が 1 フレームに満たない、直前の item が `out` を持つ `fade` である、前後どちらかが `frame()` の item である、のいずれかで throw する。`fade(frame(), options)` は下の layer の合成結果にフェードをかける (layer 0 には置けない)。`at` には `start(item, offset?)` / `end(item, offset?)` で、下の layer か同じ layer の前にある item の開始・終端を基準にした位置を渡せる。

要素は `src/components/index.tsx` が公開する要素ファクトリで組み立てる。各ファクトリは対応するコンポーネントと同じ props を受け、フレーム依存の値は持たない。

| ファクトリ             | 内容                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `video(props)`         | 走行映像。`src` (staticFile() 済み URL)・`trimBefore?` (秒)・`volume?`                   |
| `audio(props)`         | 音声。`src` (staticFile() 済み URL)・`trimBefore?` (秒)・`volume?`・`loop?`              |
| `thumbnail(props)`     | OP・サムネ用フレームの絵。`photo`・`badge`・`title`・`character`                         |
| `chapterTitle(props)`  | 章タイトル。`title`・`subtitle`                                                          |
| `annotation(props)`    | 右端の縦書き注釈。`text`                                                                 |
| `photoShowcase(props)` | 写真紹介 (1〜2 枚)。`photos`                                                             |
| `ending(props)`        | ED。`title`・`subtitle`・`date`・`distance`・`ridingTime`・`routes`・`credits`           |
| `subtitle(props)`      | セリフ字幕の文字。`text` (通常は `narration()` が組むので直接は使わない)                 |
| `subtitleBand({})`     | 字幕下の暗がり (props は無いが引数は要る、通常は `narration()` が組むので直接は使わない) |

`volume` は一定値 (数値、0 以上 1 以下) または折れ線 (`{ at, volume }[]`、各点の `volume` も 0 以上 1 以下) で指定する。`at` は要素の再生開始 (`trimBefore` 適用後) からの秒で、点の間は線形補間する。最初の点より前は最初の点の値、最後の点より後は最後の点の値でクランプする。省略時は 1。`audio()` の `loop` と折れ線を併用しても `at` は周回をまたいだ通算秒として扱う (`loopVolumeCurveBehavior="extend"`)。

`fade()`・`crossfade()` は不透明度にだけ効き、音には効かない。`audio()` を `fade()` で包んでも音量は変わらず、`crossfade()` の重なり区間は両方の要素の音がそのまま重なる。音のフェードは `volume` の折れ線で書く。

見た目 (色・書体・配置) は `docs/design/tone-and-manner.md` ([ADR-0004](docs/adr/0004-define-tone-and-manner.md)) で固定し、`src/theme/tokens.ts` の定数から読む。演出の秒数は `src/theme/timing.ts` の定数 (`chapterTiming`・`openingTiming` 等) を使う。timeline.ts にはこれらの値をハードコードせず theme を import する ([ADR-0005](docs/adr/0005-fix-look-in-theme-not-timeline.md))。

### 発話

セリフ (発話) は `src/compositions/narration.ts` が公開する `line()`・`narration()` で書く ([ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md))。字幕・下部の暗がり・セリフ音声をまとめて組み立てるため、要素ファクトリ (`subtitle`・`subtitleBand`) を直接 layer に置く必要はない。

```ts
import { line, narration } from "../../src/compositions/narration.ts";
import { narrator } from "../../src/theme/voice.ts";

export default timeline([
  // ...走行映像・OP・章タイトル等の layer
  ...(await narration([
    cut(line({ text: "{磐梯吾妻|ばんだいあづま}スカイラインを登る。" }), {
      at: 8,
    }),
    cut(
      line({
        text: "今日は雲が多いけど、風は無い。",
        voice: { ...narrator, speed: 0.9 },
      }),
      {
        after: 0.5,
      },
    ),
  ])),
]);
```

- `line({ text, voice? })` の `text` は文字列リテラル (`{漢字|よみ}` の記法で読みを添えられる)。`voice` は省略すると theme の既定話者・声質になる。差分だけを書く (例: `{ ...narrator, speed: 0.9 }`)。`text`・`voice` は watcher (`npm run dev`) が静的に読むため、リテラルの他は theme からの import・spread・同じファイルの const・プロパティアクセスに限られる (詳細は [ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md))。
- `cut()` の `duration` を省いた item は `narration()` にだけ渡せる。位置は `at`/`after`/省略のいずれかで指定し、`after` は前の発話の音声の終わりからの間隔 (秒) になる。
- `narration(items, options?)` は `[暗がり layer, 発話 layer]` の 2 layer を返す。`options.slug` は省略でき、既定は `REMOTION_PROJECT` の解決 (Root.tsx と同じ、`DEFAULT_PROJECT` に落ちる)。サンプルをコピーして project を作るときに書き換え忘れないよう、通常は省略してよい (明示すれば上書きできる)。暗がりの出し引きは発話の並びから自動で計算され、書き手は書かない。
- `narration()` は発話の音声キャッシュを待つため、timeline.ts 側は `...(await narration(...))` の top-level await で受ける。`timeline()` 自体は同期のまま。

project の選択は環境変数 `REMOTION_PROJECT` (slug) で行う。`.env` に書くか `REMOTION_PROJECT=<slug> npx remotion studio` のように渡す。未設定・空ならサンプル project (`00000000-sample`) を読む。VOICEVOX ENGINE の URL は環境変数 `VOICEVOX_URL` で渡す (`.env` に書く)。`npm run dev` は未設定でも起動できるが、その間は発話の音声キャッシュを生成しない。`npm run render` は未設定だと非 0 で終了する。composition の props (`--props` や Studio の props パネル) で `slug` を上書きすると、読み込む timeline.ts は変わるが `narration()` の既定の読み先 (`REMOTION_PROJECT`) は変わらないため食い違う ([ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md))。

## 未実装

立ち絵の口パクは、対応するコンポーネント・要素ファクトリが無く、timeline.ts から置けない。口パクデータの生成は VOICEVOX ENGINE の API から行うが、timeline.ts への載せ方はまだ決まっていない ([ADR-0008](docs/adr/0008-generate-voice-and-lipsync-from-voicevox-api.md))。

ED・サムネ用フレームの絵は要素ファクトリで置けるが、ED からのクロスフェードは未実装。

## フォント

字幕・立ち絵まわりのフォントは `@remotion/google-fonts/NotoSansJP` (`src/fonts.ts`) を使う。weight は T&M ([docs/design/tone-and-manner.md](docs/design/tone-and-manner.md)、[ADR-0004](docs/adr/0004-define-tone-and-manner.md)) が定める 400・500・600 の 3 つだけを読み込む。Noto Sans JP は unicode-range によって 100 を超えるフォントチャンクに分割されているため、`subsets: ["japanese"]` を指定していても実際には多数のチャンクを Google Fonts から取得する。レンダー時にネットワークリクエストに関する警告が多数出力されるが、これは正常な挙動でありエラーではない。

ネットワークに依存したくない場合 (オフライン環境・CI 等) は、`@remotion/fonts` を使って `public/assets/fonts/` 配下に置いたローカルフォントファイルへ差し替えられる ([ADR-0002](docs/adr/0002-project-directory-layout.md))。

## 変換済み素材の生成

ドラレコ原本 (HEVC) は Remotion に直接読ませず、H.264 の変換済み素材に変換して使う ([ADR-0003](docs/adr/0003-convert-dashcam-footage-to-h264-proxy.md))。この変換は非可逆の再エンコードで、変換済み素材の画質が完成動画の画質の上限になる。`remotion render` は Chrome が描いたフレームをさらに再エンコードする (H.264 の既定 CRF は 18) ため、完成動画は 2 回の非可逆エンコードを経る。変換のエンコード設定は NVENC の `-cq 23` と libx264 の `-crf 22` のどちらか一方が使われる。

    npm run convert -- <slug> <入力ファイル>...

`npm run` はリポジトリルートを cwd にして実行するため、入力ファイルは絶対パスで渡す。

- 出力先は `public/projects/<slug>/<basename>.mp4` ([ADR-0002](docs/adr/0002-project-directory-layout.md))。既に存在するファイルはスキップする。
- `<slug>` は `YYYYMMDD-<name>` (ASCII 小文字の kebab-case)。形式が違うとエラーになる。
- フレームレートは `src/theme/timing.ts` の `fps` に固定されており、指定オプションは無い。composition の fps と常に一致する。GOP 長は fps と同じ (1 秒ごとにキーフレーム)。
- 起動時に NVENC が使えるかを確認し、使えなければ libx264 を使う。NVENC が使える場合でも、あるファイルの変換に失敗したときはそのファイルだけ libx264 で再試行する。一度 libx264 に落ちたら以降のファイルも libx264 で変換する。WSL で NVENC を使うために `LD_LIBRARY_PATH=/usr/lib/wsl/lib` をスクリプト内で設定している。
- 拡張子違いで同じ basename になる入力 (例: `clip.mov` と `clip.mp4`) を同時に渡すとエラーになる。

## コーディング規約

- 相対 import・export・import() には実体のファイルの拡張子 (`.ts`/`.tsx`/`.module.css`/`.json`) を付ける。`../theme` のようなディレクトリ指定は `index.ts` まで書く。
- 日付と時間は Temporal で表し、`Date` は使わない ([ADR-0007](docs/adr/0007-use-temporal-for-dates-and-times.md))。
- コミット前に `npm run fix` (ESLint と prettier の自動修正) を通す。

## License

Remotion は個人利用は無料だが、組織によっては company license が必要になる。[Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
