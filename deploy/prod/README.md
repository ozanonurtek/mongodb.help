# mongodb.help — single-host production deploy

Production now runs as a plain `docker compose` project on one host, behind a
**Cloudflare Tunnel**. The old Swarm stack (`../swarm/`) is kept for reference
only and is no longer deployed.

```
Internet ──> Cloudflare edge ──> cloudflared connector ──> docker network
                                                             ├── frontend:3333
                                                             ├── leads-dashboard:3434
                                                             ├── backend:8888
                                                             └── mongo:27017
```

No port is published on the host. The only ingress is the tunnel connector's
outbound connection.

## What runs where

| Service          | Image                                        | Internal port | Public hostname        |
|------------------|----------------------------------------------|---------------|------------------------|
| `frontend`       | `ghcr.io/ozanonurtek/mongodb.help-frontend`  | 3333          | `mongodb.help`, `www.mongodb.help` |
| `leads-dashboard`| `ghcr.io/ozanonurtek/mongodb.help-leads-dashboard` | 3434    | `leads.mongodb.help`   |
| `backend`        | `ghcr.io/ozanonurtek/mongodb.help-backend`   | 8888          | — (only via frontend)  |
| `mongo`          | `mongo:8.3.13-noble`                          | 27017         | —                      |

Compose project name is pinned to `mongodbhelp`, so the network is
`mongodbhelp_default` and the volume is `mongodbhelp_mongo-data` regardless of
the checkout directory.

## 1. Prerequisites

- Docker Engine 24+ with the Compose v2 plugin.
- The Build workflow publishes **multi-arch** manifests (`linux/amd64` +
  `linux/arm64`) from native runners, so on an arm64 host no emulation is
  needed: set `APP_PLATFORM=linux/arm64` in `.env`.

  The compose file defaults to `linux/amd64` only as a fallback for hosts still
  pinned to an older amd64-only tag. If you need that fallback on arm64, install
  qemu once:

```bash
# One-off registration
docker run --privileged --rm tonistiigi/binfmt --install amd64

# Persist across reboots (systemd-binfmt runs before docker.service)
sudo docker create --name binfmt-tmp tonistiigi/binfmt
sudo docker cp binfmt-tmp:/usr/bin/qemu-x86_64 /usr/local/bin/qemu-x86_64-static
sudo docker rm binfmt-tmp
sudo chmod 755 /usr/local/bin/qemu-x86_64-static
sudo tee /etc/binfmt.d/qemu-x86_64.conf >/dev/null <<'EOF'
:qemu-x86_64:M:0:\x7f\x45\x4c\x46\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/local/bin/qemu-x86_64-static:POCF
EOF
sudo systemctl restart systemd-binfmt
```

After registering qemu, keep `APP_PLATFORM=linux/amd64`. When you switch to a
multi-arch tag, set `APP_PLATFORM=linux/arm64` (or remove the key) and the qemu
registration can be dropped.

## 2. First-time setup

```bash
sudo mkdir -p /opt/mongodbhelp/deploy/prod
# copy docker-compose.yml there (git clone or scp from this directory)
cd /opt/mongodbhelp/deploy/prod

sudo cp .env.example .env
sudo chmod 600 .env
sudo vim .env     # IMAGE_TAG, APP_PLATFORM, MONGO_ROOT_PASSWORD, MONGODB_URI,
                  # AUTH_URL, CORS_ORIGINS, AUTH_*, ADMIN_*, GATEWAY_HMAC_SECRET

sudo docker compose pull
sudo docker compose up -d --wait
sudo docker compose ps
```

## 3. Cloudflare Tunnel

The host runs **one** tunnel connector, shared with the other projects on the
box. It must be attached to this project's network so the dashboard routes can
use the service names above. In the connector's compose file:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}
    networks:
      - default
      - mongodbhelp

networks:
  mongodbhelp:
    external: true
    name: mongodbhelp_default
```

Then add the public hostnames in **Cloudflare Zero Trust → Networks → Tunnels**:

| Public hostname       | Path | Service URL                    |
|-----------------------|------|--------------------------------|
| `mongodb.help`        | —    | `http://frontend:3333`         |
| `www.mongodb.help`    | —    | `http://frontend:3333`         |
| `leads.mongodb.help`  | —    | `http://leads-dashboard:3434`  |

Alternatively, uncomment the `cloudflared` service in `docker-compose.yml` and
set `TUNNEL_TOKEN` in `.env` to run a connector inside this project.

## 4. Deploy / update

Deploys run **on the host itself** through a self-hosted GitHub Actions runner
(labels `self-hosted`, `mongodbhelp`) — no SSH keys or `SERVER_*` secrets. The
workflow stages this compose file into `/opt/mongodbhelp/deploy/prod` and runs
`docker compose pull && up -d --wait`.

Register the runner once (as the deploy user):

```bash
mkdir -p /opt/actions-runner-mongodbhelp && cd /opt/actions-runner-mongodbhelp
curl -fsSL -o runner.tar.gz \
  https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-arm64-2.338.2.tar.gz
tar xzf runner.tar.gz
./config.sh --url https://github.com/ozanonurtek/mongodb.help \
  --token <registration-token> --labels self-hosted,mongodbhelp \
  --name oracle-mongodbhelp --unattended --replace
sudo ./svc.sh install "$USER" && sudo ./svc.sh start
```

The deploy user must be able to write `/opt/mongodbhelp/deploy/prod` and use
the Docker socket (member of the `docker` group).

Manual equivalent:

```bash
cd /opt/mongodbhelp/deploy/prod
sudo docker compose pull
IMAGE_TAG=latest sudo docker compose up -d --wait --remove-orphans
```

`IMAGE_TAG` accepts `latest` or an immutable `:<commit-sha>` produced by the
Build workflow. Roll back by setting the previous SHA and running `up -d`.

## 5. Verify

```bash
sudo docker compose ps
sudo docker compose logs --tail=50 backend
sudo docker compose logs --tail=50 frontend

# From inside the project network (no published host ports)
docker run --rm --network mongodbhelp_default curlimages/curl \
  -s -o /dev/null -w '%{http_code}\n' http://frontend:3333/
docker run --rm --network mongodbhelp_default curlimages/curl \
  -s -o /dev/null -w '%{http_code}\n' http://backend:8888/api/health
```

## 6. Backup / restore

```bash
# Backup
PW="$(grep -E '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2-)"
docker compose exec -T mongo mongodump --archive --gzip \
  -u root -p "$PW" --authenticationDatabase admin > mongodbhelp-$(date +%F).gz

# Restore (into an empty/fresh volume)
docker compose up -d mongo
docker compose exec -T mongo mongorestore --archive --gzip --drop \
  -u root -p "$PW" --authenticationDatabase admin < mongodbhelp-2026-11-01.gz
```

`--nsInclude 'mongodbhelp.*'` restores only the app database and leaves the
`admin` database (root user) untouched.

## 7. Migrating from the Swarm stack

| Swarm | Single-host Compose |
|---|---|
| `docker stack deploy` | `docker compose up -d` |
| `mongo_password` external secret | `MONGO_ROOT_PASSWORD` env var |
| nginx container terminating TLS + routing | Cloudflare Tunnel routes directly to services |
| `replicas: 2` behind the routing mesh | one instance per service (scale with `--scale` if needed) |
| ports 80/443 published | no published ports |
| Swarm overlay network | bridge network `mongodbhelp_default` |

## Troubleshooting

- **`exec format error`** — amd64 image on an arm64 host without binfmt.
  Re-run the qemu registration in §1 and check
  `docker run --rm --platform linux/amd64 alpine uname -m` prints `x86_64`.
- **502 from Cloudflare** — the connector is not on `mongodbhelp_default`, or
  the route points at the wrong service name/port. Test with the curl commands
  in §5 from a container on that network.
- **OAuth redirect errors** — `AUTH_URL` must be the exact public HTTPS origin.
- **CORS errors** — `CORS_ORIGINS` must list every public origin, comma
  separated, no trailing slash.
- **Login drops to anonymous** — `GATEWAY_HMAC_SECRET` differs between
  `frontend` and `backend`.
