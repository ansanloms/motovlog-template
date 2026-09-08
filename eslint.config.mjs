import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "日付と時間は Temporal を使う (ADR-0009)。" },
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
];
