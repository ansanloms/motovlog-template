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
              group: ["**/timeline/**"],
              message: "components は timeline を import しない。",
            },
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
];
