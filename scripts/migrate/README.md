# scripts/migrate

AviUtl ExEdit2 の project ファイル (`.aup2`) を、このテンプレートの
`projects/<slug>/timeline.ts` に写す一回限りの変換スクリプト。

ピクセル一致は目的にしない。AviUtl 側の手置きの座標・拡大率・合成モード・
字間は写さず、要素の種類と時間配置だけを写して、見た目はこのリポジトリの
トンマナ (`docs/design/tone-and-manner.md`) に寄せる。

`package.json` の `scripts`・`exports`・`files` には登録していない。実行は
`tsx` で直接行う。

## 構成

| ファイル                | 役割                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `aup2/parse.ts`         | `.aup2` (INI 風テキスト) を `{ header, objects }` に読む純粋関数  |
| `aup2/plan.ts`          | オブジェクト群を中間表現 (layer ごとの item 列) に写す純粋関数    |
| `aup2/emit.ts`          | 中間表現を `timeline.ts` のソースにし、prettier で整形する        |
| `aup2/main.ts`          | CLI。読み込み → 計画 → 書き出し                                   |
| `aup2/expressions.json` | PSDToolKit の `レイヤー` 文字列 → `characters/<name>.ts` の表情名 |
| `aup2/<name>.json`      | project ごとに人が埋める値 (タイトル・日付・距離・章タイトル等)   |

## 使い方

```sh
tsx scripts/migrate/aup2/main.ts <movie.aup2> <slug> [オプション]
```

| オプション             | 既定                                          |
| ---------------------- | --------------------------------------------- |
| `--out <path>`         | `projects/<slug>/timeline.ts`                 |
| `--meta <path>`        | `scripts/migrate/aup2/<slug の名前部分>.json` |
| `--expressions <path>` | `scripts/migrate/aup2/expressions.json`       |
| `--character <name>`   | `ryusei` (`characters/<name>.ts`)             |

素材の変換と発話の音声生成は既存のスクリプトが行う。全体の手順は次の通り。

```sh
# 1. 走行映像を H.264 プロキシに変換する (ADR-0003)
npm run convert -- <slug> <原本の mp4>...

# 2. 写真を置く
mkdir -p public/projects/<slug>/photos
cp <原本の jpg>... public/projects/<slug>/photos/

# 3. timeline.ts を生成する
tsx scripts/migrate/aup2/main.ts <movie.aup2> <slug>

# 4. 発話の音声キャッシュを生成する (.env の VOICEVOX_URL を使う)
REMOTION_PROJECT=<slug> tsx scripts/voice.ts

# 5. 確認
npm run lint
npx remotion render Motovlog out/<slug>.mp4
```

render と Studio では `.env` の `REMOTION_PROJECT` を移行先の slug に書き換える。
Remotion CLI は `.env` を読み、その値がシェルの環境変数より優先されるため、
`REMOTION_PROJECT=<slug> npx remotion render ...` の形では `.env` に書かれた
project が読まれる (2026-09-11 実測)。発話の音声生成 (`scripts/voice.ts`) は
Remotion CLI を通さないため、引数かシェルの環境変数で slug を渡せる。

`.aup2` の原本と素材の置き場はこのリポジトリの外にある。素材は
`public/projects/<slug>/` に置き、コミットしない
([ADR-0002](../../docs/adr/0002-project-directory-layout.md))。

## 写像の規則

フレームは両端を含む区間として読み、`at = 開始 / fps`、
`duration = (終了 - 開始 + 1) / fps` で秒にする。秒は小数第 3 位で丸める。

原本に OP (サムネ) が無いため、原本の全要素を OP の尺
(`openingTiming.duration`) だけ後ろへ送る。

| AviUtl 側                                                           | timeline.ts 側                                                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `動画ファイル` (最も下の layer)                                     | `video()`。`再生位置` の開始秒が `trimBefore`、`フェード` が `fade()` の in/out、`映像再生` の `音量` と `音量フェード` が `volume` の折れ線 |
| `シーンチェンジ` (クロスフェード)                                   | `crossfade()`。直前の走行映像の尺を遷移の尺だけ延ばし、直後の絶対開始を保つ                                                                  |
| `音声ファイル` (最も下の layer)                                     | `audio()` (BGM)                                                                                                                              |
| `画像ファイル` (走行映像の layer 以外)                              | `photoShowcase()` 1 枚ずつ                                                                                                                   |
| `音声ファイル` (それより上の layer) + 同じ開始フレームの `テキスト` | `narration()` の `line({ text, by, expression })`                                                                                            |
| 声の無い `テキスト`                                                 | `narration()` に置く `cut(subtitle(...), { duration })`                                                                                      |
| ED の区間の `テキスト`                                              | `ending()` の `credits`                                                                                                                      |
| `PSDファイル@PSDToolKit`                                            | `figure()`。`標準描画` の X の符号が `side`、`レイヤー` 文字列が `expression`                                                                |
| `フレームバッファ`                                                  | `fade(frame(), { in, out })`                                                                                                                 |
| `シーンチェンジ` (暗転)                                             | `fade(frame(), ...)`。in / out は区間の半分ずつ (フレームに切り下げ)                                                                         |
| `図形` の帯                                                         | 章の区切り。各帯の開始に終わりを合わせて `chapter()` を置く                                                                                  |
| (原本に無い)                                                        | 先頭に `thumbnail()` の OP、末尾に `ending()` (最後の走行映像の終端に合わせる)                                                               |

### 発話の位置

音声は VOICEVOX で作り直すため、原本の wav と尺が一致しない。すべてを絶対秒
で置くと発話どうしが重なって `timeline()` が throw するため、次のように
置く。

- 直前の発話との無音が `bandTiming.silenceGap` 未満なら `after` (直前の発話が
  実際に終わってからの間隔)。原本の「間の取り方」をそのまま保つ。
- 無音が `bandTiming.silenceGap` 以上あいたら `at` (絶対秒) に戻す。字幕の帯
  (暗がり) がひと続きになる単位と同じで、1 続きの帯に乗る発話が 1 つの run
  になる。

発話が重なると `narration()` が throw する。原本より生成した音声が長くて
run が次の run の開始を追い越す場合は、`<name>.json` ではなく生成した
`timeline.ts` を直して調整する (再生成すると上書きされるので、`.aup2` 側を
直すか、調整を別途記録する)。

### 写さないもの

- 走行映像の最後のフレームより後ろから始まるオブジェクト (原本の ED の静止画・
  その上の立ち絵・最後の暗転)。ED は `ending()` が描くため背景の静止画は要らない。
- 写真紹介の枠に置かれた動画。`photoShowcase()` は写真だけを受ける。
- PSDToolKit の配線用オブジェクト (`セリフ準備@PSDToolKit`・
  `最初に置くやつ@PSDToolKit`)。口パクと表情は `figure()` が `narration()` の
  `speech` から作る。
- 手置きの座標・拡大率・合成モード (乗算)・字間・別 layer のシーンチェンジ。

写さなかったオブジェクトは実行時に標準出力へ一覧で出る。

## `expressions.json` の埋め方

PSDToolKit は立ち絵の状態を `レイヤー=L.0 V....` の不透明な文字列で持つ。
この文字列と `characters/<name>.ts` の表情名の対応は機械では決められないため、
人が埋める。

1. 一度 `main.ts` を実行すると、`expressions.json` に無い / 値が空のキーが
   標準エラーに警告として出る (値が空のキーは `normal` に落ちる)。
2. AviUtl で各区間の立ち絵を見て、`characters/<name>.ts` の `expressions` の
   キー (`normal`・`sweat`・`tears`・`cry`・`teach`・`armsCrossed` 等) を
   値に書く。
3. `main.ts` を再実行する。

## `<name>.json` の埋め方

原本に無い値 (タイトル・走行距離・走行時間・ルート・章タイトル・サムネの
バッジ) をここに書く。分からない値は空文字 (数値は 0) のままでよく、その
場合は画面にも空で出る。

| キー         | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| `title`      | OP と ED の題名                                              |
| `subtitle`   | ED の右上 (例 `EP.12 / 愛媛`)                                |
| `date`       | 走行日の範囲。`Temporal.ZonedDateTime.from()` に渡せる文字列 |
| `distance`   | 走行距離 (km)                                                |
| `ridingTime` | 走行時間 (`{ hours, minutes }`)                              |
| `routes`     | ED の ROUTE (5〜7 か所)                                      |
| `chapters`   | 章タイトル。帯の本数と同じ数だけ要る (合わないと警告が出る)  |
| `thumbnail`  | OP に使う写真の basename と右上のバッジ                      |
