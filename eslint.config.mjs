import { config } from "@remotion/eslint-config-flat";

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
  {
    // components は見た目だけを描く。timeline の配線と remotion のフレーム
    // API・媒体要素は持たない。
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
              // 利用側の入口の制限 (ADR-0012)。characters/<name>.ts だけは
              // 入口の src/compositions/index.ts に代えて実体の
              // src/compositions/character.ts を import してよい。入口は
              // figure()・line() 経由で src/components と CSS Modules を辿り、
              // 素の Node から import できなくなるため (ADR-0011)。
              // gitignore 構文。"**/src/**" は src の下のディレクトリごと
              // 除外するため、"!**/src/*/" で中間ディレクトリを戻してから
              // でないと下の否定が効かない。
              group: [
                "**/src/**",
                "!**/src/*/",
                "!**/src/index.ts",
                "!**/src/effects/index.ts",
                "!**/src/components/index.tsx",
                "!**/src/compositions/index.ts",
                "!**/src/compositions/character.ts",
                "!**/src/theme/index.ts",
              ],
              message:
                "利用側は lib の 5 入口 (src/index.ts・src/effects/index.ts・src/components/index.tsx・src/compositions/index.ts・src/theme/index.ts) だけを import する。characters/<name>.ts は src/compositions/character.ts も直に import してよい (ADR-0011・ADR-0012)。",
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
