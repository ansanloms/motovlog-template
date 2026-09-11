# CLAUDE.md (motovlog-template)

## skill の導入

`.claude/skills/` 配下の skill は apm (Agent Package Manager) で導入する。依存は `apm.yml` に書き、`apm install` で `.claude/skills/` へ配置する。`apm.yml`・`apm.lock.yaml`・`.claude/skills/` はコミットし、`apm_modules/` はコミットしない。

- skill の追加は `apm.yml` に依存を書いて `apm install` を実行する。ref を固定していない依存 (`ansanloms/skills` 配下) の更新は `apm update` で行う。`apm install` は `apm.lock.yaml` に固定された commit を再配置するだけで、更新はしない。`.claude/skills/` 配下を直接編集しない。
- `remotion-dev/skills` は commit SHA で固定する。固定先は、その commit の `skills/remotion-docs/SKILL.md` の `version` が、インストール済みの Remotion (`package.json` の `remotion`) と一致する commit にする。
- Remotion をバージョンアップしたら、`remotion-dev/skills` の履歴から対応する commit を探して `apm.yml` の SHA を更新し、`apm install` を実行する。`remotion upgrade` はこの skill を更新しない。理由: 更新判定が `.agents/skills/` を対象にしており、このリポジトリの配置先 `.claude/skills/` を見ないため。
- `npx skills` や `remotion skills` (npm の skills CLI) で skill を追加・更新しない。理由: apm の管理外で `.claude/skills/` を書き換え、`apm.lock.yaml` のハッシュと乖離して `apm install --frozen` が通らなくなる。同梱の `remotion-upgrade` skill は `@remotion/cli` が無い環境の代替手順として `npx skills update` を案内するが、この手順は使わない。
- Dependabot (`.github/dependabot.yml`) は `remotion` と `@remotion/*` を `ignore` で対象外にしている。理由: Remotion の更新には上記の `apm.yml` の SHA 更新と `apm install` が伴い、Dependabot はそれを行えないため。`ignore` は security update にも効くため、Remotion の脆弱性修正も Dependabot の PR は作られない。Remotion は `npm run upgrade` と apm の手順で手動更新する。

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

## シェルスクリプト

`scripts/` 配下のシェルスクリプトは `shellcheck` を通し、指摘 0 件にしてからコミットする。
