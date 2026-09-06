#!/usr/bin/env bash
set -euo pipefail

# 使い方: scripts/make-proxy.sh <入力ファイル>...
# 各入力を public/proxies/<basename>.mp4 へ変換する。
# NVENC (WSL) を優先し、失敗したら libx264 にフォールバックする。
# フレームレートは環境変数 PROXY_FPS で指定できる (既定 30)。

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/make-proxy.sh <入力ファイル>..." >&2
  exit 1
fi

proxy_fps="${PROXY_FPS:-30}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
out_dir="${repo_root}/public/proxies"

# 出力先は basename (拡張子除く) だけで決まるため、拡張子違いの重複入力が
# あると後勝ちで上書きしてしまう。事前に検出して拒否する。
declare -A seen_names
for in_file in "$@"; do
  base_name="$(basename "${in_file}")"
  name="${base_name%.*}"

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

  echo "encode: ${in_file} -> ${out_file} (nvenc)"
  if env LD_LIBRARY_PATH=/usr/lib/wsl/lib ffmpeg -y -hwaccel cuda -i "${in_file}" \
    -r "${proxy_fps}" -c:v h264_nvenc -preset p4 -cq 23 -g "${proxy_fps}" \
    -c:a aac -b:a 128k -movflags +faststart "${tmp_file}"; then
    mv -f "${tmp_file}" "${out_file}"
    tmp_file=""
    continue
  fi

  echo "nvenc に失敗したため libx264 で再試行します: ${in_file}"
  ffmpeg -y -i "${in_file}" \
    -r "${proxy_fps}" -c:v libx264 -preset veryfast -crf 22 -g "${proxy_fps}" \
    -c:a aac -b:a 128k -movflags +faststart "${tmp_file}"
  mv -f "${tmp_file}" "${out_file}"
  tmp_file=""
done
