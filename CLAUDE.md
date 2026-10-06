# CLAUDE.md (motovlog-template)

## skill の導入

`.claude/skills/` 配下の skill は apm (Agent Package Manager) で導入する。依存は `apm.yml` に書き、`apm install` で `.claude/skills/` へ配置する。`apm.yml`・`apm.lock.yaml`・`.claude/skills/` はコミットし、`apm_modules/` はコミットしない。`apm_modules/` は同梱 skill の `.ts` を `tsc` が拾ってしまうため、`tsconfig.json` の `exclude` で型検査から外している。

- skill の追加は `apm.yml` に依存を書いて `apm install` を実行する。ref を固定していない依存 (`ansanloms/skills` 配下) の更新は `apm update` で行う。`apm install` は `apm.lock.yaml` に固定された commit を再配置するだけで、更新はしない。`.claude/skills/` 配下を直接編集しない。
- `remotion-dev/skills` は commit SHA で固定する。固定先は、その commit の `skills/remotion-docs/SKILL.md` の `version` が、インストール済みの Remotion (`package.json` の `remotion`) と一致する commit にする。
- Remotion をバージョンアップしたら `npm run upgrade` (`scripts/remotion-upgrade.sh`) を実行する。`npx remotion upgrade --skip-skills`、optional peer のバージョン揃え、`remotion-dev/skills` の対応 commit 探索、`apm.yml` の SHA 更新、`apm install`、lint・test・build をまとめて行う。`remotion upgrade` 単体はこの skill を更新しない。理由: 更新判定が `.agents/skills/` を対象にしており、このリポジトリの配置先 `.claude/skills/` を見ないため。GitHub Actions の `Remotion upgrade` workflow (`.github/workflows/remotion-upgrade.yml`、`workflow_dispatch`。版を指定しなければ最新) も同じスクリプトを実行し、差分があれば `chore/remotion-upgrade-<版>` ブランチで PR を作る。
- `npx skills` や `remotion skills` (npm の skills CLI) で skill を追加・更新しない。理由: apm の管理外で `.claude/skills/` を書き換え、`apm.lock.yaml` のハッシュと乖離して `apm install --frozen` が通らなくなる。同梱の `remotion-upgrade` skill は `@remotion/cli` が無い環境の代替手順として `npx skills update` を案内するが、この手順は使わない。
- Dependabot (`.github/dependabot.yml`) は `remotion` と `@remotion/*` を `ignore` で対象外にしている。理由: Remotion の更新には上記の `apm.yml` の SHA 更新と `apm install` が伴い、Dependabot はそれを行えないため。`ignore` は security update にも効くため、Remotion の脆弱性修正も Dependabot の PR は作られない。Remotion は `npm run upgrade` または `Remotion upgrade` workflow で更新する。
- `Remotion upgrade` workflow は apm-cli を 0.28.0 に固定して入れている。理由: 0.29.1 以降の退行 (microsoft/apm#2888) で skill 集リポジトリの `apm install` が失敗するため。修正を含むリリースが出たら固定を外す。
- Remotion 4.0.523 以降、`@remotion/studio` が optional peer (`@remotion/whisper-webgpu`・`@remotion/video-matting`) を無条件に import するため、これらを Remotion 本体と同じバージョンで `devDependencies` に置く。`npm run upgrade` (`scripts/remotion-upgrade.sh`) がこれらも同じバージョンに揃える。

## Remotion ドキュメントの参照

Remotion のライブラリ仕様 (API・設定・CLI) を調べるときは、このリポジトリに同梱されている `.claude/skills/remotion-docs` (または `remotion-best-practices` 経由) を使う。`remotion-docs` は Algolia 検索と remotion.dev への直接アクセスでドキュメントを取得する。

適用範囲: このリポジトリでの Remotion ライブラリ仕様の調査のみ。

理由は次の通り。

- `remotion-docs/SKILL.md` の `version` フィールドが、このリポジトリにインストールされている Remotion のバージョンと一致している。`apm.yml` で `remotion-dev/skills` を対応する commit に固定しているため。汎用の裏取り手段にはバージョン注記が付かないことがあり (2026-09-06 実測)、インストール済みバージョンとの対応がこちらの方が明確。
- remotion.dev を直接ソースとするため、ミラー経由より反映の遅延が小さい可能性がある (未検証)。

## Claude Design の同期

見た目の上流は Claude Design プロジェクト「バイク車載動画のトンマナ設計」(projectId `0ec23fff-b17a-430e-99c3-65f241225458`) にある。`車載画面サンプル.dc.html` が値の正 (冒頭で「記載の数値をそのまま実装値として使える」と宣言している)、`車載動画トンマナ.dc.html` が原則の正。

スナップショット (`docs/design/upstream/` に 2 ファイルをそのまま置く。`uploads/` の画像と `support.js`・`deck-stage.js` は置かない) の同期手順は次の通り。

1. 2 ファイルを取得して `docs/design/upstream/` を上書きする。取得は Claude Code の `DesignSync` ツール (`get_file`) か、Claude Design の UI からの書き出し。
2. `git diff docs/design/upstream/` を差分の一次資料にする。
3. 差分を `docs/design/tone-and-manner.md` と `theme/index.ts`・`src/theme/`・`src/components/` に反映する。`theme/designSnapshot.test.ts` の `pending` を更新する (反映した変数は外す)。
4. コミットは `docs: Claude Design YYYY-MM-DD 版を取り込む` で始め、反映は同じ PR に含めてよい。

優先順位の規則は次の通り。

- Claude Design のデザインは原則そのまま反映する。値は画面サンプル、原則は deck から取る。
- 画面サンプルと deck が食い違うときは画面サンプルを取り込み、deck の古い記述を同期の報告に一覧する。Claude Design 側の修正は人が行う。`DesignSync` の書き込みは design-system project 専用で、このプロジェクトには使えない。
- `pending` に残すのは反映できない変数だけ (サンプル内で矛盾している、リポジトリで使わない等)。理由を書く。
- `DesignSync` は subagent に渡らない。取得はメインセッションで行う。

Claude Code の `/design-sync` skill は、ローカルの React コンポーネント群を Claude Design の design-system プロジェクトへ push するもので、向きが逆 (ローカル → Claude Design) であり対象も design-system プロジェクトに限られる。このプロジェクト (通常プロジェクト、.dc.html のモック) の同期には使わない。

## modules/ の開発ツール

`modules/` の型検査・lint・整形・テストは `deno task check`・`deno task lint`・`deno task fmt` (`fmt:check`)・`deno task test` で行い、`npm run lint` も最後にこれらを呼ぶ ([ADR-0016](docs/adr/0016-use-deno-tooling-for-modules.md))。テストはリポジトリ全体 (`src/`・`modules/`・`scripts/`・`theme/` の `*.test.ts(x)`) を `deno test` で実行し、`@std/testing/bdd` と `@std/expect` (モックと偽の時計は `@std/testing/mock`・`@std/testing/time`) で書く ([ADR-0017](docs/adr/0017-unify-runtime-and-tooling-on-deno.md))。vitest は使わない。テストが読む CSS Modules は root の `deno.json` の `imports` で `test/cssStub.ts` に差し替えるため、CSS Modules を足したらその割り当ても足す。`configure()` や Temporal が要るテストは先頭で `test/setup.ts` を import する。root の `deno task test` は `test.include` の全テストを実行する。`modules/` は prettier ではなく `deno fmt` で整形する。`deno lint` は `recommended` タグと `jsr:@aireone/deno-lint-curly` (root の `deno.json` の `lint` に書き、member に継承される) で掛ける。ESLint (境界の規則) と `tsc` は `modules/` にもこれまでどおり掛かる。`modules/<name>/` は Deno の workspace の member で、依存は member の `deno.json` の `imports` に書き、root の `deno.json` には書かない。root の `imports` が持つのは、`modules/` 以外のテストが使う `@std/*` と CSS Modules のスタブの割り当てだけ。module を足すときは `deno.json` (`name`・`version`・`exports`・`imports`・`tasks` の `check`・`lint`・`fmt:check`・`test`) も置く。module 単位の検査は `cd modules/<name>` して `deno task check`・`deno task lint`・`deno task fmt:check`・`deno task test` で行い、root からは `check`・`lint`・`fmt:check` が `deno task --members` で全 module を回す。member 間の import は相対パスのまま書く。member の npm 依存は `package.json` と同じ exact 版で書く (`nodeModulesDir: "manual"` のため実体と食い違うと check が落ちる)。同期は Dependabot の multi-ecosystem group (react) と `npm run upgrade` (Remotion) が行う。`deno.lock` は使わない。jsr 依存の更新は `deno outdated -r --update`。Dependabot (`.github/dependabot.yml`) は `npm` と `deno` の entry を multi-ecosystem group (react) にまとめ、member の `deno.json` も見る (Remotion は npm 側と同じく対象外)。 CI は module ごとに matrix job (`modules`) で member の 4 つの task を実行し、lint job は Node 側 (`npm run lint:node`) だけを見る。

## シェルスクリプト

`scripts/` 配下のシェルスクリプトは `shellcheck` を通し、指摘 0 件にしてからコミットする。
