#!/usr/bin/env bash
# Sets up a WireGuard server on the VPS (deploy/vps.env), for browsing from the
# VPS's own addresses: for example to sign in to a Roblox account the VPS's
# asset fetches then use, since Roblox ties a login to where it was made.
#
#   deploy/wireguard.sh
#
# Writes this machine's client config to deploy/wg-mercury.conf (ignored by
# git). Its private key is made here and never leaves this machine. Running it
# again keeps both keys and changes nothing that's already in place.
#
#   nmcli connection import type wireguard file deploy/wg-mercury.conf
#   nmcli connection up wg-mercury      # everything now goes through the VPS
#   nmcli connection down wg-mercury
#
# The tunnel carries IPv4 and IPv6, both leaving as the VPS. UDP 51820 stays
# open on the VPS (deploy/provision.sh keeps it open on later deploys).
set -euo pipefail
CORE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=vps.env.example
source "$CORE/deploy/vps.env"
: "${VPS:?set VPS in deploy/vps.env}"
host="${VPS#*@}"
conf="$CORE/deploy/wg-mercury.conf"

remote() { ssh -o BatchMode=yes "$VPS" "$@"; }

if [ -f "$conf" ]; then
	client_key="$(sed -n 's/^PrivateKey = //p' "$conf")"
else
	client_key="$(python3 -I -c '
import base64
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
key = X25519PrivateKey.generate().private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
print(base64.b64encode(key).decode())
')"
fi
client_pub="$(python3 -I -c '
import base64, sys
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
key = X25519PrivateKey.from_private_bytes(base64.b64decode(sys.stdin.read()))
print(base64.b64encode(key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)).decode())
' <<<"$client_key")"

echo "setting up WireGuard on $host"
server_pub="$(remote bash -s -- "$client_pub" <<'REMOTE'
set -euo pipefail
client_pub="$1"
if ! command -v wg >/dev/null; then
	apt-get update -qq
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends wireguard-tools >/dev/null
fi
install -d -m 700 /etc/wireguard
if [ ! -f /etc/wireguard/server.key ]; then
	(umask 077 && wg genkey >/etc/wireguard/server.key)
fi

# Peers leave as the VPS's own addresses. Docker's FORWARD chain drops what it
# doesn't know, so wg0 is let through in DOCKER-USER, which is why wg0 starts
# after Docker. IPv6 forwarding is only on while wg0 is up, and only for it.
(umask 077 && cat >/etc/wireguard/wg0.conf.new <<CONF
# Mercury VPS WireGuard (MercuryCore deploy/wireguard.sh)
[Interface]
Address = 10.77.0.1/24, fd77::1/64
ListenPort = 51820
PostUp = wg set %i private-key /etc/wireguard/server.key
PostUp = iptables -I DOCKER-USER -i %i -o eth0 -j ACCEPT
PostUp = iptables -I DOCKER-USER -i eth0 -o %i -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -s 10.77.0.0/24 -o eth0 -j MASQUERADE
PostUp = ip6tables -A FORWARD -i %i -o eth0 -j ACCEPT
PostUp = ip6tables -A FORWARD -i eth0 -o %i -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp = ip6tables -P FORWARD DROP
PostUp = ip6tables -t nat -A POSTROUTING -s fd77::/64 -o eth0 -j MASQUERADE
PostUp = sysctl -q -w net.ipv6.conf.all.forwarding=1
PostDown = sysctl -q -w net.ipv6.conf.all.forwarding=0
PostDown = ip6tables -t nat -D POSTROUTING -s fd77::/64 -o eth0 -j MASQUERADE
PostDown = ip6tables -P FORWARD ACCEPT
PostDown = ip6tables -D FORWARD -i eth0 -o %i -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostDown = ip6tables -D FORWARD -i %i -o eth0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -s 10.77.0.0/24 -o eth0 -j MASQUERADE
PostDown = iptables -D DOCKER-USER -i eth0 -o %i -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostDown = iptables -D DOCKER-USER -i %i -o eth0 -j ACCEPT

# This machine's client (deploy/wg-mercury.conf on the machine that ran it)
[Peer]
PublicKey = $client_pub
AllowedIPs = 10.77.0.2/32, fd77::2/128
CONF
)
changed=1
if cmp -s /etc/wireguard/wg0.conf.new /etc/wireguard/wg0.conf; then
	changed=0
fi
mv /etc/wireguard/wg0.conf.new /etc/wireguard/wg0.conf
install -d /etc/systemd/system/wg-quick@wg0.service.d
printf '[Unit]\nAfter=docker.service\n' >/etc/systemd/system/wg-quick@wg0.service.d/mercury.conf
systemctl daemon-reload
systemctl enable wg-quick@wg0 >/dev/null 2>&1
if [ "$changed" = 1 ]; then
	systemctl restart wg-quick@wg0
else
	systemctl start wg-quick@wg0
fi

# Open UDP 51820 now; provision.sh writes the same rule from now on
if ! grep -q 'udp dport 51820 accept' /etc/nftables.conf; then
	sed -i 's/^\(\s*\)tcp dport { 22, 80, 443 } accept$/&\n\1udp dport 51820 accept/' /etc/nftables.conf
fi
grep -q 'udp dport 51820 accept' /etc/nftables.conf || {
	echo "couldn't open UDP 51820 in /etc/nftables.conf" >&2
	exit 1
}
nft -f /etc/nftables.conf

wg pubkey </etc/wireguard/server.key
REMOTE
)"

# The MTU leaves room for home connections with a smaller one (PPPoE)
(umask 077 && cat >"$conf" <<EOF
# Mercury VPS WireGuard client (MercuryCore deploy/wireguard.sh)
[Interface]
PrivateKey = $client_key
Address = 10.77.0.2/32, fd77::2/128
DNS = 1.1.1.1, 2606:4700:4700::1111
MTU = 1380

[Peer]
PublicKey = $server_pub
Endpoint = $host:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
)
echo "client config: $conf"
