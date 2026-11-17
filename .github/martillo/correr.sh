#!/bin/bash
# usage: correr.sh <musica|musica-sin-t|sin|gancho> <runs>
set -euo pipefail
variante=$1
runs=$2
dir=$(cd "$(dirname "$0")" && pwd)
bin=$(mktemp -d)
log=$(mktemp)
real=$(command -v ffmpeg)
printf '#!/bin/bash\nprintf "%%q " "$@" >> %s; echo >> %s\nexec %s "$@"\n' "$log" "$log" "$real" > "$bin/ffmpeg"
chmod +x "$bin/ffmpeg"

modo=${variante%-sin-t}
if ! PATH="$bin:$PATH" timeout 180 node --import tsx "$dir/una-vez.mts" "$modo"; then
  echo "the setup render itself did not finish"
  exit 1
fi
linea=$(mktemp)
tail -1 "$log" > "$linea"
case "$variante" in
  musica) grep -q -- "-stream_loop -1 -t 6.000 -i" "$linea" ;;
  musica-sin-t)
    sed -i -E 's/-stream_loop -1 -t [0-9.]+ -i/-stream_loop -1 -i/' "$linea"
    grep -q -- "-stream_loop -1 -i" "$linea"
    ;;
esac
echo "ffmpeg $(cat "$linea")"
node "$dir/martillo.mjs" "$variante" "$linea" "$runs" 30
