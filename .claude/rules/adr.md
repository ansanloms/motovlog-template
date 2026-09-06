# ADR

設計上の決定を ADR (Architecture Decision Record) として `docs/adr/` に記録する運用のルール。閾値の定義・配置・採番・書式・status の遷移・遡及起票・検証の具体手順は `adr` skill に委譲し、本ルールは「いつ書くか」「どの工程で書くか」「他の記録との関係」を定める。運用自体の決定は ADR-0000 (`docs/adr/0000-record-architecture-decisions.md`) にある。

## 原則

- MUST: `adr` skill の閾値に当たる決定は、実装に入る前に ADR を起票し、`accepted` にしてから実装する。
- MUST: 閾値に当たるかどうか判断できない決定は、起票せずユーザに確認する。
- MUST: 合意済み・実装済みの決定を後から記録するときは skill の「遡及起票」に従う。出典は References に日付と内容の要約で残す。URL を書くのは、このリポジトリの外にあり誰でも開ける文書 (公式ドキュメント等) に限る。
- MUST: References にこのリポジトリの issue・PR の URL と、claude.ai 等の会話の URL を書かない。理由: issue・PR はリポジトリを移行・削除すると解決できず、issue 側から ADR を参照する運用と循環する。会話のリンクは本人にしか開けない。
- 決定の正本は ADR とする。issue・PR に決定を書くときは ADR の起票または更新を伴わせ、issue・PR からは ADR のパスを参照する。理由: issue・PR はリポジトリの移行先へ引き継げない。

## 工程との関係

- MUST: 計画 (dev-workflow ルールの工程 3) に、閾値の判定結果を 1 行書く。当たるなら ADR の起票を計画の変更内容に含め、ADR の `accepted` への遷移は計画の承認 (工程 4) と同時に取る。
- ADR の推敲は skill の「推敲」節に従い ja-tech-proofread を当てる。
- ADR の検証 (skill の「検証」節) の結果は報告に含める。
