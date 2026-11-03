# Caddy with the ratelimit module, which isn't in the standard distribution.
# Caddyfile.aya uses `rate_limit` for per-client limits on authentication
# and applications, in addition to the Site's own limits.
FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@v0.1.0

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
