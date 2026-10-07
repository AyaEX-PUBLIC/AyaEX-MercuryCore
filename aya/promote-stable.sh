#!/usr/bin/env bash
# Snapshot an Aya WebAssembly runtime build as the "stable" client channel.
#
#   aya/promote-stable.sh [SOURCE_DIR]   copy SOURCE_DIR (default: the dev
#                                        channel, AYA_APP_DIST_DIR) to stable
#   aya/promote-stable.sh --list         list kept releases
#   aya/promote-stable.sh --use VERSION  point stable at a kept release
#
# Releases live in data/runtime/releases/<runtime version>; data/runtime/stable
# is a relative symlink that Caddy serves (Caddyfile.aya). Switching it is
# atomic, so players on stable never see a partially copied build. The newest
# KEEP releases (default 3) are kept, plus whichever one stable points at.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME="$ROOT/data/runtime"
RELEASES="$RUNTIME/releases"
KEEP="${KEEP:-3}"
# the files Caddyfile.aya serves from /runtime
FILES=(Aya.App.html Aya.App.js Aya.App.wasm Aya.App.data Aya.App.Brand.png
	Aya.GameWebRtc.js Aya.App.StreamingFrame.js Aya.Diagnostics.js)

die() { echo "promote-stable: $*" >&2; exit 1; }

point_stable() {
	ln -sfn "releases/$1" "$RUNTIME/stable.tmp"
	mv -Tf "$RUNTIME/stable.tmp" "$RUNTIME/stable"
	echo "stable -> $1"
}

current() { basename "$(readlink "$RUNTIME/stable" 2>/dev/null)" 2>/dev/null || true; }

mkdir -p "$RELEASES"

case "${1:-}" in
--list)
	cur="$(current)"
	for d in $(ls -1t "$RELEASES"); do
		mark=" "; [[ $d == "$cur" ]] && mark="*"
		echo "$mark $d  $(date -r "$RELEASES/$d/Aya.App.wasm" '+%F %T')"
	done
	exit 0
	;;
--use)
	[[ -n "${2:-}" && -d "$RELEASES/$2" ]] || die "no release '${2:-}' (see --list)"
	point_stable "$2"
	exit 0
	;;
-*) die "unknown option $1" ;;
esac

SRC="${1:-${AYA_APP_DIST_DIR:-$ROOT/../aya-dev/build/wasm-app-rel/bin}}"
SRC="$(cd "$SRC" && pwd)" || die "no such directory: $SRC"

# a build in progress rewrites these files; snapshot only a finished build
if pgrep -f '(^|/)build_app_wasm\.sh' >/dev/null; then
	die "a wasm build is running; promote after it finishes"
fi
for f in "${FILES[@]}"; do
	[[ -s "$SRC/$f" ]] || die "$SRC/$f is missing or empty (failed build?)"
done
[[ "$(head -c 4 "$SRC/Aya.App.wasm" | od -An -tx1 | tr -d ' ')" == 0061736d ]] ||
	die "$SRC/Aya.App.wasm is not a WebAssembly module"
version="$(grep -m1 -o 'const runtimeVersion = "[0-9a-f]*"' "$SRC/Aya.App.html" |
	grep -o '[0-9a-f]\{8,\}')" || die "no runtimeVersion in Aya.App.html"

if [[ -d "$RELEASES/$version" ]]; then
	echo "release $version already kept"
else
	tmp="$RELEASES/.incoming-$version"
	rm -rf "$tmp"
	mkdir -p "$tmp"
	for f in "${FILES[@]}"; do cp -p "$SRC/$f" "$tmp/"; done
	# a build may have finished writing between the checks and the copy
	for f in "${FILES[@]}"; do
		cmp -s "$SRC/$f" "$tmp/$f" || { rm -rf "$tmp"; die "$f changed while copying; retry"; }
	done
	mv -T "$tmp" "$RELEASES/$version"
	echo "copied $SRC -> releases/$version"
fi
point_stable "$version"

cur="$(current)"
ls -1t "$RELEASES" | tail -n +"$((KEEP + 1))" | while read -r old; do
	[[ $old == "$cur" ]] && continue
	rm -rf "${RELEASES:?}/$old"
	echo "removed old release $old"
done
