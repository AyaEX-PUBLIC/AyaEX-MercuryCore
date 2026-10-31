#!/usr/bin/env bash
# Shows a static "under maintenance" page on DOMAIN instead of the Site, e.g.
#   deploy/maintenance.sh on       show the maintenance page; stop the Site
#   deploy/maintenance.sh off      start the Site; stop showing the page
#   deploy/maintenance.sh status
#
# Never touches the standalone AyaEX site (STANDALONE_DOMAIN) or any running
# games.
#
# How it works: Caddy's DOMAIN block (deploy/Caddyfile.vps.in) always checks
# for data/maintenance/live on the VPS. Present (the default once this ships):
# it reverse_proxies to the Site as usual. Absent: it serves deploy/
# maintenance/ instead. Toggling is just that one file, read fresh on every
# request, so "on"/"off" need no Caddy restart; and since data/ is excluded
# from deploy.sh's rsync, the state survives an unrelated deploy. This script
# also ships deploy/Caddyfile.vps.in and deploy/maintenance/ to the VPS itself
# (normally only deploy.sh does that), but only recreates Caddy if they
# actually changed.
set -euo pipefail
CORE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

action="${1:-status}"
case "$action" in on | off | status) ;; *)
	echo "usage: $0 [on|off|status]" >&2
	exit 1
	;;
esac

# shellcheck source=vps.env.example
source "$CORE/deploy/vps.env"
: "${VPS:?set VPS in deploy/vps.env}" "${DOMAIN:?set DOMAIN}"
R="${REMOTE_ROOT:-/opt/mercury}/MercuryCore"
COMPOSE="docker compose -f compose.yml -f deploy/compose.vps.yml"

remote() { ssh -o BatchMode=yes "$VPS" "$@"; }
step() { printf '\n== %s\n' "$*"; }

step "games on the VPS right now"
remote "curl -s -m 5 localhost:64991/ || true" | python3 -c '
import json, sys
try:
    servers = json.load(sys.stdin)
except ValueError:
    servers = []
running = sum(1 for _, s in servers if s.get("status") in (1, 2))
print(f"{running} running")'

step "sending the maintenance page and Caddy config"
remote "mkdir -p $R/deploy/maintenance $R/data/maintenance"
rsync -az --delete "$CORE/deploy/maintenance/" "$VPS:$R/deploy/maintenance/"
# compose.vps.yml declares the two mounts below: without it on the VPS too,
# a --force-recreate here would start caddy with neither of them
rsync -zp "$CORE/deploy/compose.vps.yml" "$VPS:$R/deploy/compose.vps.yml"

login() {
	local hash
	hash="$(printf '%s\n' "$2" | remote "docker run --rm -i caddy:2 caddy hash-password")"
	printf '\theader Cloudflare-CDN-Cache-Control no-store\n'
	printf '\t@outside not remote_ip 127.0.0.1 ::1\n\tbasic_auth @outside {\n\t\t%s %s\n\t}' "$1" "$hash"
}
auth=""
[[ -n "${BASIC_AUTH_USER:-}" ]] && auth="$(login "$BASIC_AUTH_USER" "$BASIC_AUTH_PASSWORD")"
standalone_auth=""
if [[ -n "${STANDALONE_DOMAIN:-}" && -n "${STANDALONE_BASIC_AUTH_USER:-}" ]]; then
	standalone_auth="$(login "$STANDALONE_BASIC_AUTH_USER" "${STANDALONE_BASIC_AUTH_PASSWORD:?set STANDALONE_BASIC_AUTH_PASSWORD}")"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DOMAIN="$DOMAIN" AUTH="$auth" STANDALONE_DOMAIN="${STANDALONE_DOMAIN:-}" STANDALONE_AUTH="$standalone_auth" python3 -c '
import os, re, sys
text = open(sys.argv[1]).read()
if os.environ["STANDALONE_DOMAIN"]:
    text = text.replace("__STANDALONE_DOMAIN__", os.environ["STANDALONE_DOMAIN"])
    text = text.replace("__STANDALONE_AUTH__", os.environ["STANDALONE_AUTH"])
else:
    text = re.sub(r"# __STANDALONE_BEGIN__\n.*?# __STANDALONE_END__\n", "", text, flags=re.S)
print(text.replace("__DOMAIN__", os.environ["DOMAIN"]).replace("__AUTH__", os.environ["AUTH"]), end="")
' "$CORE/deploy/Caddyfile.vps.in" >"$WORK/Caddyfile.vps"

# recreate caddy (picking up any new mount in compose.vps.yml, not just a
# changed Caddyfile.vps) only if either actually differs from the VPS's copy
remote_sum="$(remote "sha256sum $R/deploy/Caddyfile.vps $R/deploy/compose.vps.yml 2>/dev/null" | cut -d' ' -f1 | tr '\n' ' ' || true)"
local_sum="$(sha256sum "$WORK/Caddyfile.vps" "$CORE/deploy/compose.vps.yml" | cut -d' ' -f1 | tr '\n' ' ')"
if [[ "$remote_sum" != "$local_sum" ]]; then
	rsync -zp --chmod=F600 "$WORK/Caddyfile.vps" "$VPS:$R/deploy/Caddyfile.vps"
	remote "cd $R && $COMPOSE up -d --force-recreate --no-deps caddy 2>&1 | tail -n 1"
else
	echo "Caddy config unchanged"
fi

case "$action" in
on)
	step "stopping the Site"
	remote "rm -f $R/data/maintenance/live"
	remote "cd $R && $COMPOSE stop site 2>&1 | tail -n 3"
	;;
off)
	step "starting the Site"
	remote "cd $R && $COMPOSE start site 2>&1 | tail -n 3"
	# only once the Site answers, or a visitor could land on neither the
	# maintenance page nor a working Site. :8010 is Caddy, which replies 502
	# itself while the Site is still starting, so a plain connection check
	# passes at once: the status has to be something else
	for _ in $(seq 1 45); do
		code="$(remote "curl -s -o /dev/null -m 2 -w '%{http_code}' http://127.0.0.1:8010/" || true)"
		case "$code" in 000 | 502 | 503 | 504 | "") ;; *) break ;; esac
		sleep 2
	done
	remote "touch $R/data/maintenance/live"
	;;
esac

step "status"
if remote "test -f $R/data/maintenance/live"; then
	echo "maintenance page: off (the Site is shown)"
else
	echo "maintenance page: on"
fi
remote "cd $R && $COMPOSE ps --format '{{.Service}} {{.State}}' site"
curl -s -o /dev/null -w "https://$DOMAIN/: %{http_code}\n" -m 20 "https://$DOMAIN/" || true
