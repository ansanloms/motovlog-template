# motovlog-template

[motovlog](https://github.com/ansanloms/motovlog) で作るモトブログ動画の project 一式。現在は浄土平の走行 (`projects/20260813-jododaira/`) を収める。

動画を作る機能 (演出の DSL・コンポーネント・音声生成・素材の変換・Studio の起動) は lib の `motovlog` が持ち、このリポジトリは色・話者・project の定義・キャラクター・素材だけを持つ。timeline.ts の書き方、各要素の API、設計上の決定 (ADR) は [motovlog のリポジトリ](https://github.com/ansanloms/motovlog) を参照する。

## 前提

- Node.js と npm
- ffmpeg (ドラレコ原本の変換。NVENC を使う場合は NVIDIA GPU)
- VOICEVOX ENGINE (発話の音声生成)

## セットアップ

1. 依存を入れる: `npm ci`。`motovlog` は GitHub から commit を固定して入る (`package.json` の `dependencies`)。
2. `.env.example` を `.env` にコピーし、`REMOTION_PROJECT` (読み込む project の slug) と `VOICEVOX_URL` (VOICEVOX ENGINE の URL) を書く。
3. 素材を `public/` の下に置く (「ディレクトリ構成」参照)。素材はコミットしない。

## コマンド

| コマンド                                      | 内容                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                                 | timeline.ts を監視して発話の音声キャッシュを生成しつつ、Remotion Studio を起動する (`motovlog-dev`) |
| `npm run convert -- <slug> <入力ファイル>...` | ドラレコ原本を変換済み素材と Studio 用プロキシに変換する (`motovlog-convert`)。入力は絶対パスで渡す |
| `npm run voice`                               | 発話の音声キャッシュを生成する (`motovlog-voice`)                                                   |
| `npm run render -- out/<slug>.mp4`            | 音声キャッシュを生成してから `Motovlog` composition をレンダリングする                              |
| `npm run lint` / `npm run fix`                | ESLint・tsc・prettier の検査 / 自動修正                                                             |

Remotion CLI は `.env` の値をシェルの環境変数より優先するため、project を切り替えるときは `.env` の `REMOTION_PROJECT` を書き換える。

## ディレクトリ構成

- `app/index.ts`: Remotion の入口。`configure()` で利用側の値を lib に渡してから `registerRoot()` を呼ぶ
- `app/config.ts`: `theme` の re-export と `defaultProject` (`REMOTION_PROJECT` が未設定のときの slug)。音声生成の watcher (Node) も読むため Remotion を import しない
- `theme/index.ts`: カラーパレット (`palette`) と既定の話者 (`narrator`)。変えるとすべての project に効く
- `projects/<slug>/timeline.ts`: 動画 1 本の定義。`<slug>` は `YYYYMMDD-<name>`
- `characters/<name>.ts`: キャラクター (立ち絵) の定義。lib からは `motovlog/compositions/character` だけを import する
- `types/temporal.d.ts`: Temporal の型の参照 (TypeScript 5.9 には Temporal の型が無いため)
- `public/projects/<slug>/`: 動画固有の素材 (変換済み素材・Studio 用プロキシ・発話の音声キャッシュ等)。コミットしない
- `public/assets/<種別>/`: 共通素材 (`bgm`・`se`・`fonts`・`characters/<name>`)。既定でコミットしない。再配布できる自作素材は `.gitignore` の否定パターンで明示してコミットする
- `remotion.config.ts`: Remotion の設定。`Config.setEntryPoint("./app/index.ts")` で入口を指す

`app/`・`theme/`・`projects/` から lib を import してよいのは、`motovlog`・`motovlog/effects`・`motovlog/components`・`motovlog/compositions`・`motovlog/theme`・`motovlog/modules/<name>` だけで、それ以外は ESLint が落とす。

## 新しい動画を作る

1. slug を決めて `projects/<slug>/timeline.ts` を作る。
2. `npm run convert -- <slug> <原本>...` でドラレコ原本を変換する。出力は `public/projects/<slug>/<basename>.mp4` と `<basename>.preview.mp4`。
3. timeline.ts に走行映像・章タイトル・注釈・発話等の要素を書く。素材のパスは `public/` 相対で書く。
4. `.env` の `REMOTION_PROJECT` を `<slug>` にして `npm run dev` でプレビューする。
5. `npm run render -- out/<slug>.mp4` でレンダリングする。
6. 公開したら `git tag render/<slug>` を打つ。再現はタグを checkout して `npm ci` し、素材を復元して render する。

## lib の更新

lib の変更は [ansanloms/motovlog](https://github.com/ansanloms/motovlog) で行う。このリポジトリでは `package.json` の `motovlog` の commit を差し替えて `npm install` し、`npm run lint` と Studio で確かめる。

## コーディング規約

- 相対 import・export・import() には実体のファイルの拡張子 (`.ts`/`.tsx`/`.module.css`/`.json`) を付ける。
- 日付と時間は Temporal で表し、`Date` は使わない。
- コミット前に `npm run fix` を通す。

## License

Remotion は個人利用は無料だが、組織によっては company license が必要になる。[Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。
