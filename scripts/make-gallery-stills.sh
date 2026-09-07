#!/bin/sh
# Gallery (コンポーネント単体の確認用 composition) が使う写真素材を、
# サンプル project のドラレコ原本から静止画で切り出す。
# 出力はコミットしない (public/assets/ は .gitignore で除外済み)。
# リポジトリ直下から実行する: sh scripts/make-gallery-stills.sh
set -eu

input="public/projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4"
outdir="public/assets/samples"

mkdir -p "$outdir"

# -ss を -i より前に置く (入力が 7.9GB の HEVC のため、先頭から読ませない)。
# -update 1 は単一画像出力であることを明示し、image2 muxer の警告を防ぐ。
ffmpeg -y -ss 0 -i "$input" -frames:v 1 -q:v 2 -update 1 "$outdir/still-01.jpg"
ffmpeg -y -ss 34 -i "$input" -frames:v 1 -q:v 2 -update 1 "$outdir/still-02.jpg"
ffmpeg -y -ss 60 -i "$input" -frames:v 1 -q:v 2 -update 1 "$outdir/still-03.jpg"

# 縦写真の正方形トリミング確認用 (1920x1080 の中央 608x1080 を crop)。
ffmpeg -y -ss 34 -i "$input" -frames:v 1 -q:v 2 -update 1 \
  -vf "crop=608:1080:(in_w-608)/2:0" "$outdir/portrait-01.jpg"
