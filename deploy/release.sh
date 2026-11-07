#!/usr/bin/env bash
# Makes a production release: a version of everything deploy/deploy.sh sends
# to the VPS, which only ever runs releases. Versions are YEAR.MONTH.N, N
# counting from 0 each month (2026.10.0, 2026.10.1, 2026.11.0).
#
#   deploy/release.sh             the next version for this month
#   deploy/release.sh 2026.10.0   that version
#   deploy/release.sh --replace 2026.10.0
#                                 make that version again from what's here now
#                                 (moving its tags), while nobody outside has it
#
# - tags the last commit of MercuryCore, MercuryRCC and aya-dev with the
#   version, and pushes the tags
# - copies what isn't in git into RELEASES/<version> (RELEASES in
#   deploy/vps.env, ../mercury-releases by default): the engine build
#   (Aya.Server and its files, the WebAssembly build, client resources, assets,
#   the console clients in data/downloads), this machine's settings
#   (mercury.core.ts and the .env files) and the gameserver image. Files an
#   earlier release already has are hard links to it, so a release only takes
#   the space of what changed.
#
# Otherwise a release never changes afterwards. Deploy it with
# deploy/deploy.sh VERSION.
set -euo pipefail
CORE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(dirname "$CORE")"
RCC="$WORKSPACE/MercuryRCC"
AYA="$WORKSPACE/aya-dev"

# shellcheck source=vps.env.example
source "$CORE/deploy/vps.env"
RELEASES="${RELEASES:-$WORKSPACE/mercury-releases}"
repos=("$CORE" "$RCC" "$AYA")

replace=0
if [[ "${1:-}" == --replace ]]; then
	replace=1
	shift
	: "${1:?--replace needs the version to make again}"
fi
version="${1:-}"
if [[ -z "$version" ]]; then
	month="$(date +%Y).$(date +%-m)"
	last="$(git -C "$CORE" tag -l "$month.*" | sed "s/^$month\.//" | { grep -E '^[0-9]+$' || true; } | sort -n | tail -1)"
	version="$month.$((${last:--1} + 1))"
fi
if ! [[ "$version" =~ ^[0-9]{4}\.(1[0-2]|[1-9])\.(0|[1-9][0-9]*)$ ]]; then
	echo "not a version: $version (YEAR.MONTH.N, like 2026.10.0)" >&2
	exit 1
fi
rel="$RELEASES/$version"
if ((!replace)); then
	if [[ -e "$rel" ]]; then
		echo "release $version already exists: $rel (--replace to make it again)" >&2
		exit 1
	fi
	for repo in "${repos[@]}"; do
		if git -C "$repo" rev-parse -q --verify "refs/tags/$version" >/dev/null; then
			echo "$(basename "$repo") already has a tag $version" >&2
			exit 1
		fi
	done
fi

echo "release $version$( ((replace)) && echo " (made again)")"
for repo in "${repos[@]}"; do
	if [[ -n "$(git -C "$repo" status --porcelain --untracked-files=no -- . ':!mercury.core.ts')" ]]; then
		echo "note: $(basename "$repo") has uncommitted changes; only its last commit is tagged"
	fi
	echo "  $(basename "$repo") $(git -C "$repo" rev-parse --short HEAD) $(git -C "$repo" log -1 --format=%s)"
done

image="$({ grep -E '^GAMESERVER_IMAGE=' "$RCC/Proxy/.env" || true; } | tail -1 | cut -d= -f2-)"
image="${image:-mercury-gameserver}"
# the console clients offered on /download (Site lib/server/downloads.ts), as
# this machine's site offers them: the builds put there by hand, since they
# come from their own branch
consoleClients=()
for client in Aya.Switch.nro AyaEX.wuhb; do
	if [[ -f "$CORE/data/downloads/$client" ]]; then
		consoleClients+=("$CORE/data/downloads/$client")
	fi
done

# Built up beside the releases, so a release that failed half way never looks
# like one
mkdir -p "$RELEASES"
tmp="$(mktemp -d "$RELEASES/.$version.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
# hard links to the release this one replaces, or else the newest
if [[ -f "$rel/RELEASE" ]]; then
	prev="$version"
else
	prev="$(find "$RELEASES" -mindepth 2 -maxdepth 2 -name RELEASE -printf '%h\n' | xargs -rn1 basename | sort -V | tail -1)"
fi
link=()
nrolink=()
if [[ -n "$prev" ]]; then
	link=(--link-dest="$RELEASES/$prev/aya-dev")
	nrolink=(--link-dest="$RELEASES/$prev")
fi

echo "copying the engine build"
bin="$AYA/./build/x64-linux-rel/bin"
rsync -aR "${link[@]}" "$bin/Aya.Server" "$bin/libfmod.so" "$bin/libfmod.so.13" "$bin/ClientSettings.json" \
	"$bin/shaders" "$bin/platform" "$AYA/./client/resources" "$AYA/./build/wasm-app-rel/bin" "$AYA/./assets" \
	"$tmp/aya-dev/"
if ((${#consoleClients[@]})); then
	rsync -a "${nrolink[@]}" "${consoleClients[@]}" "$tmp/"
fi

echo "copying the settings"
mkdir -m 700 "$tmp/config"
install -m 600 "$CORE/mercury.core.ts" "$tmp/config/mercury.core.ts"
install -m 600 "$CORE/Site/.env" "$tmp/config/Site.env"
install -m 600 "$RCC/Proxy/.env" "$tmp/config/Proxy.env"
install -m 600 "$RCC/Orbiter/.env" "$tmp/config/Orbiter.env"

echo "saving the gameserver image ($image)"
docker save "$image" | gzip -1 >"$tmp/gameserver.tar.gz"

{
	echo "version=$version"
	echo "date=$(date -Iseconds)"
	for repo in "${repos[@]}"; do
		echo "$(basename "$repo")=$(git -C "$repo" rev-parse HEAD)"
	done
	echo "gameserver=$(docker image inspect -f '{{.Id}}' "$image")"
} >"$tmp/RELEASE"
old=""
if [[ -e "$rel" ]]; then
	old="$RELEASES/.$version.replaced"
	rm -rf "$old"
	mv "$rel" "$old"
fi
mv "$tmp" "$rel"
trap - EXIT
# du counts a hard-linked file once, under the first directory it's given
base=()
if [[ -n "$old" ]]; then
	base=("$old")
elif [[ -n "$prev" ]]; then
	base=("$RELEASES/$prev")
fi
size="$(du -sh "${base[@]}" "$rel" | tail -1 | cut -f1)"
if [[ -n "$old" ]]; then
	rm -rf "$old"
fi

force=()
if ((replace)); then
	force=(--force)
fi
for repo in "${repos[@]}"; do
	git -C "$repo" tag -a "${force[@]}" "$version" -m "AyaEX $version"
	if ! git -C "$repo" push -q "${force[@]}" origin "refs/tags/$version"; then
		echo "warning: couldn't push the tag to $(basename "$repo")'s origin; push it later with" >&2
		echo "  git -C $repo push ${force[*]} origin $version" >&2
	fi
done
echo "release $version: $rel ($size new)"
echo "deploy it with: deploy/deploy.sh $version"
