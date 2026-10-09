// .env はスクリプトの利用側のルート (cwd) にある想定 (ADR-0012)。Remotion CLI
// (npx remotion studio/render) は自前で .env を読むが、tsx で直接起動する
// スクリプト (scripts/voice.ts・scripts/convert-movie.ts 等) は読まないため、
// スクリプトの入口でこれを呼ぶ。

/** cwd の .env を process.env に読み込む。.env が無ければ何もしない。 */
export const loadDotEnv = (): void => {
  try {
    process.loadEnvFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      throw error;
    }
  }
};
