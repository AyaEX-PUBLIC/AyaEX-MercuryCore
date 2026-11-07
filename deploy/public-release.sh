#!/usr/bin/env bash
# Packs the prebuilt AyaEX builds for a public release of AyaEX-PUBLIC/AyaEX
# (the client's source isn't public, only these builds):
#
#   deploy/public-release.sh [--release VERSION] [TAG]
#
# - AyaEX-Web-TAG.tar.gz: the WebAssembly app (Player, Studio, browser-hosted
#   server), as the stable client channel serves it (data/runtime/stable)
# - AyaEX-Server-linux-x64-TAG.tar.gz: Aya.Server and the files it runs with,
#   the same set deploy/release.sh sends to the VPS
# - AyaEX-WiiU-TAG.wuhb and AyaEX-Switch-TAG.nro: the console apps offered on
#   /download (data/downloads)
# - SHA256SUMS and BUILD.txt (where each file came from)
#
# Both archives unpack into an aya-dev/ folder laid out like the client's build
# tree, which MercuryCore and MercuryRCC expect beside them. With --release,
# everything comes from that deploy/release.sh release instead, so the public
# builds are the ones the VPS runs (its web app is the dev build it was made
# from). TAG defaults to the release's version, or else today's date.
# Output goes to PUBLIC_RELEASES/TAG (../ayaex-public-releases by default);
# nothing is uploaded.
set -euo pipefail
CORE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(dirname "$CORE")"
AYA="$WORKSPACE/aya-dev"

release=""
if [[ "${1:-}" == --release ]]; then
	release="${2:?--release needs a version made by deploy/release.sh}"
	shift 2
fi
tag="${1:-${release:-$(date +%Y.%m.%d)}}"
if ! [[ "$tag" =~ ^[0-9A-Za-z][0-9A-Za-z._-]*$ ]]; then
	echo "not a tag: $tag" >&2
	exit 1
fi

if [[ -n "$release" ]]; then
	RELEASES="${RELEASES:-$WORKSPACE/mercury-releases}"
	if [[ -f "$CORE/deploy/vps.env" ]]; then
		RELEASES="$(set +u; source "$CORE/deploy/vps.env"; echo "${RELEASES:-$WORKSPACE/mercury-releases}")"
	fi
	rel="$RELEASES/$release"
	[[ -f "$rel/RELEASE" ]] || { echo "no release $release in $RELEASES" >&2; exit 1; }
	engine="$rel/aya-dev"
	web="$rel/aya-dev/build/wasm-app-rel/bin"
	consoles="$rel"
	weblabel="the release's dev build"
	from="release $release ($(grep -E '^aya-dev=' "$rel/RELEASE" | cut -d= -f2 | cut -c1-8))"
else
	engine="$AYA"
	[[ -e "$CORE/data/runtime/stable" ]] || { echo "no stable client in $CORE/data/runtime (aya/promote-stable.sh)" >&2; exit 1; }
	web="$(readlink -f "$CORE/data/runtime/stable")"
	consoles="$CORE/data/downloads"
	weblabel="stable runtime $(basename "$web")"
	from="this machine: aya-dev $(git -C "$AYA" rev-parse --short=8 HEAD) ($(git -C "$AYA" branch --show-current)), stable runtime $(basename "$web")"
fi
bin="$engine/build/x64-linux-rel/bin"
for f in "$bin/Aya.Server" "$bin/libfmod.so" "$bin/libfmod.so.13" "$bin/ClientSettings.json" "$bin/shaders" "$bin/platform" \
	"$engine/client/resources" "$web/Aya.App.html" "$web/Aya.App.wasm"; do
	[[ -e "$f" ]] || { echo "missing: $f" >&2; exit 1; }
done
# the console apps, published as AyaEX-<name>-TAG.<ext>; a release made before
# an app was offered on /download goes out without it
declare -A apps=([WiiU]=AyaEX.wuhb [Switch]=Aya.Switch.nro)

OUT="${PUBLIC_RELEASES:-$WORKSPACE/ayaex-public-releases}/$tag"
if [[ -e "$OUT" ]]; then
	echo "$OUT already exists" >&2
	exit 1
fi
mkdir -p "$(dirname "$OUT")"
tmp="$(mktemp -d "$(dirname "$OUT")/.$tag.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
echo "AyaEX public release $tag from $from"

# stage the aya-dev/ tree with links, not copies
stage="$tmp/stage"
mkdir -p "$stage/web/aya-dev/build/wasm-app-rel" "$stage/server/aya-dev/build/x64-linux-rel/bin" "$stage/server/aya-dev/client"
ln -s "$web" "$stage/web/aya-dev/build/wasm-app-rel/bin"
for f in Aya.Server libfmod.so libfmod.so.13 ClientSettings.json shaders platform; do
	ln -s "$bin/$f" "$stage/server/aya-dev/build/x64-linux-rel/bin/$f"
done
ln -s "$engine/client/resources" "$stage/server/aya-dev/client/resources"

pack() { # name, staged dir
	# --dereference follows the staging links (the build trees have no
	# symlinks of their own)
	nice -n 19 tar --create --dereference --sort=name --owner=0 --group=0 --numeric-owner \
		--exclude='*.symbols' -C "$2" aya-dev | nice -n 19 gzip -6 >"$tmp/$1"
	echo "  $1 ($(du -h "$tmp/$1" | cut -f1))"
}
pack "AyaEX-Web-$tag.tar.gz" "$stage/web"
pack "AyaEX-Server-linux-x64-$tag.tar.gz" "$stage/server"
rm -rf "$stage"
{
	echo "AyaEX $tag"
	echo "made $(date -Iseconds) from $from"
	echo "web: $weblabel"
	echo "server: Aya.Server $(date -r "$bin/Aya.Server" -Iseconds)"
} >"$tmp/BUILD.txt"
for app in WiiU Switch; do
	src="$consoles/${apps[$app]}"
	if [[ -f "$src" ]]; then
		cp "$src" "$tmp/AyaEX-$app-$tag.${src##*.}"
		echo "  AyaEX-$app-$tag.${src##*.}"
		echo "$app: ${apps[$app]} $(date -r "$src" -Iseconds)" >>"$tmp/BUILD.txt"
	else
		echo "  no $app app (${apps[$app]}) in $consoles: left out"
	fi
done
(cd "$tmp" && sha256sum AyaEX-* >SHA256SUMS)
mv "$tmp" "$OUT"
trap - EXIT
chmod 755 "$OUT"
echo "release files: $OUT"
