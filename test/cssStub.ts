/**
 * `deno test` で CSS Modules (`*.module.css`) の代わりに読ませるスタブ。
 *
 * Deno は CSS を import できないため、root の `deno.json` の `imports` で
 * 各 `./modules/<dir>/<Name>.module.css` をこのモジュールへ差し替える
 * (ADR-0017)。クラス名を引くと、そのキー名をそのまま返す。
 */
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_target, key) => String(key),
});

export default styles;
