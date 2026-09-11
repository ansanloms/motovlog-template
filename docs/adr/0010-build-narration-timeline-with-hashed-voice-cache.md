---
status: accepted
date: 2026-09-08T13:45:25Z
refs: [2, 4, 6, 8, 9, 11]
tags: [voicevox, narration, timeline]
---

# ADR-0010: 発話を narration() で timeline に組み立て、音声は text と voice の hash をキーにしたキャッシュとして開発時に生成する

## Context

モトブログのセリフ (発話) を projects/<slug>/timeline.ts にどう書き、字幕・下部の暗がり・セリフ音声をどう組み立てるかを決める。[ADR-0006](./0006-write-timeline-as-effects-dsl.md) は演出の DSL (timeline・fade・cut) を決めたが、字幕・音声・暗がりの演出は対象外としていた。[ADR-0008](./0008-generate-voice-and-lipsync-from-voicevox-api.md) は VOICEVOX ENGINE の API から音声と口パクデータを生成する方法を決めたが、生成物 (wav・データ) を timeline.ts へどう載せるかは決めないとしていた。

2026-09-08 の設計議論でこれらの決め残しを検討した。要点は次のとおり。

- 発話には字幕・下部の暗がり・音声の 3 要素が伴うが、暗がりの出入りのタイミング (T&M「字幕の出し方」節) は発話の並びから機械的に導けるため、書き手が個別に書く必要はない。
- 音声は VOICEVOX ENGINE への HTTP 呼び出しを要し、ブラウザ (Remotion Studio・render worker) から直接呼ぶと worker ごとに再生成が走り、`public/` 配下への書き込みもできない。
- timeline.ts は CSS modules を import するコンポーネントを経由するため、Node でそのまま実行できない。Node のスクリプトが読むには静的に評価するしかなく、そこに書ける式には制約がある。

## Decision Drivers

1. 書き手は発話ごとにセリフ (text) と、必要なら声質の差分 (voice) だけを書けばよく、暗がりの出入りを個別に計算しない。
2. 音声生成は VOICEVOX ENGINE への呼び出しを伴うため、ブラウザ (Studio・render worker) では行わない。
3. セリフを直しても、コマンドの手動実行を挟まずに音声が追従する。
4. 生成物 (wav・データ) はコミットしない ([ADR-0002](./0002-project-directory-layout.md))。

## Considered Options

1. text と voice からキーを作り、`public/projects/<slug>/lines/<key>.{wav,json}` をキャッシュとして開発時に生成する — 採用。同じセリフ・声質なら key が変わらず、再生成が要らない。
2. 台本の sidecar JSON (音声のパス・尺・読み等) をコミットし、timeline.ts が import する — 却下。生成物をコミットすることになり、`npm run voice` のような手動生成の手順が要る。
3. スクリプトが timeline.ts 自体を書き換えて音声のパス・尺を埋め込む — 却下。timeline.ts が生成物になり、手書きの内容と生成された内容が同じファイルに混ざる。
4. ブラウザ (Studio・render worker) から VOICEVOX ENGINE を直接呼ぶ — 却下。worker ごとに再生成が走り、結果を `public/` に書き戻せない。
5. voice にプリセット名 (例: `"calm"`) を持たせ、theme がプリセットの語彙を持つ — 却下。theme が声質のバリエーションの語彙を持つことになる。書き手が自前で `const calm = { ...narrator, speed: 0.9 }` を持てば足りる。

## Decision

- 字幕と音声を重ねる `Line` (字幕 + `@remotion/media` の `Audio`) は src/components に置く。
- `line()` と `narration()` は src/compositions に置く。理由: effects と components の両方を import できる層である。
- `narration()` は暗がり layer と発話 layer の 2 つを `layers` に、発話ごとの実測値 (絶対開始秒・実尺・口パクデータ) を `speech` に入れて返す ([ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md))。書き手は暗がりを書かない。
- `narration()` に渡した `line()` 以外の item (字幕だけの `cut()` 等) も暗がりの区間に数える。
- `cut()` の `duration` を省いた item は `narration()` だけが受け取れる。
- `after` は前の発話の音声の終わりからの間隔 (秒) を表す。
- 字幕の尺は `min(音声の実尺 + tail, 次の発話の開始 − 自分の開始)` とする (最後の発話は前者のまま)。`duration` を明示した `line()` の item は例外で、tail もクランプも掛けず、位置決めと字幕の尺の両方にその値を使う。
- 暗がりは、次の発話が音声終了から `silenceGap` 以内なら出したまま。超えるなら字幕消灯 (通常は音声終了 + `tail`) 直後から `fadeOut` で消し、次の発話の `leadIn` 前から出し直す。最後の発話も同じ (`bandTiming`、[ADR-0004](./0004-define-tone-and-manner.md))。
- 音声キャッシュの key は、theme の `narrator` (既定の話者と声質) で正規化した声質 8 値 (speaker・speed・pitch・intonation・volume・pause・silenceBefore・silenceAfter) と text の SHA-256 とする。
- キャッシュは `public/projects/<slug>/lines/<key>.{wav,json}` に置き、コミットしない ([ADR-0002](./0002-project-directory-layout.md))。
- 生成は `npm run dev` の watcher と `npm run render` の前段が行い、どちらも `tsx scripts/voice.ts` を呼ぶ。生成だけを行う npm script は公開しない。
- watcher は `projects/<slug>/` と `characters/` の変更を監視する ([ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md))。
- watcher は timeline.ts を静的に評価する。`text`・`voice` に書ける式は次に限り、それ以外 (関数呼び出し・条件式・置換ありテンプレート等) は timeline.ts 内の位置付きエラーにする。
  - `text`: 文字列リテラルまたは置換無しテンプレートリテラル。
  - `voice`: リテラル・オブジェクトリテラル (spread を含む)・同じファイルの top-level const・import の binding・プロパティアクセス。
- 既定の話者と声質 8 値は theme の `narrator` に置く。
- VOICEVOX ENGINE の URL は `.env` (`VOICEVOX_URL`) に置く。
- `narration()` の slug は省略可で、既定は `resolveProjectSlug(process.env.REMOTION_PROJECT)` の解決 (Root.tsx と同じ、`DEFAULT_PROJECT` に落ちる) とする。明示した `slug` はこの既定を上書きする。
- timeline.ts は `...(await narration([...]))` の top-level await で音声キャッシュを待つ。`timeline()` 自体は同期のままとする。
- Studio では音声キャッシュが無いとき最大 30 秒待つ。render と、Studio でも rendering でもない環境 (plain Node) では待たずに即エラーにする。
- `narration()` の item の `at` は秒の数値に限る。[ADR-0009](./0009-add-transition-frame-and-anchor-to-timeline.md) のアンカーは下の layer の解決結果を要するため、`narration()` の中では使えない。

## Consequences

### 利点

- 書き手はセリフと声質の差分だけを書けばよく、暗がりの出入りと字幕の尺を個別に計算しない。
- セリフ・声質が同じなら key が変わらず、`npm run dev` の watcher は既存のキャッシュを再利用して再生成しない。
- 音声生成が Node 側 (watcher・render 前段) に閉じ、ブラウザ (Studio・render worker) は ENGINE を知らない。

### 代償

- 古い key のキャッシュ (セリフ・声質を変えて使われなくなったもの) は自動で消えず溜まる。掃除の方法は未決。
- `text`・`voice` の書き方に制約がある (リテラル・評価器が読める式に限る)。
- `npm run dev` の watcher が監視するのは `projects/<slug>/` と `characters/` だけである。起動中に theme の `narrator` (import 先のモジュール) を書き換えても、Node の ESM モジュールキャッシュにより watcher の再生成には反映されず、`npm run dev` の再起動が要る。
- project の選択は `REMOTION_PROJECT` で行う ([ADR-0006](./0006-write-timeline-as-effects-dsl.md))。composition の props で slug を上書きすると `narration()` の読み先と食い違う。

### 禁止事項

- 発話の暗がりを書き手が個別の layer として書くこと。
- ブラウザ (Studio・render worker) から VOICEVOX ENGINE を直接呼ぶこと。
- 音声キャッシュ (wav・json) をコミットすること。

## Assumptions

| 前提                                                                               | 状態   | 確認方法 / 結果                                                              |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| 暗がりの統合閾値 (silenceGap) が実際の台本で不自然な出入りを起こさない             | 未検証 | 実際の動画 1 本分の発話で暗がりの出入りを目視する                            |
| Studio の 30 秒待ちが、実際のセリフ数・長さの watcher の生成時間に対して十分足りる | 未検証 | 発話が多い project で `npm run dev` を起動し、待ちが打ち切られないか確認する |
| 古い key のキャッシュを掃除しなくても、開発機のディスク容量を圧迫しない            | 未検証 | project を継続して編集し、`public/projects/<slug>/lines/` の増加量を確認する |

## References

- 設計議論 (2026-09-08): issue #60 の未決事項 (字幕・暗がり・音声の timeline.ts への載せ方) をここで決めた
- 設計議論 (2026-09-09): 暗がりの統合の閾値を silenceGap にすることで合意した。理由: timeline は先まで分かっており、次の発話が来ないと分かっている無音で暗がりを保持する意味が無い
- https://github.com/VOICEVOX/voicevox_engine : VOICEVOX ENGINE
