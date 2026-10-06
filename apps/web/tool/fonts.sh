#!/usr/bin/env bash
# Trims Roboto Flex to the axis ranges the site uses and writes app/fonts/.
# @fontsource-variable/roboto-flex's "standard" files carry weight 100–1000,
# width 25–151% and slant; the site draws weight 400 (font-normal) to 860
# (font-display-xl) at width 100–135% and never slants, which more than halves
# the latin file. Keep the ranges in step with app.css (`font-expressive`,
# `font-display-xl`) and the @font-face rules there.
#
# Needs fontTools: `pip install fonttools brotli`. Run from the repo root:
#   apps/web/tool/fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."

src=node_modules/@fontsource-variable/roboto-flex/files
out=app/fonts
mkdir -p "$out"

for subset in latin latin-ext cyrillic cyrillic-ext greek vietnamese; do
  fonttools varLib.instancer -q \
    "$src/roboto-flex-$subset-standard-normal.woff2" \
    wght=400:900 wdth=100:135 slnt=0 \
    -o "$out/roboto-flex-$subset.woff2"
done
ls -l "$out"
