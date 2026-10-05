#!/usr/bin/env bash
# Switch the public address of the site, e.g.
#   aya/set-domain.sh http://localhost:8010
#   aya/set-domain.sh https://example.trycloudflare.com
# Updates Domain and DomainInsecure in mercury.core.ts and ORIGIN in Site/.env
# (they must agree, or form posts fail with "Cross-site POST form submissions
# are forbidden"), then rebuilds and restarts the Site.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

url="${1:-}"
if [[ ! "$url" =~ ^(https?)://([^/]+)/?$ ]]; then
	echo "usage: $0 http(s)://host[:port]" >&2
	exit 1
fi
origin="${BASH_REMATCH[1]}://${BASH_REMATCH[2]}"
host="${BASH_REMATCH[2]}"

sed -i -E "s#^(\tDomain: )\"[^\"]*\",#\1\"$host\",#; s#^(\tDomainInsecure: )\"[^\"]*\",#\1\"$host\",#" "$ROOT/mercury.core.ts"
sed -i -E "s#^ORIGIN=.*#ORIGIN=$origin#" "$ROOT/Site/.env"

grep -nE "^\t(Domain|DomainInsecure): " "$ROOT/mercury.core.ts"
grep -n "^ORIGIN=" "$ROOT/Site/.env"

# Aya.Server may only reach allowlisted hosts: swap the public domain entry
# (the localhost entries stay) in the RCC proxy's arguments
proxy_env="$ROOT/../MercuryRCC/Proxy/.env"
if [[ -f "$proxy_env" ]]; then
	python3 - "$proxy_env" "$host" <<'EOF'
import re, sys
path, host = sys.argv[1], sys.argv[2]
text = open(path).read()
def fix(match):
    args = match.group(1).split()
    out, i = [], 0
    while i < len(args):
        flag = args[i]
        if flag in ("--httpAllowHost", "--scriptHttpAllowHost") and i + 1 < len(args):
            value = args[i + 1]
            if not value.startswith(("localhost", "127.0.0.1")):
                i += 2
                continue  # old public domain
            out += [flag, value]
            i += 2
            continue
        out.append(flag)
        i += 1
    if not host.startswith(("localhost", "127.0.0.1")):
        out += ["--httpAllowHost", host, "--scriptHttpAllowHost", host]
    return "RCC_ARGS=" + " ".join(out)
open(path, "w").write(re.sub(r"^RCC_ARGS=(.*)$", fix, text, flags=re.M))
EOF
	echo "Updated the Aya.Server host allowlist; restart the RCC services (MercuryRCC/stop.sh, run.sh) to apply it."
fi

cd "$ROOT"
docker compose up -d --build site
