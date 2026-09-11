import { config } from "@remotion/eslint-config-flat";

/**
 * lib (src/) が利用側 (app/・theme/・projects/・characters/) を静的に import
 * することを禁じる patterns (ADR-0012 の禁止事項)。利用側の値は configure()
 * (src/setup.ts) で受け取る。
 *
 * app・projects・characters は lib に同名のディレクトリが無いため名前で判定
 * できる (lib の project は単数形)。theme だけは lib にも src/theme があり、
 * 同じ `../theme/...` の見た目になるため、src から出る `../` の数で判定する。
 * up はそのファイルからリポジトリのルートへ戻る `../` の並びで、src 直下の
 * ファイルなら "../"、src の 1 段下なら "../../"。
 *
 * この検査は import 文の文字列の前方一致で、規約の正本は ADR-0012。次の 2 点で
 * 近似であることを承知の上で使う。
 *
 * - 深さごとにブロックを列挙する (下の SRC_DEPTHS)。src に列挙より深い階層を
 *   足したら、そこにも対応するブロックを足すこと。
 * - 正規形で書かれた相対パスだけを見る (`./../theme/...` のような書き方は
 *   抜ける)。prettier と既存の書き方が正規形なので、実務上はこれで足りる。
 */
const noConsumerImports = (up) => [
  {
    group: ["**/app/**", "**/projects/**", "**/characters/**"],
    message:
      "lib (src/) は利用側 (app/・projects/・characters/) を静的に import しない (ADR-0012)。値は configure() で受け取る。",
  },
  {
    group: [`${up}theme`, `${up}theme/**`],
    message:
      "lib (src/) は利用側の theme/ を静的に import しない (ADR-0012)。値は configure() で受け取る。lib の見た目トークンは src/theme/。",
  },
];

/**
 * src 直下から数えた階層の深さごとの設定ブロック。深さ n のファイル
 * (src/<n-1 段のディレクトリ>/<file>) はルートへ "../" を n 個で戻る。
 * src/components・src/effects は下に個別のブロックを持つため、そちらにも同じ
 * patterns を混ぜてある (flat config は同じ rule を後のブロックが置き換える)。
 */
const SRC_DEPTHS = [1, 2, 3].map((depth) => {
  const dirs = "*/".repeat(depth - 1);

  return {
    files: [`src/${dirs}*.ts`, `src/${dirs}*.tsx`],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: noConsumerImports("../".repeat(depth)) },
      ],
    },
  };
});

export default [
  ...config,
  {
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "日付と時間は Temporal を使う (ADR-0007)。" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/^\\.\\.?(\\/|$)/][source.value!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
        {
          selector:
            "ImportExpression > Literal[value=/^\\.\\.?(\\/|$)/][value!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
        {
          selector:
            "TSImportType > TSLiteralType > Literal[value=/^\\.\\.?(\\/|$)/][value!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
        {
          selector:
            "ImportExpression > TemplateLiteral[quasis.0.value.raw=/^\\.\\.?\\//] > TemplateElement:last-child[value.raw!=/\\.[A-Za-z0-9]+$/]",
          message:
            "相対 import / export には実体の拡張子 (.ts / .tsx / .module.css / .json) を付ける。",
        },
      ],
    },
  },
  ...SRC_DEPTHS,
  {
    // components は見た目だけを描く。timeline の配線と remotion のフレーム
    // API・媒体要素は持たない。
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noConsumerImports("../../"),
            {
              group: ["@remotion/*", "!@remotion/media"],
              message:
                "components は @remotion/media 以外の @remotion のパッケージを import しない。",
            },
            {
              group: ["**/effects/**"],
              message: "components は effects を import しない。",
            },
          ],
          paths: [
            {
              name: "remotion",
              allowImportNames: ["AbsoluteFill", "Img", "useVideoConfig"],
              message:
                "components は remotion の AbsoluteFill・Img・useVideoConfig と @remotion/media 以外を import しない (useCurrentFrame 等のフレーム API・レンダリング制御を持たない)。",
            },
          ],
        },
      ],
    },
  },
  {
    // effects は演出の術だけを持つ。動画のドメイン (章・写真・ED 等) は知らない。
    files: ["src/effects/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noConsumerImports("../../"),
            {
              group: [
                "**/components/**",
                "**/projects/**",
                "**/compositions/**",
              ],
              message:
                "effects は動画の型 (components・compositions・projects) を知らない。",
            },
          ],
        },
      ],
    },
  },
  {
    // 利用側 (app・theme・projects) は lib の公開面 (package.json の exports と
    // 同じ 5 入口) だけを見る (ADR-0012)。characters/** の制限は下のブロックに
    // まとめて書く (flat config は同じ rule を後のブロックが置き換えるため)。
    files: ["app/**", "theme/**", "projects/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                // gitignore 構文。"**/src/**" は src の下のディレクトリごと
                // 除外するため、"!**/src/*/" で中間ディレクトリを戻してから
                // でないと下の否定が効かない。
                "**/src/**",
                "!**/src/*/",
                "!**/src/index.ts",
                "!**/src/effects/index.ts",
                "!**/src/components/index.tsx",
                "!**/src/compositions/index.ts",
                "!**/src/theme/index.ts",
              ],
              message:
                "利用側は lib の 5 入口 (src/index.ts・src/effects/index.ts・src/components/index.tsx・src/compositions/index.ts・src/theme/index.ts) だけを import する (ADR-0012)。",
            },
          ],
        },
      ],
    },
  },
  {
    // characters/<name>.ts は Node からそのまま import できる純粋な値の
    // モジュールに保つ (remotion・CSS・src/components を import しない。
    // watcher (scripts/voice/extract.ts) が line().by から voice だけを
    // 読むため、ADR-0011)。
    files: ["characters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // characters/<name>.ts が lib から import してよいのは
              // src/compositions/character.ts だけ (ADR-0011・ADR-0012)。
              // 5 入口 (src/index.ts・src/compositions/index.ts 等) と bare
              // specifier (motovlog-template) は、figure()・line() 経由で
              // src/components と CSS Modules を辿るため素の Node から
              // import できなくなり、watcher (scripts/voice/extract.ts) が
              // line().by の voice を読めなくなる。
              //
              // gitignore 構文。"**/src/**" は compositions ディレクトリごと
              // 除外するため、"!**/src/compositions/" で戻し、
              // "**/src/compositions/*" で中身を入れ直してから character.ts
              // だけを許す。
              group: [
                "**/src/**",
                "!**/src/compositions/",
                "**/src/compositions/*",
                "!**/src/compositions/character.ts",
                "motovlog-template",
                "motovlog-template/*",
              ],
              message:
                "characters/<name>.ts が lib から import してよいのは src/compositions/character.ts だけ (ADR-0011・ADR-0012)。入口 (src/compositions/index.ts 等) は CSS Modules を辿るため、素の Node から読めなくなる。",
            },
            {
              group: ["remotion", "@remotion/*"],
              message:
                "characters/<name>.ts は remotion を import しない (ADR-0011)。",
            },
            {
              group: ["**/components/**"],
              message:
                "characters/<name>.ts は src/components を import しない (ADR-0011)。",
            },
            {
              group: ["**/effects/**"],
              message:
                "characters/<name>.ts は src/effects を import しない (ADR-0011)。",
            },
            {
              group: ["*.css", "**/*.module.css"],
              message:
                "characters/<name>.ts は CSS を import しない (ADR-0011)。",
            },
          ],
        },
      ],
    },
  },
];
