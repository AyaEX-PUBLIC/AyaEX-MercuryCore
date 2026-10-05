#!/usr/bin/env bash
# Populate data/ (gitignored) with the Aya loadscripts and render scripts and a
# script-signing key. Existing files are kept unless --force is given.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
force=0
[[ "${1:-}" == "--force" ]] && force=1

mkdir -p "$ROOT"/data/{assets,avatars,economy,icons,places,surreal,thumbnails}
while IFS= read -r -d '' src; do
	rel="${src#"$ROOT/aya/"}"
	dest="$ROOT/$rel"
	mkdir -p "$(dirname "$dest")"
	if [[ $force == 1 || ! -e "$dest" ]]; then
		cp "$src" "$dest"
		echo "installed $rel"
	fi
done < <(find "$ROOT/aya/data" -type f -print0)

if [[ ! -e "$ROOT/data/PrivateKey.pem" ]]; then
	openssl genrsa -out "$ROOT/data/PrivateKey.pem" 1024 2>/dev/null
	chmod 600 "$ROOT/data/PrivateKey.pem"
	echo "generated data/PrivateKey.pem"
fi
