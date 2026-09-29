import { config } from "@remotion/eslint-config-flat";

/** lib のパッケージ名。利用側は bare specifier でだけ lib を import する。 */
const LIB = "motovlog";

/**
 * 相対 import / export に拡張子が無いものを落とす no-restricted-syntax の
 * selector。
 */
const EXTENSION_MESSAGE =
  "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。";
const extensionSelectors = [
  "ImportDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
  "ExportNamedDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
  "ExportAllDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
  "ImportExpression > Literal[value=/^\\.\\.?(\\/|$)/][value!=/\\.[A-Za-z0-9]+$/]",
  "TSImportType > TSLiteralType > Literal[value=/^\\.\\.?(\\/|$)/][value!=/\\.[A-Za-z0-9]+$/]",
  "ImportExpression > TemplateLiteral[quasis.0.value.raw=/^\\.\\.?\\//] > TemplateElement:last-child[value.raw!=/\\.[A-Za-z0-9]+$/]",
].map((selector) => ({ selector, message: EXTENSION_MESSAGE }));

export default [
  ...config,
  {
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Date",
          message: "日付と時間は Temporal を使う (motovlog の ADR-0007)。",
        },
      ],
      "no-restricted-syntax": ["error", ...extensionSelectors],
    },
  },
  {
    // 利用側 (app・theme・projects) は lib の公開面 (package.json の exports)
    // だけを見る (motovlog の ADR-0012・ADR-0016)。characters/** の制限は下の
    // ブロックにまとめて書く (flat config は同じ rule を後のブロックが置き換える
    // ため)。
    files: ["app/**", "theme/**", "projects/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // gitignore 構文。"motovlog/**" で配下をすべて除外してから、
              // 公開面の入口だけを戻す。modules は "motovlog/modules/*/" で
              // ディレクトリを戻してから中身を入れ直し、1 段 (modules/<name>)
              // だけを許す。
              group: [
                `${LIB}/**`,
                `!${LIB}/effects`,
                `!${LIB}/components`,
                `!${LIB}/compositions`,
                `!${LIB}/theme`,
                `!${LIB}/modules/`,
                `${LIB}/modules/*/**`,
                `!${LIB}/modules/*`,
              ],
              message: `利用側は lib の公開面 (${LIB}・${LIB}/effects・${LIB}/components・${LIB}/compositions・${LIB}/theme・${LIB}/modules/<name>) だけを import する (motovlog の ADR-0012・ADR-0016)。`,
            },
          ],
        },
      ],
    },
  },
  {
    // characters/<name>.ts は Node からそのまま import できる純粋な値の
    // モジュールに保つ (remotion・CSS・lib の components を import しない。
    // lib の音声生成の watcher が line().by から voice だけを読むため、
    // motovlog の ADR-0011)。
    files: ["characters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // characters/<name>.ts が lib から import してよいのは
              // motovlog/compositions/character だけ (motovlog の ADR-0011・
              // ADR-0012)。他の入口は figure()・line() 経由で CSS Modules を
              // 辿るため素の Node から import できなくなり、watcher が
              // line().by の voice を読めなくなる。
              //
              // gitignore 構文。"motovlog/**" は compositions ディレクトリごと
              // 除外するため、"!motovlog/compositions/" で戻し、
              // "motovlog/compositions/*" で中身を入れ直してから character
              // だけを許す。
              //
              // bare の "motovlog" は下の paths で止める (group に "motovlog"
              // を書くと親ディレクトリの除外として扱われ、配下を戻せなくなる)。
              group: [
                `${LIB}/**`,
                `!${LIB}/compositions/`,
                `${LIB}/compositions/*`,
                `!${LIB}/compositions/character`,
              ],
              message: `characters/<name>.ts が lib から import してよいのは ${LIB}/compositions/character だけ (motovlog の ADR-0011・ADR-0012)。他の入口は CSS Modules を辿るため、素の Node から読めなくなる。`,
            },
            {
              group: ["remotion", "@remotion/*"],
              message:
                "characters/<name>.ts は remotion を import しない (motovlog の ADR-0011)。",
            },
            {
              group: ["*.css", "**/*.module.css"],
              message:
                "characters/<name>.ts は CSS を import しない (motovlog の ADR-0011)。",
            },
          ],
          paths: [
            {
              name: LIB,
              message: `characters/<name>.ts が lib から import してよいのは ${LIB}/compositions/character だけ (motovlog の ADR-0011・ADR-0012)。${LIB} は CSS Modules を辿るため、素の Node から読めなくなる。`,
            },
          ],
        },
      ],
    },
  },
];
