#!/usr/bin/env bash
# Prepares a Debian 13 VPS for Mercury. Run as root on the VPS by deploy.sh,
# before every deploy (it changes nothing that's already in place):
#   provision.sh REMOTE_ROOT DOMAIN
# - packages: Docker and Compose, and what native Aya.Server renders need
#   (Xvfb, Mesa, the libraries it links against), all from Debian
# - the mercury user (uid 1000, as compose.yml runs the Site and database)
# - a firewall letting in only SSH, HTTP and HTTPS
# - DOMAIN resolving to the VPS itself, for its gameservers and renders
# - systemd services for Xvfb, the RCC proxy and the Orbiter
set -euo pipefail
root="$1"
domain="$2"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DEBIAN_FRONTEND=noninteractive
packages=(
	docker.io docker-cli docker-compose docker-buildx apparmor rsync curl ca-certificates nftables
	xvfb libgl1-mesa-dri libglx-mesa0
	libatomic1 libglu1-mesa libglx0 libice6 libopengl0 libpulse0 libsm6
	libstdc++6 libuuid1 libx11-6 libxext6
)
missing=()
for p in "${packages[@]}"; do
	dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || missing+=("$p")
done
if ((${#missing[@]})); then
	echo "installing: ${missing[*]}"
	apt-get update -qq
	apt-get install -y -qq --no-install-recommends "${missing[@]}" >/dev/null
fi
systemctl enable --now docker >/dev/null

if ! id mercury >/dev/null 2>&1; then
	useradd --uid 1000 --create-home --shell /bin/bash mercury
fi
usermod -aG docker mercury
mkdir -p "$root"
chown mercury:mercury "$root"

# Only SSH, HTTP and HTTPS from outside. Its own table, so reloading it never
# touches the rules Docker adds.
cat >/etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
# Mercury VPS firewall (MercuryCore deploy/provision.sh)
table inet mercury
delete table inet mercury
table inet mercury {
	chain input {
		type filter hook input priority filter; policy drop;
		iif lo accept
		ct state established,related accept
		ct state invalid drop
		meta l4proto { icmp, ipv6-icmp } accept
		tcp dport { 22, 80, 443 } accept
	}
}
EOF
systemctl enable nftables >/dev/null 2>&1
nft -f /etc/nftables.conf

# The VPS's own requests for the public domain (gameservers, renders) stay on
# the VPS: no trip through Cloudflare, and no site-wide login
sed -i '/# mercury: public domain$/d' /etc/hosts
printf '127.0.0.1 %s # mercury: public domain\n::1 %s # mercury: public domain\n' "$domain" "$domain" >>/etc/hosts

for unit in "$here"/systemd/*.service; do
	sed "s#@ROOT@#$root#g" "$unit" >"/etc/systemd/system/$(basename "$unit")"
done
systemctl daemon-reload
systemctl enable mercury-xvfb mercury-rcc-proxy mercury-orbiter >/dev/null 2>&1
systemctl start mercury-xvfb
echo "provisioned"
