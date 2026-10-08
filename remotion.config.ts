/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import fs from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

// 入口は利用側の app/index.ts (ADR-0012)。既定の探索先 (src/index.ts) は lib の
// root export で registerRoot() を呼ばないため、明示する。
Config.setEntryPoint("./app/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setRspack(true);
Config.setPublicLicenseKey("free-license");

// modules/<name> は Deno の workspace の member で、src/ と member 同士は
// @motovlog/<name> の名前で import する (ADR-0015・ADR-0016)。Deno は名前を
// workspace から解決するが、Remotion のバンドラ (Rspack) は node_modules を
// 探すため見つけられず、deno install も member を node_modules へリンクしない。
// そこで名前ごとに member の入口 (modules/<name>/index.ts) への alias を足す。
// overrideBundlerConfig は Webpack・Rspack のどちらを選んでも効く共通の
// override (Config.setRspack(true) では overrideWebpackConfig は呼ばれない)。
// member の一覧は deno.json の workspace ("./modules/*") と同じく
// modules/ 直下の deno.json を持つディレクトリから作り、名前は各 deno.json の
// name を使う。末尾の $ は名前と完全一致する import だけを対象にする指定
// (member の入口は index.ts だけ)。
const modulesDir = path.join(process.cwd(), "modules");
const memberAliases = Object.fromEntries(
  fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(modulesDir, entry.name, "deno.json"))
    )
    .map((entry) => {
      const dir = path.join(modulesDir, entry.name);
      const { name } = JSON.parse(
        fs.readFileSync(path.join(dir, "deno.json"), "utf-8"),
      ) as { name: string };

      return [`${name}$`, path.join(dir, "index.ts")];
    }),
);

Config.overrideBundlerConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      ...memberAliases,
    },
  },
}));
