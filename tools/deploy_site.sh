#!/usr/bin/env bash
# Webseite (site/) und Downloads (Windows: dist/*.exe, Linux: AppImage und .tar.gz) nach
# https://pueski.de/spaceboss/ bringen.
#
#   tools/deploy_site.sh
#
# Braucht den SSH-Zugang "pueski" (~/.ssh/config). Caddy liefert /var/www/spaceboss-web unter /spaceboss/ aus,
# das Browser-Spiel läuft unter /spaceboss/play/ im Container. Die Downloads werden nur hochgeladen, wenn
# sie sich geändert haben (Vergleich per SHA-256). Steht die Prüfsumme einer Datei nicht in site/index.html,
# bricht das Skript vorher ab – sonst zeigt die Seite falsche Prüfsummen an.
set -euo pipefail
HOST=${HOST:-pueski}
DEST=${DEST:-/var/www/spaceboss-web}
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
files=("dist/Spaceboss-Setup-$version.exe" "dist/Spaceboss-$version-portable.exe"
       "dist/Spaceboss-$version.AppImage" "dist/Spaceboss-$version-linux.tar.gz")
for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "fehlt: $f (erst npm run dist bzw. npm run dist:linux)"; exit 1; }
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  grep -q "$sum" site/index.html || { echo "Prüfsumme von $f steht nicht in site/index.html: $sum"; exit 1; }
done

echo "Seite nach $HOST:$DEST"
ssh "$HOST" "mkdir -p $DEST/downloads"
tar czf - -C site --exclude=shots . | ssh "$HOST" "tar xzf - --no-same-owner -C $DEST"

for f in "${files[@]}"; do
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
