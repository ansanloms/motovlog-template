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
| `public/assets/characters/ryusei/*.png`                                       | 立ち絵 (`figure()`・サムネの `thumbnail()`) のパーツ一式。`characters/ryusei.ts` が参照する                                                |
| `public/assets/bgm/m1.wav`                                                    | サンプルの BGM (`audio()` の例)                                                                                                            |

素材が手元に無い場合、走行映像は次の ffmpeg で同名の合成素材を作れば代わりに使える。既に同名のファイルがあれば `-n` により上書きせずに終了する。

```sh
mkdir -p public/projects/00000000-sample
ffmpeg -n -f lavfi -i testsrc=size=1920x1080:rate=30:duration=40 -pix_fmt yuv420p public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4
```

写真 (`photos/photo-01.jpg`・`photo-02.jpg`・`photo-03.jpg`) と立ち絵 (`assets/characters/ryusei/*.png`) はイラスト素材で ffmpeg では代替できない。手元の JPG/PNG を同名で置けばサムネ・写真紹介の見た目は仮のものになるが Studio と render は動く。代替の合成動画は変換済み素材と同じファイル名なので、実素材に切り替えるときは代替ファイルを消してから `npm run convert -- 00000000-sample <原本>` を実行する (既存があると skip される)。

立ち絵 PNG (`public/assets/characters/ryusei/`) が無い場合は、サンプルの立ち絵 layer (layer 2) と `line()` の `by`・`expression` を外すか、`characters/ryusei.ts` の各パーツを手持ちの同一キャンバスの PNG に差し替える。

素材を置けば Studio と render が動く (`REMOTION_PROJECT` は未設定でよく、既定でこのサンプルを読む)。

## timeline.ts の書き方

timeline 定義は `projects/<slug>/timeline.ts` が `export default` する、`src/effects` の関数 (`timeline`・`fade`・`cut`) の呼び出しで書く ([ADR-0006](docs/adr/0006-write-timeline-as-effects-dsl.md))。

```ts
import { staticFile } from "remotion";
import { ryusei } from "../../characters/ryusei.ts";
import { chapterTitle, video } from "../../src/components/index.tsx";
import { thumbnail } from "../../src/compositions/thumbnail.ts";
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
        character: ryusei,
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
| `chapterTitle(props)`  | 章タイトル。`title`・`subtitle`                                                          |
| `annotation(props)`    | 右上の注釈。`text`                                                                       |
| `photoShowcase(props)` | 写真紹介 (1〜2 枚)。`photos`                                                             |
| `ending(props)`        | ED。`title`・`subtitle`・`date`・`distance`・`ridingTime`・`routes`・`credits`           |
| `subtitle(props)`      | セリフ字幕の文字。`text` (通常は `narration()` が組むので直接は使わない)                 |
| `subtitleBand({})`     | 字幕下の暗がり (props は無いが引数は要る、通常は `narration()` が組むので直接は使わない) |

立ち絵の `figure()` は要素ファクトリではなく `line()`・`narration()` と同じ `src/compositions` に置く (「立ち絵」参照。src/effects の `sample()` を使うため)。サムネ・OP の絵の `thumbnail(props)` も同じく `src/compositions` に置く (`photo`・`badge`・`title`・`character` (`character()` の戻り値)・`expression?` (省略時は `expressions` の最初のキー) を受け、`character()` の表情名の解決 (`figureLayers()`) を伴うため、ADR-0011 の禁止事項により src/components 単体では書けない)。

`volume` は一定値 (数値、0 以上 1 以下) または折れ線 (`{ at, volume }[]`、各点の `volume` も 0 以上 1 以下) で指定する。`at` は要素の再生開始 (`trimBefore` 適用後) からの秒で、点の間は線形補間する。最初の点より前は最初の点の値、最後の点より後は最後の点の値でクランプする。省略時は 1。`audio()` の `loop` と折れ線を併用しても `at` は周回をまたいだ通算秒として扱う (`loopVolumeCurveBehavior="extend"`)。

`fade()`・`crossfade()` は不透明度にだけ効き、音には効かない。`audio()` を `fade()` で包んでも音量は変わらず、`crossfade()` の重なり区間は両方の要素の音がそのまま重なる。音のフェードは `volume` の折れ線で書く。

見た目 (色・書体・配置) は `docs/design/tone-and-manner.md` ([ADR-0004](docs/adr/0004-define-tone-and-manner.md)) で固定し、`src/theme/tokens.ts` の定数から読む。演出の秒数は `src/theme/timing.ts` の定数 (`chapterTiming`・`openingTiming` 等) を使う。timeline.ts にはこれらの値をハードコードせず theme を import する ([ADR-0005](docs/adr/0005-fix-look-in-theme-not-timeline.md))。

### 発話

セリフ (発話) は `src/compositions/narration.ts` が公開する `line()`・`narration()` で書く ([ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md), [ADR-0011](docs/adr/0011-draw-figure-from-character-presets-linked-by-speech.md))。字幕・下部の暗がり・セリフ音声をまとめて組み立てるため、要素ファクトリ (`subtitle`・`subtitleBand`) を直接 layer に置く必要はない。

```ts
import { ryusei } from "../../characters/ryusei.ts";
import { line, narration } from "../../src/compositions/narration.ts";

const n = await narration([
  cut(
    line({ text: "{磐梯吾妻|ばんだいあづま}スカイラインを登る。", by: ryusei }),
    { at: 8 },
  ),
  cut(
    line({
      text: "今日は雲が多いけど、風は無い。",
      by: ryusei,
      voice: { speed: 0.9 },
      expression: "sweat",
    }),
    { after: 0.5 },
  ),
]);

export default timeline([
  // ...走行映像・OP・章タイトル・立ち絵等の layer
  ...n.layers,
]);
```

- `line({ text, voice?, by?, expression? })` の `text` は文字列リテラル (`{漢字|よみ}` の記法で読みを添えられる)。
- `by` は `characters/<name>.ts` の `character()` の戻り値の参照。指定すると `narration()` の `speech` にその参照が乗り、`figure()` (「立ち絵」) が自分宛の発話を選ぶのに使う。
- `voice` の実効値は theme の既定話者 (`narrator`) ← `by.voice` ← `line()` 自身の `voice` の順で上書きした値になる。差分だけを書く (例: `{ speed: 0.9 }`)。`text`・`voice`・`by` は watcher (`npm run dev`) が静的に読むため、リテラルの他は theme からの import・spread・同じファイルの const・プロパティアクセスに限られる。`by` は識別子 (同じファイルの const か import) に限る (詳細は [ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md), [ADR-0011](docs/adr/0011-draw-figure-from-character-presets-linked-by-speech.md))。
- `expression` は `by` の `expressions` のキー (文字列リテラル)。指定すると、この発話の開始と同時に立ち絵の表情がそのキーに切り替わり、次に `expression` を指定する自分宛の発話まで維持する (詳細は「立ち絵」)。
- `cut()` の `duration` を省いた item は `narration()` にだけ渡せる。位置は `at`/`after`/省略のいずれかで指定し、`after` は前の発話の音声の終わりからの間隔 (秒) になる。
- `narration(items, options?)` は `{ layers: [暗がり layer, 発話 layer], speech }` を返す。`speech` は `line()` item ごと (渡した順) に、音声の絶対開始秒・実尺・口パクデータ・`by`・`expression` を持ち、`figure()` (「立ち絵」) が読む。timeline.ts では `layers` と `speech` を分けて書く (`...n.layers` を timeline の layer に、`n.speech` を `figure()` に渡す)。`options.slug` は省略でき、既定は `REMOTION_PROJECT` の解決 (Root.tsx と同じ、`DEFAULT_PROJECT` に落ちる)。サンプルをコピーして project を作るときに書き換え忘れないよう、通常は省略してよい (明示すれば上書きできる)。暗がりの出し引きは発話の並びから自動で計算され、書き手は書かない。
- `narration()` は発話の音声キャッシュを待つため、timeline.ts 側は `const n = await narration(...)` の top-level await で受ける。`timeline()` 自体は同期のまま。

project の選択は環境変数 `REMOTION_PROJECT` (slug) で行う。`.env` に書くか `REMOTION_PROJECT=<slug> npx remotion studio` のように渡す。未設定・空ならサンプル project (`00000000-sample`) を読む。VOICEVOX ENGINE の URL は環境変数 `VOICEVOX_URL` で渡す (`.env` に書く)。`npm run dev` は未設定でも起動できるが、その間は発話の音声キャッシュを生成しない。`npm run render` は未設定だと非 0 で終了する。composition の props (`--props` や Studio の props パネル) で `slug` を上書きすると、読み込む timeline.ts は変わるが `narration()` の既定の読み先 (`REMOTION_PROJECT`) は変わらないため食い違う ([ADR-0010](docs/adr/0010-build-narration-timeline-with-hashed-voice-cache.md))。

### 立ち絵

立ち絵 (話者のキャラクター絵) の目パチ・口パク・表情は `src/compositions/character.ts` が公開する `character()` と `src/compositions/figure.ts` が公開する `figure()` で書く ([ADR-0011](docs/adr/0011-draw-figure-from-character-presets-linked-by-speech.md))。

キャラクターの定義は project をまたいで使い回すため `characters/<name>.ts` (リポジトリルート、`projects/` の隣) に置き、`character({ voice?, expressions })` で組み立てて export する。`voice` はこのキャラクターの既定の声質差分 (省略時は theme の既定話者のまま)。`expressions` は表情名から画像レイヤーの列 (下から上に重ねる順) への対応で、レイヤーは次の 3 種を混ぜて書ける。

- 静止画 (文字列)。体・腕・眉・小物・顔色効果等、パスは `public/` 相対。
- 目 `{ eyes: { open, closed } }`。`figure()` が目パチで開閉を切り替える。
- 口 `{ mouth: { a, i, u, e, o, n } }`。`figure()` が口パクで母音を切り替える (`n` は無音・撥音・子音の隙間)。

画像はすべて同一キャンバスの PNG とし、`character()`・`figure()` は座標計算をしない。素材の切り出し (PSD からのレイヤー書き出し、例えば `psd-tools` を使う) はこのテンプレートの外で行い、`public/assets/characters/<name>/` に置く (第三者素材は既定でコミットしない、「ディレクトリ構成」)。

timeline.ts では `figure(character, { expression?, speech, side? })` を `cut()`/`fade()` の node として立ち絵 layer に置く。`character` は `characters/<name>.ts` の戻り値の参照 (`line()` の `by` に渡したのと同じもの)、`speech` は `narration()` の戻り値の `speech` をそのまま渡してよい (`figure()` が `by` が自分と同じ発話だけを使う)。`expression` は初期の表情名 (省略時は `expressions` の最初のキー)。`side` は `"left"` (既定) か `"right"`。右へ移すのは章の区切りでのみ、1 本 2 回まで (T&M「画面配置」)。

- 口の形は発話中の口パクデータから母音ごとに選び、発話の外は口を閉じる (`n`)。目パチは theme の `characterTiming` (周期と閉眼の秒数) に従い、動画先頭からの絶対秒で位相を決める (item を分割しても目パチはずれない)。
- 表情の切り替えは 2 通りある。1 つは `line()` の `expression` (発話に伴う切り替え、上の「発話」参照)。もう 1 つは `figure()` の item を分けて `expression` オプションを変えること (発話と無関係な切り替え)。
- 立ち絵を一時的に隠す (章タイトル中等) には、`figure()` の item を分けてその区間を空ける。`narration()` と違い `figure()` の item の尺は数値で書く必要がある (アンカーは `at` にしか渡せない、[ADR-0009](docs/adr/0009-add-transition-frame-and-anchor-to-timeline.md))。

## 未実装

ED・サムネ用フレームの絵は要素ファクトリで置けるが、ED からのクロスフェードは未実装。

## フォント

字幕・立ち絵まわりのフォントは `@remotion/google-fonts/NotoSansJP` (`src/fonts.ts`) を使う。weight は T&M ([docs/design/tone-and-manner.md](docs/design/tone-and-manner.md)、[ADR-0004](docs/adr/0004-define-tone-and-manner.md)) が定める 400・500・600・700 の 4 つだけを読み込む。Noto Sans JP は unicode-range によって 100 を超えるフォントチャンクに分割されているため、`subsets: ["japanese"]` を指定していても実際には多数のチャンクを Google Fonts から取得する。レンダー時にネットワークリクエストに関する警告が多数出力されるが、これは正常な挙動でありエラーではない。

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
