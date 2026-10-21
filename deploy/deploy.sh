#!/usr/bin/env bash
# Deploy a production release (deploy/release.sh) of Mercury Core, the RCC
# services (../MercuryRCC) and the Aya engine files they use (../aya-dev) to a
# Debian 13 VPS, from this machine.
#
#   deploy/deploy.sh                 send the newest release, then rebuild and
#                                    restart
#   deploy/deploy.sh 2026.10.0       send that release (an older one rolls back)
#   deploy/deploy.sh --migrate-data  also replace the VPS's data with this
#                                    machine's (database, economy, places, ...)
#   deploy/deploy.sh --force         restart even if games are running
#
# Settings are in deploy/vps.env (see vps.env.example). The code sent is each
# repository's commit tagged with the version. The engine build, the
# gameserver image, mercury.core.ts and the .env files are the release's
# copies, with the domain switched to DOMAIN (aya/set-domain.sh).
set -euo pipefail
CORE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(dirname "$CORE")"
RCC="$WORKSPACE/MercuryRCC"

migrate=0
force=0
version=""
for arg in "$@"; do
	case "$arg" in
	--migrate-data) migrate=1 ;;
	--force) force=1 ;;
	[0-9]*) version="$arg" ;;
	*)
		echo "unknown option: $arg" >&2
		exit 1
		;;
	esac
done

# shellcheck source=vps.env.example
source "$CORE/deploy/vps.env"
: "${VPS:?set VPS in deploy/vps.env}" "${DOMAIN:?set DOMAIN}" "${TLS_CERT:?set TLS_CERT}" "${TLS_KEY:?set TLS_KEY}"
R="${REMOTE_ROOT:-/opt/mercury}"
RELEASES="${RELEASES:-$WORKSPACE/mercury-releases}"
if [[ -z "$version" ]]; then
	version="$({ find "$RELEASES" -mindepth 2 -maxdepth 2 -name RELEASE -printf '%h\n' 2>/dev/null || true; } | xargs -rn1 basename | sort -V | tail -1)"
	if [[ -z "$version" ]]; then
		echo "no releases in $RELEASES yet: make one with deploy/release.sh" >&2
		exit 1
	fi
fi
rel="$RELEASES/$version"
if [[ ! -f "$rel/RELEASE" ]]; then
	echo "no release $version in $RELEASES" >&2
	exit 1
fi
COMPOSE="docker compose -f compose.yml -f deploy/compose.vps.yml"
command -v go >/dev/null || PATH="/usr/local/go/bin:$PATH"

remote() { ssh -o BatchMode=yes "$VPS" "$@"; }
step() { printf '\n== %s\n' "$*"; }

# how many gameservers an Orbiter (on this machine or the VPS) is starting or running
games() {
	python3 -c '
import json, sys
try:
    servers = json.load(sys.stdin)
except ValueError:
    servers = []
print(sum(1 for _, s in servers if s.get("status") in (1, 2)))'
}

WORK="$(mktemp -d)"
local_stopped=0
cleanup() {
	# never leave this machine's database and economy stopped
	if ((local_stopped)); then
		(cd "$CORE" && docker compose start database economy >/dev/null && docker compose restart site >/dev/null)
	fi
	rm -rf "$WORK"
}
trap cleanup EXIT

current="$(remote "sed -n 's/^version=//p' $R/RELEASE 2>/dev/null" || true)"
step "staging release $version (the VPS runs ${current:-no release})"
for repo in MercuryCore MercuryRCC; do
	src="$WORKSPACE/$repo"
	commit="$(sed -n "s/^$repo=//p" "$rel/RELEASE")"
	# the tag is the release's code: it must still be the commit it was made from
	if [[ "$(git -C "$src" rev-parse -q --verify "refs/tags/$version^{commit}" || true)" != "$commit" ]]; then
		echo "$repo's tag $version is missing or no longer $commit" >&2
		exit 1
	fi
	mkdir -p "$WORK/$repo"
	git -C "$src" archive "$commit" | tar -x -C "$WORK/$repo"
	echo "$repo $(git -C "$src" rev-parse --short "$commit")"
done
cp "$rel/config/mercury.core.ts" "$WORK/MercuryCore/"
install -m 600 "$rel/config/Site.env" "$WORK/MercuryCore/Site/.env"
install -m 600 "$rel/config/Proxy.env" "$WORK/MercuryRCC/Proxy/.env"
install -m 600 "$rel/config/Orbiter.env" "$WORK/MercuryRCC/Orbiter/.env"
"$WORK/MercuryCore/aya/set-domain.sh" --no-restart "https://$DOMAIN" >/dev/null
# the Site only listens on loopback there: Caddy is in front of it. It shows
# the version in its footer.
sed -i '/^HOST=/d; /^MERCURY_VERSION=/d' "$WORK/MercuryCore/Site/.env"
printf 'HOST=127.0.0.1\nMERCURY_VERSION=%s\n' "$version" >>"$WORK/MercuryCore/Site/.env"
# the proxy's engine paths point into this machine's workspace
sed -i "s#$WORKSPACE/#$R/#g" "$WORK/MercuryRCC/Proxy/.env"
for service in Proxy Orbiter; do
	(cd "$WORK/MercuryRCC/$service" && CGO_ENABLED=0 go build -o "$service" .)
done

step "sending the code, settings and engine to $VPS:$R"
remote "command -v rsync >/dev/null || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync >/dev/null; }; mkdir -p $R/MercuryCore/deploy/certs $R/aya-dev"
rsync -az --delete --exclude=/data/ --exclude=/.env --exclude=/deploy/Caddyfile.vps --exclude=/deploy/certs/ \
	"$WORK/MercuryCore/" "$VPS:$R/MercuryCore/"
rsync -az --delete --exclude=/data/ --exclude=/logs/ "$WORK/MercuryRCC/" "$VPS:$R/MercuryRCC/"
engine="$rel/aya-dev"
bin="$engine/./build/x64-linux-rel/bin"
rsync -azR --delete "$bin/Aya.Server" "$bin/libfmod.so" "$bin/libfmod.so.13" "$bin/ClientSettings.json" \
	"$bin/shaders" "$bin/platform" "$engine/./client/resources" "$engine/./build/wasm-app-rel/bin" "$engine/./assets" \
	"$VPS:$R/aya-dev/"
rsync -zp --chmod=F600 "$TLS_CERT" "$VPS:$R/MercuryCore/deploy/certs/origin.pem"
rsync -zp --chmod=F600 "$TLS_KEY" "$VPS:$R/MercuryCore/deploy/certs/origin.key"

step "preparing the VPS"
remote "bash $R/MercuryCore/deploy/provision.sh $R $DOMAIN"
# compose.yml runs the Site and database as the owner of data/
remote "printf 'AYA_DATA_UID=%s\nAYA_DATA_GID=%s\n' \$(id -u mercury) \$(id -g mercury) >$R/MercuryCore/.env"
# (with the library path the proxy's service gives it)
aya="$R/aya-dev/build/x64-linux-rel/bin"
if ! remote "test -z \"\$(LD_LIBRARY_PATH=$aya ldd $aya/Aya.Server | grep 'not found')\""; then
	echo "Aya.Server is missing libraries on the VPS:" >&2
	remote "LD_LIBRARY_PATH=$aya ldd $aya/Aya.Server | grep 'not found'" >&2
	exit 1
fi

step "Caddy settings"
auth=""
if [[ -n "${BASIC_AUTH_USER:-}" ]]; then
	hash="$(printf '%s\n' "$BASIC_AUTH_PASSWORD" | remote "docker run --rm -i caddy:2 caddy hash-password")"
	auth="$(printf '\t@outside not remote_ip 127.0.0.1 ::1\n\tbasic_auth @outside {\n\t\t%s %s\n\t}' "$BASIC_AUTH_USER" "$hash")"
	echo "site-wide login: $BASIC_AUTH_USER"
fi
DOMAIN="$DOMAIN" AUTH="$auth" python3 -c '
import os, sys
text = open(sys.argv[1]).read()
print(text.replace("__DOMAIN__", os.environ["DOMAIN"]).replace("__AUTH__", os.environ["AUTH"]), end="")
' "$CORE/deploy/Caddyfile.vps.in" >"$WORK/Caddyfile.vps"
rsync -zp --chmod=F600 "$WORK/Caddyfile.vps" "$VPS:$R/MercuryCore/deploy/Caddyfile.vps"

step "gameserver image"
image="$({ grep -E '^GAMESERVER_IMAGE=' "$rel/config/Proxy.env" || true; } | tail -1 | cut -d= -f2-)"
image="${image:-mercury-gameserver}"
if [[ "$(sed -n 's/^gameserver=//p' "$rel/RELEASE")" != "$(remote "docker image inspect -f '{{.Id}}' $image 2>/dev/null" || true)" ]]; then
	remote "gunzip | docker load" <"$rel/gameserver.tar.gz"
else
	echo "$image is up to date"
fi

running="$(remote "curl -s -m 5 localhost:64991/ || true" | games)"
if ((running && !force)); then
	echo "$running game(s) are running on the VPS; rerun with --force to restart anyway" >&2
	exit 1
fi

if ((migrate)); then
	step "copying data/ over the VPS's"
	remote "cd $R/MercuryCore && $COMPOSE stop site economy database >/dev/null 2>&1 || true"
	# everything else while this machine keeps running, then the database and
	# the economy ledger with them stopped here, for a consistent copy
	rsync -aH --delete --exclude=/surreal/ --exclude=/economy/ "$CORE/data/" "$VPS:$R/MercuryCore/data/"
	here="$({ curl -s -m 5 localhost:64991/ || true; } | games)"
	if ((here && !force)); then
		echo "$here game(s) are running on this machine; rerun with --force to stop its database anyway" >&2
		exit 1
	fi
	local_stopped=1
	(cd "$CORE" && docker compose stop database economy >/dev/null)
	rsync -aH --delete "$CORE/data/surreal/" "$VPS:$R/MercuryCore/data/surreal/"
	rsync -aH --delete "$CORE/data/economy/" "$VPS:$R/MercuryCore/data/economy/"
	(cd "$CORE" && docker compose start database economy >/dev/null && docker compose restart site >/dev/null)
	local_stopped=0
	rsync -aH --delete "$RCC/data/" "$VPS:$R/MercuryRCC/data/"
fi
# console clients offered on /download (Site lib/server/downloads.ts)
nro="$rel/Aya.Switch.nro"
if [[ -f "$nro" ]]; then
	remote "mkdir -p $R/MercuryCore/data/downloads"
	rsync -z --times "$nro" "$VPS:$R/MercuryCore/data/downloads/Aya.Switch.nro"
fi
remote "mkdir -p $R/MercuryCore/data $R/MercuryRCC/data && chown -R mercury:mercury $R"

step "building and starting"
remote "cd $R/MercuryCore && { $COMPOSE build >/tmp/mercury-build.log 2>&1 || { tail -n 40 /tmp/mercury-build.log; exit 1; }; } && echo built"
remote "systemctl restart mercury-rcc-proxy mercury-orbiter"
remote "cd $R/MercuryCore && $COMPOSE up -d --remove-orphans 2>&1 | tail -n 5"
# a single-file mount keeps the old Caddyfile until the container is recreated
remote "cd $R/MercuryCore && $COMPOSE up -d --force-recreate --no-deps caddy 2>&1 | tail -n 1"
rsync -z --chmod=F644 "$rel/RELEASE" "$VPS:$R/RELEASE"

step "checking (the VPS now runs $version)"
sleep 8
remote "curl -sk -o /dev/null -w 'from the VPS itself: %{http_code}\n' -m 20 https://$DOMAIN/" || true
ip="${VPS#*@}"
# the origin certificate isn't from a public CA, so it is the one thing trusted
# here: the VPS has to show it, and nothing else can receive the login below
curl -s --cacert "$TLS_CERT" -o /dev/null -w "from here, straight to the VPS: %{http_code}\n" -m 20 --resolve "$DOMAIN:443:$ip" "https://$DOMAIN/" || true
if [[ -n "${BASIC_AUTH_USER:-}" ]]; then
	# the login goes in on stdin (-K -), not in curl's arguments, where other
	# accounts on this machine could read it from the process list
	curl -s --cacert "$TLS_CERT" -o /dev/null -w "  with the login: %{http_code}\n" -m 20 --resolve "$DOMAIN:443:$ip" \
		-K - "https://$DOMAIN/" <<<"user = \"$(printf '%s' "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" | sed 's/[\\"]/\\&/g')\"" || true
fi
curl -s -o /dev/null -w "through Cloudflare: %{http_code}\n" -m 20 "https://$DOMAIN/" || true
remote "systemctl is-active mercury-xvfb mercury-rcc-proxy mercury-orbiter | paste -sd' '; cd $R/MercuryCore && $COMPOSE ps --format '{{.Service}} {{.State}}' | paste -sd' '"
