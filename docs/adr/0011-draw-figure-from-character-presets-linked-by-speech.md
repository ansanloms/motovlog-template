---
status: accepted
date: 2026-09-09T20:00:00Z
refs: [2, 5, 6, 8, 9, 10, 14]
tags: [figure, lipsync, character, timeline]
---

# ADR-0011: 立ち絵を character() のプリセットと figure() で描き、発話の by で口パクと表情を結び付ける

## Context

モトブログの立ち絵 (話者のキャラクター絵) を timeline に置き、目パチと口パクを描く方法と、表情・ポーズの切り替えを書く方法を決める。

[ADR-0008](./0008-generate-voice-and-lipsync-from-voicevox-api.md) の生成スクリプトは、発話ごとの音声キャッシュ `<key>.json` に口パクデータ (`{ start, end, vowel }[]`、wav の先頭からの秒、vowel は a・i・u・e・o・N・cl・pau) を書いている。[ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) の `narration()` は各発話の絶対開始秒を解決してこのキャッシュを読むが、口パクデータは使っていない。

[ADR-0006](./0006-write-timeline-as-effects-dsl.md) の層の規則では、現在フレームを読む (`useCurrentFrame()`) のは src/effects の描画部品だけで、src/components はフレーム API を使わず固定の props で描く。`Stage` は item の要素 (ReactNode) をそのまま `Sequence` の子に置き、現在フレームや開始秒を要素に渡さない。

[ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md) のアンカーは `timeline()` の構築時に秒を解決するだけで、描画時に layer をまたいで値が流れる仕組みは無い。アンカーが参照できるのは下の layer と同じ layer の前の item に限る。

立ち絵は字幕と暗がりより下の layer に置く (字幕が立ち絵に重なる)。立ち絵は発話中だけ出るものではなく、[T&M](../design/tone-and-manner.md) では常時表示して章タイトル・OP/ED・サムネ用フレームの間だけ消す。目パチは発話と無関係に動く。

Remotion は各フレームを個別に描くため、CSS アニメーションや gif のように実時間で進む表現は使えない ([ADR-0005](./0005-fix-look-in-theme-not-timeline.md))。フレームごとに変わる値は現在フレームから計算する。

立ち絵の素材は PSD で配布され、体・腕・目・口・眉・顔色効果・小物のグループに分かれている。目は開閉、口は母音ごと、腕はポーズごとにレイヤーがある。表情 (汗・涙・号泣・教える・腕組み等) はこれらのレイヤーの組み合わせで作る。

1 本の動画に 2 体以上の立ち絵を置き、発話を掛け合いで書く場面がある。発話に使う VOICEVOX の speaker (スタイル id) は同じキャラクターでも感情ごとに変わるため、speaker はキャラクターの識別子にならない。

音声・映像の音量は要素の props に折れ線 (`{ at, volume }[]`) で書く。

## Decision Drivers

1. [ADR-0006](./0006-write-timeline-as-effects-dsl.md) の層の規則を保つ。
   - フレームを読むのは src/effects だけ。
   - src/components は固定の props で描く。
   - 動画のドメイン (母音と口の対応・表情) は src/compositions に置く。
2. 音声・字幕・口パクの時刻の正本を 1 つにする。発話の位置 (`at`・`after`) を書き換えたら 3 つが一緒に動く。
3. 2 体以上の立ち絵と掛け合いを、`narration()` を 1 つのまま書ける。
4. 表情・ポーズを、発話に伴う切り替えと発話と無関係な切り替えの両方で書ける。
5. 音声生成の watcher が timeline.ts を静的に評価する規則 ([ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md)) を保つ。

## Considered Options

フレーム依存の描画をどこに置くか。

1. src/effects に、時刻を受けて要素を返す関数を毎フレーム呼ぶ演出関数 `sample()` を足す — 採用。fade が時刻を不透明度に写すのと同じ種類の術で、effects は時刻だけを持ち要素の中身を知らない。
2. 口の形の区間ごとに `cut()` を並べ、既存の DSL だけで組む — 却下。mora ごとに `Sequence` が立ち、体・目・口が別 layer に分かれて、章タイトル中の非表示を layer ごとに揃えて書くことになる。
3. src/compositions に `useCurrentFrame()` を使うコンポーネントを置く — 却下。ESLint の縛りが無い層が第 2 の effects になり、フレームを読む場所が 2 つになる。
4. src/components のフレーム API の禁止を緩める — 却下。[ADR-0006](./0006-write-timeline-as-effects-dsl.md) の分担を「口パクに要る」という理由だけで覆す。

立ち絵と発話の結び付け。

5. `character()` が返すオブジェクトを `line()` の `by` に渡し、`narration()` が発話ごとにその参照を返す — 採用。参照の解決は TypeScript の識別子で済み、存在しないキャラクターはコンパイルで落ちる。
6. `voice.speaker` で結び付ける — 却下。同じキャラクターが感情ごとに別の speaker を使うと崩れる。
7. 文字列の id で結び付ける — 却下。id の登録表と名前解決が要り、typo が実行時にしか出ない。
8. 字幕と音声の要素 (`Line`) に立ち絵を含める — 却下。立ち絵は発話の外でも表示され、目パチは発話と無関係に動く。

表情の切り替えの書き方。

9. 発話の `expression` と、立ち絵 layer の item の分割 — 採用。発話に伴う切り替えは秒を書かずに済み、発話と無関係な切り替えは DSL の位置指定と遷移をそのまま使える。
10. 立ち絵の要素の props に `{ at, expression }[]` の折れ線を持たせる — 却下。表情は離散のスイッチで補間しない。timeline が持つ時刻の仕組み (位置・アンカー・fade・crossfade) を props の中に作り直すことになり、props の中ではアンカーが使えない。
11. 立ち絵の item を `start(発話の item)` で結ぶ — 却下。行を const に取り出す必要があり、範囲の意図が発話の並びから離れる ([ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md))。

## Decision

- src/effects に `sample(render)` を足す。
  - `render` は `{ seconds, absolute, frame }` (item の開始からの秒・item が属する塊 (最上位なら動画) の先頭からの秒・`Sequence` 内のフレーム番号、[ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md)) を受けて ReactNode を返す関数で、`cut()`・`fade()` の要素に渡せる。
  - `Stage` は `Sequence` の内側で `useCurrentFrame()` を読んで `render` を毎フレーム呼ぶ。
  - effects は `render` が返す要素の中身を知らない。
- `character({ voice, expressions })` を src/compositions に置く。立ち絵の実体は `narration()` が `figure()` の括り ([ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md)) から組み立て、`sample()` で包んだ要素を立ち絵 layer に置く。書き手は `figure(character, { side?, in?, out?, lead?, tail?, expression? }, items)` で発話の行を括り、`narration()` の入力配列に item と混ぜて置くだけで済み、立ち絵の item を `cut()`・`fade()` で直接置くことはしない (組み立ての詳細は [ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md))。
- `side` は立ち絵の枠を置く側で、値は `"left"` と `"right"`、既定は `"left"` とする。右へ移すのは章の区切りに限る ([T&M](../design/tone-and-manner.md)「画面配置」節)。左右それぞれの座標は theme が持ち、`side` はその切り替えだけを指す ([ADR-0005](./0005-fix-look-in-theme-not-timeline.md))。
- `character()` の `expressions` は表情名から画像レイヤーの列 (下から上の順) への対応とする。レイヤーは次の 3 種で、画像のパスは public ディレクトリ相対の文字列で書き、立ち絵の item が `staticFile()` を掛ける。
  - 静止画 (文字列)。体・腕・眉・小物・顔色効果。
  - 目 `{ eyes: { open, closed } }`。立ち絵の item が目パチで切り替える。
  - 口 `{ mouth: { a, i, u, e, o, n } }`。立ち絵の item が口パクで切り替える。
  - 目・口の切り替えをしない表情は、目・口も静止画で書く。
- すべてのレイヤー画像は同一キャンバスの画像 (PNG・SVG) とし、座標計算はしない。SVG は幅と高さを持つ形で書き出す。理由: 枠内の拡縮は CSS の `height` と `width: auto` で行うため、画像に本来の縦横比が要る。素材の切り出し (PSD からの書き出し等) はテンプレートの外で行う。
- キャラクターの定義は `characters/<name>.ts` に置き、画像は `public/assets/characters/<name>/` に置く。定義は project をまたいで使い回し、画像は第三者の素材なら [ADR-0002](./0002-project-directory-layout.md) の規則どおりコミットしない。
- `line()` に `by` を足す。発話の声質は theme の `narrator` を `by` の `voice` で上書きし、さらに `line()` の `voice` で上書きした値とする。音声キャッシュの key は text とこの実効の声質だけから作り、`by` (`character` の参照・`expression` とも) は含めない。
  - `by` は `character()` が返す値の参照 (表情は現在の表情を維持)、または `{ character, expression? }` の形 (`character` がその参照、`expression` が表情名) のどちらかとする。
  - `thumbnail()` も同じ形の `by` を受ける (表情の既定は `expressions` の最初のキー)。
- `narration()` は塊 (`GroupNode`、[ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md)) に `speech` を加えた値を返し、`cut(n, { at })`・`fade(n, { at, in, out })` で置く。`speech` は `line()` の item ごとに `{ at (塊の先頭からの音声の開始秒), duration (音声が実際に鳴る秒数), lipsync, by?, expression? }` を持つ。
- `speech` の `duration` は `min(キャッシュの実尺, 字幕の尺)` とする。理由: `duration` を明示して字幕を実尺より短く切ると音声も `Sequence` で切れるため、キャッシュの実尺のままだと発話の後も口パクが続く。
- 立ち絵の item は `speech` のうち `by` が自分のキャラクター (`figure()` の第 1 引数) と同一のものだけを使う。口の形は塊相対の絶対秒 (`sample()` の `absolute`) から発話を探し、発話の開始からの秒で口パクデータの区間を引く。口の形の決め方は次のとおり。
  - a・i・u・e・o はそのまま。
  - N と pau は n。
  - cl と区間の隙間 (子音) は直前の口の形を維持する。
  - 発話の外は n とする。
- 表情は絶対秒までに始まった自分宛の発話のうち `expression` を持つ最後のものがあればその表情にし、次の指定まで維持する。括りの `expression` を明示した場合は、その値を初期値としつつ括りの開始より前に始まった発話の指定を無視する (括りの開始でいったんその初期値に戻り、以降は括り内の発話が切り替える)。括りの `expression` を省略した場合は `expressions` の最初の表情を初期値としつつ、括りの開始に関わらず直近の発話の指定を引き継ぐ (括りをまたいでも表情が戻らない)。この引き継ぎは同じ `narration()` の呼び出し (1 つの塊) に限り、別の `narration()` の呼び出しをまたいでは引き継がない (新しい塊は初期の表情から始まる)。
- 目パチは theme の `characterTiming` (周期と閉眼の秒数) に従い、その立ち絵の item が属する塊 (`narration()` の塊、さらに外の塊に置いた場合はその塊) の先頭からの秒で位相を決める ([ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md) により `sample()` の `absolute` が塊相対のため)。括りを分けても、同じ塊の中であれば位相はずれない。
- 発話と無関係な表情の切り替えは `figure()` の括りを分けて `expression` を変える。章タイトル中の非表示は、その区間の行を括りに含めない。左右の移動は括りごとの `side` で指定する ([ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md))。
- 音声生成の watcher は `line()` の `by` を、識別子ならその値、`{ character, expression? }` の形のオブジェクトリテラルなら `character` プロパティ (識別子限定) を、それぞれ同じファイルの top-level const の `character()` 呼び出し、または import の binding として解決し、その `voice` プロパティを [ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) の `voice` と同じ規則で評価する。`character()` 呼び出しの引数からは `voice` だけを読み、`expressions` は評価しない。オブジェクトリテラルの `expression` は文字列リテラルに限り、値は読み飛ばす。`line()` 直下に `expression` を書くことはできない (`by` の中に書く)。この解決は `line()` 呼び出しが `figure()`・`narration()` の呼び出しの中に入れ子になっていても変わらない (静的解析は `line()` 呼び出しを AST 全体から探す)。
- `characters/<name>.ts` は Node で import できる純粋な値のモジュールとし、remotion や CSS を import しない。

## Consequences

### 利点

- 音声・字幕・口・表情の時刻がすべて `narration()` の解決した `at` から派生し、発話の位置を変えても同期が崩れない。
- キャラクターを増やしても `narration()` は 1 つのままで、`after` の連鎖と暗がりの統合が話者をまたいで効く。
- 口パク・目パチ・表情の判定は秒を受ける純粋関数で、render を回さずに表で検証できる。
- 表情の追加は `expressions` に項目を足すだけで、コードを変えない。
- サムネイル (`thumbnail()`) も同じ `expressions` から静止した絵 (開眼・無音の口) を引く。立ち絵の素材が一系統になり、サムネイル用の PNG を別に用意しない。

### 代償

- effects の公開 API が 1 つ増え、`Stage` にフレームを読む分岐が 1 つ増える。
- `narration()` の戻り値は塊 (`GroupNode`) に `speech` を加えたオブジェクトになり、timeline.ts では `cut(n, { at })`・`fade(n, { at, in, out })` で置く ([ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md))。
- 汗と教える、涙と腕組みのような組み合わせは、その分の表情を `expressions` に書き足す。組み合わせの数だけ項目が増える。
- 立ち絵の表示区間は `figure()` の括り単位で決まり、行 1 本だけを一時的に隠す等の細かい制御はできない (括り自体を分ける必要がある)。
- watcher が `line()` の `by` を辿る分、静的評価の規則が増える。`characters/<name>.ts` の `voice` を変えても timeline.ts が変わらないと watcher は再生成しないため、`characters/` も監視対象にする。
- 素材の切り出しはテンプレートの外の作業で、PSD のレイヤー構成ごとに手順が変わる。

### 禁止事項

- src/components が口パクデータや表情名を知ること (母音と口の対応・表情の解決は src/compositions に置く)。
- `figureNode()` 以外の要素が `sample()` の時刻から動画のドメインの判断をすること。
- 音声キャッシュの key に `by`・`expression` を含めること。
- `characters/<name>.ts` が remotion・CSS・src/components を import すること。

## Assumptions

| 前提                                                                                     | 状態   | 確認方法 / 結果                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 口パクデータの区間 (50〜150 ms) を 30fps に量子化しても口パクとして成立する              | 検証済 | 2026-09-09 にサンプルの発話を frame 243〜300 で書き出し、a・i・u・e・o と閉口、cl の維持が意図どおりに出ることを目視で確認した |
| 表情ごとに 6〜7 枚の `Img` を毎フレーム重ねても render の時間が問題にならない            | 未検証 | サンプル project を `npm run render` して render 時間を比べる                                                                  |
| `Sequence` の開始フレームの丸め (最大 1/60 秒) と wav の実尺とのずれは口パクに影響しない | 検証済 | 生成スクリプトの warn (1/fps 超) で検知する。2026-09-09 のサンプル 3 本で最大 44 ms                                            |

## References

- [ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md): `narration()`・`figure()` を塊 (group) の仕組みに合わせて拡張した決定 (`narration()` が塊を返す、`figure()` が発話の括りを返し立ち絵の item を自動で組み立てる)。
- 立ち絵の目パチ・口パクの実装の依頼 (issue、2026-09-07 起票、2026-09-08 改稿): 立ち絵を timeline に置き、manifest でパーツを重ね、目パチは周期指定、口パクは音声キャッシュの母音区間から口パーツを引く。
- 立ち絵の素材規約の依頼 (issue、2026-09-01 起票): パーツ PNG と manifest で特定ツールに依存しない規約にする。全パーツを同一キャンバスで書き出せば座標計算が不要になる。
- ユーザとの設計議論 (2026-09-09): フレーム依存の描画を effects の時刻関数で行う案、`narration()` が発話メタを返す案、キャラクターを参照で結び付ける案、表情を発話の `expression` と item の分割で切り替える案に合意した。表情のプリセットは汗・涙・号泣・教える・腕組みを初期値とする。
- PoC (2026-09-09): `sample()` と `figure()` で口パク・目パチが動くことを静止画で確認した。
- Remotion の CSS アニメーションが使えない理由: https://www.remotion.dev/docs/troubleshooting/css-animations
