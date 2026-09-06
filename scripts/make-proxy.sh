#!/usr/bin/env bash
set -euo pipefail

# 使い方: scripts/make-proxy.sh <slug> <入力ファイル>...
# 各入力を public/projects/<slug>/<basename>.mp4 へ変換する (ADR-0003)。
# フレームレートは projects/<slug>/timeline.json の meta.fps に合わせる (無ければ 30)。
# 起動時に nvenc が使えるかを確認し、使えなければ libx264 を使う。nvenc が使える場合でも、
# あるファイルの変換に失敗したときはそのファイルだけ libx264 で再試行する。

if [ "$#" -lt 2 ]; then
  echo "usage: scripts/make-proxy.sh <slug> <入力ファイル>..." >&2
  exit 1
fi

slug="$1"
shift

# slug は ADR-0002 の形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case) に限る。
if ! [[ "${slug}" =~ ^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "error: slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: ${slug}" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null; then
  echo "error: ffmpeg が必要です" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
timeline_file="${repo_root}/projects/${slug}/timeline.json"
out_dir="${repo_root}/public/projects/${slug}"

# 変換に入る前に、出力先が未生成の入力ファイルが読めることを確認する。
# 出力が既に存在する入力はプロキシ生成済みで原本が未マウントの場合があるため確認をスキップする。
for in_file in "$@"; do
  base_name="$(basename "${in_file}")"
  out_file="${out_dir}/${base_name%.*}.mp4"

  if [ -e "${out_file}" ]; then
    continue
  fi

  if [ ! -r "${in_file}" ]; then
    echo "error: 入力ファイルが読めません: ${in_file}" >&2
    exit 1
  fi
done

# WSL で NVENC を使うための LD_LIBRARY_PATH。既存の値を上書きせず前に足す。
nvenc_env_ld="/usr/lib/wsl/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

# fps は composition (timeline の meta.fps) に合わせる。無ければ schema の既定値 30 を使う。
proxy_fps="30"
if [ -f "${timeline_file}" ]; then
  if ! command -v jq >/dev/null; then
    echo "error: jq が必要です (projects/${slug}/timeline.json の meta.fps を読むため)" >&2
    exit 1
  fi
  fps_value="$(jq -r '.meta.fps // empty' "${timeline_file}")"
  if [ -n "${fps_value}" ]; then
    proxy_fps="${fps_value}"
  else
    echo "warn: ${timeline_file} に meta.fps が無いため fps=30 を使います" >&2
  fi
else
  echo "warn: ${timeline_file} が無いため fps=30 を使います" >&2
fi

if ! [[ "${proxy_fps}" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "error: meta.fps が数値ではありません: ${proxy_fps}" >&2
  exit 1
fi

# ffmpeg の -g は整数しか受けないため、fps を四捨五入した値を GOP 長 (1 秒ごとのキーフレーム) にする。
gop="$(printf '%.0f' "${proxy_fps}")"

# fps が 0 または 0.x だと gop が 0 になり、ffmpeg の -g に渡せない。
if [ "${gop}" -lt 1 ]; then
  echo "error: meta.fps が不正です (正の数で、丸めた値が 1 以上): ${proxy_fps}" >&2
  exit 1
fi

# nvenc が使えるかを起動時に 1 回だけプローブし、以降の変換はプローブ結果の encoder で統一する。
# プローブは本番と同じ encoder オプションで打つ。64x64 のような小さいフレームは
# 最小フレームサイズ未満で失敗し、GOP を 1 にすると B フレーム数の制約で失敗するため、
# 本番と同じ fps・GOP の 1 秒のテスト映像を使う。
encoder="nvenc"
if ! env LD_LIBRARY_PATH="${nvenc_env_ld}" ffmpeg -v error -f lavfi -i "testsrc=duration=1:size=320x240:rate=${proxy_fps}" \
  -r "${proxy_fps}" -c:v h264_nvenc -pix_fmt yuv420p -preset p4 -cq 23 -g "${gop}" -f null -; then
  encoder="libx264"
  echo "warn: nvenc が使えないため libx264 で変換します" >&2
fi

# 出力先は basename (拡張子除く) だけで決まるため、拡張子違いの重複入力が
# あると後勝ちで上書きしてしまう。事前に検出して拒否する。
declare -A seen_names
for in_file in "$@"; do
  base_name="$(basename "${in_file}")"
  name="${base_name%.*}"

  if [ -z "${name}" ]; then
    echo "error: ファイル名が拡張子だけです: ${in_file}" >&2
    exit 1
  fi

  if [ -n "${seen_names[${name}]:-}" ]; then
    echo "error: 出力先 (${name}.mp4) が重複しています: ${seen_names[${name}]} と ${in_file}" >&2
    exit 1
  fi
  seen_names[${name}]="${in_file}"
done

mkdir -p "${out_dir}"

# 変換途中で失敗・中断した場合に不完全な出力ファイルが残らないよう、
# 一時ファイルへ書いてから成功時のみ mv で確定する。
tmp_file=""
cleanup() {
  if [ -n "${tmp_file}" ]; then
    rm -f "${tmp_file}"
  fi
}
trap cleanup EXIT

for in_file in "$@"; do
  base_name="$(basename "${in_file}")"
  out_file="${out_dir}/${base_name%.*}.mp4"

  if [ -e "${out_file}" ]; then
    echo "skip: ${out_file} は既に存在します"
    continue
  fi

  # 拡張子が .tmp のままだと ffmpeg が出力 muxer を推定できず失敗するため、
  # 拡張子は .mp4 のまま隠しファイル名で一時出力する。
  tmp_file="${out_dir}/.tmp.${base_name%.*}.mp4"

  echo "encode: ${in_file} -> ${out_file} (${encoder}, fps=${proxy_fps})"
  used_encoder="${encoder}"
  if [ "${encoder}" = "nvenc" ]; then
    if ! env LD_LIBRARY_PATH="${nvenc_env_ld}" ffmpeg -y -hwaccel cuda -i "${in_file}" \
      -r "${proxy_fps}" -c:v h264_nvenc -pix_fmt yuv420p -preset p4 -cq 23 -g "${gop}" \
      -c:a aac -b:a 128k -movflags +faststart "${tmp_file}"; then
      echo "warn: nvenc に失敗したため libx264 で再試行します: ${in_file}" >&2
      ffmpeg -y -i "${in_file}" \
        -r "${proxy_fps}" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 -g "${gop}" \
        -c:a aac -b:a 128k -movflags +faststart "${tmp_file}"
      used_encoder="libx264"
      # 一度失敗した nvenc を残りのファイルでも試すと同じ失敗を繰り返すだけなので、
      # 以降は最初から libx264 を使う。
      encoder="libx264"
      echo "warn: 以降のファイルは libx264 で変換します" >&2
    fi
  else
    ffmpeg -y -i "${in_file}" \
      -r "${proxy_fps}" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 -g "${gop}" \
      -c:a aac -b:a 128k -movflags +faststart "${tmp_file}"
  fi
  mv -f "${tmp_file}" "${out_file}"
  echo "done: ${out_file} (${used_encoder})"
  tmp_file=""
done
