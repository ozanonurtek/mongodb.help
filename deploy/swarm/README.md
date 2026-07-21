# mongodb.help, Production Deployment Guide

## 1. GitHub Secrets

Add these in **Repo → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Server IP or hostname |
| `SERVER_USER` | SSH user (e.g. `root`) |
| `SERVER_SSH_KEY` | Private SSH key |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope (used by Build to push images) |

## 2. Server Setup (run once)

```bash
# Clone repo
git clone https://github.com/ozanonurtek/mongodb.help-agentic.git /opt/mongodbhelp
cd /opt/mongodbhelp

# Initialize Docker Swarm (single-node is fine)
docker swarm init

# Create the mongo password secret
openssl rand -base64 32 | docker secret create mongo_password -

# Install the TLS certificate (CF Origin cert or Let's Encrypt) the nginx
# container will mount read-only. The compose file expects exactly these paths:
#   /opt/keys/cert.pem
#   /opt/keys/privkey.pem
sudo mkdir -p /opt/keys
sudo cp cert.pem privkey.pem /opt/keys/
sudo chmod 644 /opt/keys/cert.pem
sudo chmod 600 /opt/keys/privkey.pem
```

## 3. Environment File

Copy the example and fill in real values. **Lives on the server only**
(gitignored, see root `.gitignore`).

```bash
cp deploy/swarm/.env.example deploy/swarm/.env
vim deploy/swarm/.env
```

The `MONGO_ROOT_PASSWORD` in `.env` MUST match the value used when you created
the `mongo_password` docker secret (§2). The `mongo` container reads it from
`/run/secrets/mongo_password`; the app services read it from `MONGODB_URI` via
`${MONGO_ROOT_PASSWORD}` interpolation.

## 4. Build & Deploy

Build and deploy are **separate workflows** so you can build once, then deploy
whenever from the **same image tag**.

1. **Build** (`Repo → Actions → Build → Run workflow`). Pushes every service
   image to GHCR twice: `:latest` and `:<commit-sha>` (immutable).
2. **Deploy** (`Repo → Actions → Deploy → Run workflow`):
   - `image_tag`, image to pull. Leave empty for `:latest`, or paste the
     `:<commit-sha>` from the Build run to deploy that **exact** build.

Manual deploy (same image, already in GHCR at `:latest` or `:${IMAGE_TAG}`):

```bash
cd /opt/mongodbhelp/deploy/swarm
source .env
IMAGE_TAG=latest docker stack deploy -c docker-compose.swarm.yml mongodbhelp
```

## 5. Verify

```bash
# Check all services
docker service ls

# Health check
curl https://mongodb.help/api/health

# Check nginx is serving
curl -I http://localhost:80/   # should 301 to https://
```

## Pinned Image Versions

| Service          | Image         | Version        |
|------------------|---------------|----------------|
| Backend          | python/alpine | 3.13.14 / 3.23 |
| Frontend         | node/alpine   | 26.5.0         |
| Leads dashboard  | node/alpine   | 26.5.0         |
| Nginx (stock)    | nginx/alpine  | 1.30.4         |
| MongoDB          | mongo         | 8.3.2          |

## Notes

- **nginx is the stock image**, no custom build. `deploy/swarm/nginx/nginx.conf`
  is mounted read-only at runtime.
- **Mongo is single-replica** with `placement: node.role == manager`, so it
  stays on the manager node and keeps its volume. For HA, replace with a
  replica set and put the connection string in `MONGODB_URI` directly.
- **Nginx is the only published port** (80/443). All app services communicate
  over the Swarm overlay network via service DNS names (`backend`, `frontend`,
  `leads-dashboard`, `mongo`).
