import { config } from "@remotion/eslint-config-flat";
import fs from "node:fs";
import pkg from "./package.json" with { type: "json" };

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

/**
 * 見た目のコンポーネント (src/components/**・modules/**) に共通の patterns。
 * timeline の配線 (effects・compositions) と remotion のフレーム API・媒体要素
 * を持たない。
 */
const componentPatterns = [
  {
    group: ["@remotion/*", "!@remotion/media"],
    message:
      "components は @remotion/media 以外の @remotion のパッケージを import しない。",
  },
  {
    group: ["**/effects/**"],
    message: "components は effects を import しない。",
  },
];

/** 見た目のコンポーネントに共通の paths (remotion から import できる名前)。 */
const componentPaths = [
  {
    name: "remotion",
    allowImportNames: [
      "AbsoluteFill",
      "Img",
      "useVideoConfig",
      "useRemotionEnvironment",
    ],
    message:
      "components は remotion の AbsoluteFill・Img・useVideoConfig・useRemotionEnvironment と @remotion/media 以外を import しない (useCurrentFrame 等のフレーム API・レンダリング制御を持たない)。",
  },
];

/**
 * modules/ 直下の module 名 (ADR-0016)。module ごとに「他の module を import
 * しない」設定ブロックを作るため、設定の読み込み時にディレクトリを列挙する。
 */
const MODULE_NAMES = fs
  .readdirSync(new URL("./modules/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/**
 * module ごとの設定ブロック (ADR-0016)。modules/<name>/<file> は
 * src/components/** と同じ規則に加え、compositions と、modules/core 以外の
 * 他の module を import しない (modules/core は他の module を一切 import
 * しない)。
 *
 * module の中は 1 階層 (modules/<name>/<file>) を前提にし、利用側へ戻る up は
 * "../../"、他の module は "../<other>" で判定する。module の中に
 * サブディレクトリを足したら、そこにも対応する patterns を足すこと。
 */
const MODULE_BLOCKS = MODULE_NAMES.map((name) => {
  const others = MODULE_NAMES.filter(
    (other) => other !== name && (name === "core" || other !== "core"),
  );

  return {
    files: [`modules/${name}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...noConsumerImports("../../"),
            ...componentPatterns,
            {
              group: ["**/compositions/**"],
              message: "modules は compositions を import しない (ADR-0016)。",
            },
            {
              // src/components/index.tsx は全 module の要素ファクトリを
              // 再 export するため、経由すると他の module の import 禁止を
              // すり抜け、循環 import にもなる。
              group: ["**/src/components/index.tsx"],
              message:
                "modules は src/components/index.tsx (全 module の再 export) を import しない (ADR-0016)。",
            },
            ...(others.length === 0
              ? []
              : [
                  {
                    group: others.flatMap((other) => [
                      `../${other}`,
                      `../${other}/**`,
                      `**/modules/${other}`,
                      `**/modules/${other}/**`,
                    ]),
                    message:
                      name === "core"
                        ? "modules/core は他の module を import しない (ADR-0016)。"
                        : "modules/<name> が import してよい他の module は modules/core だけ (ADR-0016)。",
                  },
                ]),
          ],
          paths: componentPaths,
        },
      ],
    },
  };
});

export default [
  ...config,
  {
    // bin ラッパー (プレーンな .mjs、ADR-0012) は tseslint.configs.eslintRecommended
    // の no-undef 除外 (**/*.ts 等の TypeScript ファイルだけが対象) に乗らない
    // ため、使っている Node のグローバルをここで宣言する。
    files: ["scripts/bin/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", URL: "readonly" },
    },
  },
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
    // API・媒体要素は持たない。modules/** にも同じ規則を課す (下の
    // MODULE_BLOCKS、ADR-0016)。
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...noConsumerImports("../../"), ...componentPatterns],
          paths: componentPaths,
        },
      ],
    },
  },
  ...MODULE_BLOCKS,
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
            {
              // effects が読んでよい module は共有部品の modules/core だけ
              // (Stage が fadeGain の context を置くため、ADR-0016)。
              group: [
                "**/modules/**",
                "!**/modules/core/",
                "!**/modules/core/**",
              ],
              message:
                "effects が import してよい module は modules/core だけ (ADR-0016)。",
            },
          ],
        },
      ],
    },
  },
  {
    // 利用側 (app・theme・projects) は lib の公開面 (package.json の exports と
    // 同じ 5 入口と modules/<name>/index.ts) だけを見る (ADR-0012・ADR-0016)。characters/** の制限は下のブロックに
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
            {
              // src と同じく gitignore 構文。module のディレクトリを戻して
              // から中身を入れ直し、入口の index.ts だけを許す。
              group: [
                "**/modules/**",
                "!**/modules/*/",
                "**/modules/*/*",
                "!**/modules/*/index.ts",
                // bare specifier の公開経路 (exports の "./modules/*") は許す。
                `!${pkg.name}/modules/*`,
              ],
              message:
                "利用側が import してよい module のファイルは modules/<name>/index.ts だけ (ADR-0016)。",
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
              // specifier (motovlog) は、figure()・line() 経由で
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
                pkg.name,
                `${pkg.name}/*`,
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
              group: ["**/modules/**"],
              message:
                "characters/<name>.ts は modules を import しない (ADR-0011・ADR-0016)。",
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
