# Deployment templates (OVH VPS + Cloudflare)

This folder contains ready templates for production deployment.

## Files

- `systemd/e-dziennik.service`: systemd service for Daphne/ASGI.
- `nginx/e-dziennik.conf`: Nginx reverse proxy with WebSocket support.

## How to use

1. Copy `.env.example` values to `/etc/e-dziennik.env` on VPS and fill real secrets.
2. Copy `deploy/systemd/e-dziennik.service` to `/etc/systemd/system/e-dziennik.service`.
3. Copy `deploy/nginx/e-dziennik.conf` to `/etc/nginx/sites-available/e-dziennik`.
4. Replace domain placeholders (`twojadomena.pl`) in all files.
5. Enable and restart services:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now e-dziennik`
   - `sudo ln -s /etc/nginx/sites-available/e-dziennik /etc/nginx/sites-enabled/e-dziennik`
   - `sudo nginx -t && sudo systemctl reload nginx`

## SSL with Cloudflare

Recommended mode: Full (strict).

- Option A (simpler): temporary DNS only in Cloudflare, issue Let's Encrypt cert with certbot, then re-enable proxy.
- Option B: use Cloudflare Origin Certificate in Nginx.

## Notes

- Application runs as ASGI (Daphne), required for Channels/WebSocket chat.
- In production set `DJANGO_DEBUG=False` and real `DJANGO_ALLOWED_HOSTS`.
- Use PostgreSQL via `DATABASE_URL` and Redis via `REDIS_URL`.
