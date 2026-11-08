#!/bin/sh
# Link-preview images: a wide 3:1 band cut from each painting in public/thumbnails/.
# Run after adding a painting: sh scripts/og.sh  (needs ImageMagick). Output: public/og/<painting>.jpg
cd "$(dirname "$0")/../public" || exit 1
for f in thumbnails/*.jpg; do
  magick "$f" -resize 1200x -gravity center -crop 1200x400+0+0 +repage -quality 82 "og/$(basename "$f")"
done
