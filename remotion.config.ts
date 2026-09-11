/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// 入口は利用側の app/index.ts (ADR-0012)。既定の探索先 (src/index.ts) は lib の
// root export で registerRoot() を呼ばないため、明示する。
Config.setEntryPoint("./app/index.ts");
Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
