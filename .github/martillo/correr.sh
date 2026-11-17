#!/bin/bash
# usage: correr.sh <musica|musica-t|sin|gancho> <runs>
set -euo pipefail
variante=$1
runs=$2
dir=$(cd "$(dirname "$0")" && pwd)
bin=$(mktemp -d)
log=$(mktemp)
real=$(command -v ffmpeg)
printf '#!/bin/bash\nprintf "%%q " "$@" >> %s; echo >> %s\nexec %s "$@"\n' "$log" "$log" "$real" > "$bin/ffmpeg"
chmod +x "$bin/ffmpeg"

modo=${variante%-t}
PATH="$bin:$PATH" node --import tsx "$dir/una-vez.mts" "$modo"
linea=$(mktemp)
tail -1 "$log" > "$linea"
if [ "$variante" = "musica-t" ]; then
  sed -i 's/-stream_loop -1 -i/-stream_loop -1 -t 6.000 -i/' "$linea"
  grep -q -- "-stream_loop -1 -t 6.000 -i" "$linea"
fi
echo "ffmpeg $(cat "$linea")"
node "$dir/martillo.mjs" "$variante" "$linea" "$runs" 45
