#!/usr/bin/env bash
# Webseite (site/) und Windows-Downloads (dist/*.exe) nach https://pueski.de/spaceboss/ bringen.
#
#   tools/deploy_site.sh
#
# Braucht den SSH-Zugang "pueski" (~/.ssh/config). Caddy liefert /var/www/spaceboss-web unter /spaceboss/ aus,
# das Browser-Spiel läuft unter /spaceboss/play/ im Container. Die .exe werden nur hochgeladen, wenn sie
# sich geändert haben (Vergleich per SHA-256).
set -euo pipefail
HOST=${HOST:-pueski}
DEST=${DEST:-/var/www/spaceboss-web}
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
echo "Seite nach $HOST:$DEST"
ssh "$HOST" "mkdir -p $DEST/downloads"
tar czf - -C site --exclude=shots . | ssh "$HOST" "tar xzf - --no-same-owner -C $DEST"

for f in "dist/Spaceboss-Setup-$version.exe" "dist/Spaceboss-$version-portable.exe"; do
  [ -f "$f" ] || { echo "fehlt: $f (erst npm run dist)"; exit 1; }
  name=$(basename "$f")
  local_sum=$(sha256sum "$f" | cut -d' ' -f1)
  remote_sum=$(ssh "$HOST" "sha256sum $DEST/downloads/$name 2>/dev/null | cut -d' ' -f1" || true)
  if [ "$local_sum" = "$remote_sum" ]; then echo "unverändert: $name"; continue; fi
  echo "lade hoch: $name"
  scp -q "$f" "$HOST:$DEST/downloads/$name.part"
  ssh "$HOST" "mv $DEST/downloads/$name.part $DEST/downloads/$name"
done
ssh "$HOST" "find $DEST -type d -exec chmod 755 {} + && find $DEST -type f -exec chmod 644 {} +"
echo "fertig: https://pueski.de/spaceboss/"
