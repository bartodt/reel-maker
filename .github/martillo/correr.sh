#!/bin/bash
# usage: correr.sh <variant from variante.mjs> <runs>
set -euo pipefail
variante=$1
runs=$2
dir=$(cd "$(dirname "$0")" && pwd)
bin=$(mktemp -d)
log=$(mktemp)
real=$(command -v ffmpeg)
printf '#!/bin/bash\nprintf "%%q " "$@" >> %s; echo >> %s\nexec %s "$@"\n' "$log" "$log" "$real" > "$bin/ffmpeg"
chmod +x "$bin/ffmpeg"

for intento in 1 2 3; do
  : > "$log"
  if PATH="$bin:$PATH" timeout 120 node --import tsx "$dir/una-vez.mts" musica; then break; fi
  echo "setup render attempt $intento did not finish"
  [ "$intento" = 3 ] && exit 1
done
linea=$(mktemp)
tail -1 "$log" > "$linea"
node "$dir/variante.mjs" "$variante" "$linea"
echo "ffmpeg $(cat "$linea")"
node "$dir/martillo.mjs" "$variante" "$linea" "$runs" 30
