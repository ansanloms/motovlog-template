# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## プロキシ生成

ドラレコ原本 (HEVC) は Remotion に直接読ませず、H.264 のプロキシに変換して使う ([ADR-0003](docs/adr/0003-convert-dashcam-footage-to-h264-proxy.md))。

    scripts/make-proxy.sh <slug> <入力ファイル>...

または `npm run proxy -- <slug> <入力ファイル>...`。`npm run` はリポジトリルートを cwd にして実行するため、入力ファイルは絶対パスで渡す。

- 出力先は `public/projects/<slug>/<basename>.mp4` ([ADR-0002](docs/adr/0002-project-directory-layout.md))。既に存在するファイルはスキップする。
- `<slug>` は `YYYYMMDD-<name>` (ASCII 小文字の kebab-case)。形式が違うとエラーになる。
- フレームレートは `projects/<slug>/timeline.json` の `meta.fps` に合わせる。ファイルか値が無いときは 30 を使う。GOP 長は fps と同じ (1 秒ごとにキーフレーム)。`meta.fps` の読み取りに jq を使う。
- 起動時に NVENC が使えるかを確認し、使えなければ libx264 を使う。NVENC が使える場合でも、あるファイルの変換に失敗したときはそのファイルだけ libx264 で再試行する。一度 libx264 に落ちたら以降のファイルも libx264 で変換する。WSL で NVENC を使うために `LD_LIBRARY_PATH=/usr/lib/wsl/lib` をスクリプト内で設定している。
- 拡張子違いで同じ basename になる入力 (例: `clip.mov` と `clip.mp4`) を同時に渡すとエラーになる。
