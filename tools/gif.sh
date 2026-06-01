#!/usr/bin/env bash
# Convert a captured screen recording (.webm or .mp4) into docs/gameplay.gif.
# Requires ffmpeg (https://ffmpeg.org). Works on macOS, Linux, and WSL/Git Bash.
#
# Usage:
#   ./tools/gif.sh recording.webm
#   ./tools/gif.sh recording.mp4 docs/gameplay.gif
#
# Produces a crisp, looping, reasonably small GIF using a two-pass palette.

set -euo pipefail

IN="${1:-recording.webm}"
OUT="${2:-docs/gameplay.gif}"
FPS=15
WIDTH=640

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg not found. Install it from https://ffmpeg.org/download.html" >&2
  exit 1
fi
if [ ! -f "$IN" ]; then
  echo "ERROR: input file '$IN' not found." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
PALETTE="$(mktemp -t palette.XXXXXX).png"

echo "Generating palette..."
ffmpeg -y -i "$IN" -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen" "$PALETTE"

echo "Encoding GIF -> $OUT ..."
ffmpeg -y -i "$IN" -i "$PALETTE" \
  -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse" \
  "$OUT"

rm -f "$PALETTE"
echo "Done: $OUT"
