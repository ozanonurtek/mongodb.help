<p align="center">
  <img alt="mongodb.help" src="frontend/public/icons/icon-192.png" height="72">
</p>

<p align="center">
  <em>Paste your error, question, or slow query. Get an answer grounded in the real MongoDB docs.</em>
</p>

<p align="center">
  <a href="https://github.com/ozanonurtek/mongodb.help/actions/workflows/build.yml"><img alt="Build" src="https://github.com/ozanonurtek/mongodb.help/actions/workflows/build.yml/badge.svg"></a>
  <a href="https://github.com/ozanonurtek/mongodb.help/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ozanonurtek/mongodb.help/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"></a>
  <a href="CODE_OF_CONDUCT.md"><img alt="CoC" src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg"></a>
</p>

> **⚠️ Unofficial & community-run.** This project is **not affiliated with,
> endorsed by, or sponsored by MongoDB, Inc.** "MongoDB" is a registered
> trademark of MongoDB, Inc. See [Disclaimer](#trademark-notice).

---

## What is this?

**[mongodb.help](https://mongodb.help)** is an open-source, chat-based support tool for MongoDB
developers. Instead of digging through docs, pasting your error into a generic
chatbot, or waiting on a forum, you drop your problem into one box and get a
calm, cited, conversation-aware answer grounded in the **official MongoDB
Knowledge Service**.

- **No marketing page. The tool is the homepage.** You land on an input box,
  not a pitch.
- **Grounded, not invented.** Answers cite the real MongoDB docs.
- **Multilingual out of the box** -- English, Turkish, French, Spanish, Arabic,
  German, Russian (RTL aware).
- **Free for everyone**, with a generous daily quota for signed-up users.
- **Self-hostable** -- Docker Compose for dev, Docker Swarm for prod.

It is also a working example of a **modern multi-service monorepo**: a FastAPI
backend, two Next.js apps, OAuth, a credit/wallet system designed to be
"sell-ready from day one" without a rewrite, and a deploy story built around
GitHub Actions + GHCR.

## Why this exists

Every MongoDB developer has stared at an error like `Transaction numbers are
only allowed on a replica set member` and lost 30 minutes to search results.
`mongodb.help` compresses that loop: paste, get a grounded answer with a fix
and a citation, move on. It's a focused utility -- not a chatbot demo, not a
MongoDB competitor -- and it's open source so the community can shape it.

## Architecture

```
                        ┌──────────────────────────────────────────┐
                        │                  nginx                    │
                        │  Host routing: mongodb.help / leads.*     │
                        └────────────┬─────────────────┬───────────┘
                                     │                 │
                  ┌──────────────────▼─┐     ┌─────────▼──────────────┐
                  │  Frontend (Next.js) │     │ Leads Dashboard (Next) │
                  │  Chat UI, tickets,  │     │ Admin view of leads &  │
                  │  7 locales, OAuth   │     │ tickets, single-pwd    │
                  └──────────┬──────────┘     └────────────┬───────────┘
                             │                              │
                             └──────────┬───────────────────┘
                                        ▼
                       ┌────────────────────────────────────┐
                       │     Backend (FastAPI, Python)       │
                       │  Chat pipeline, limits, wallets,    │
                       │  tickets, admin/leads APIs          │
                       └───────┬───────────────┬────────────┘
                               │               │
                               ▼               ▼
                  ┌────────────────────┐  ┌───────────────────────┐
                  │   MongoDB 8 (Atlas)│  │ MongoDB Knowledge Svc │
                  │ users, wallets,    │  │  (RAG over real docs) │
                  │ chats, tickets …   │  │                       │
                  └────────────────────┘  └───────────────────────┘
```

| Service           | Stack                                   | Port (dev)   | Source                |
|-------------------|-----------------------------------------|--------------|-----------------------|
| `backend`         | Python 3 · FastAPI · motor              | `:8888`      | [`backend/`](backend) |
| `frontend`        | Next.js 16 · React 19 · next-intl       | `:3333`      | [`frontend/`](frontend) |
| `leads-dashboard` | Next.js · single-password admin auth    | `:3434`      | [`leads-dashboard/`](leads-dashboard) |
| `mongo`           | MongoDB 8.3 (self-hosted or Atlas)      | `:27018`     | `docker-compose.yml`  |
| `nginx`           | Host-based routing proxy (prod only)    | `:80/:443`   | [`deploy/swarm/nginx/`](deploy/swarm/nginx) |

## Quick start

You need **Docker** + **Docker Compose**. That's it.

```bash
git clone https://github.com/ozanonurtek/mongodb.help.git
cd mongodb-help
cp .env.example .env          # then edit secrets (see below)
docker compose up --build
```

Open:
- **Frontend** → http://localhost:3333
- **Leads dashboard** → http://localhost:3434/login (password from `ADMIN_PASSWORD`, defaults to `admin`)
- **Backend API** → http://localhost:8888/docs (FastAPI Swagger UI, localhost-only)

> The backend port and Mongo port are bound to `127.0.0.1` only. The backend
> trusts `X-Auth-User-Id` only when accompanied by a valid `X-Gateway-Sig`
> HMAC (signed with `GATEWAY_HMAC_SECRET`, shared with the frontend gateway),
> so even direct backend access can't forge a user identity without the
> secret. Admin endpoints (`/api/admin/*`) verify a signed `X-Admin-Token`
> separately. See [`SECURITY.md`](SECURITY.md).

### Running natively (without Docker)

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8888

# Frontend
cd frontend && npm install && npm run dev          # http://localhost:3333

# Leads dashboard
cd leads-dashboard && npm install && npm run dev   # http://localhost:3434
```

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose | Required? |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | Yes (auto-set in Compose) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app creds | For OAuth login |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth app creds | For OAuth login |
| `AUTH_SECRET` | NextAuth JWT signing secret | Yes (dev default is insecure) |
| `ADMIN_PASSWORD` | Leads dashboard login password | Yes (dev default `admin`) |
| `ADMIN_SECRET` | HMAC secret for admin session JWT | Yes (dev default is insecure) |
| `ANON_DAILY_CHATS`, `ANON_MESSAGES_PER_CHAT` | Anonymous rate limits | Optional, has defaults |
| `SIGNEDUP_DAILY_CHATS`, `SIGNEDUP_MESSAGES_PER_CHAT` | Signed-up rate limits | Optional, has defaults |
| `KS_BASE_URL` | Override MongoDB Knowledge Service endpoint | Optional |

**Never commit `.env`.** The repo's `.gitignore` already excludes it.

## Chat limits

| Tier       | Daily chats                     | Messages / chat                |
|------------|---------------------------------|--------------------------------|
| Anonymous  | `ANON_DAILY_CHATS` (default 1)  | `ANON_MESSAGES_PER_CHAT` (5)   |
| Signed-up  | `SIGNEDUP_DAILY_CHATS` (10)     | `SIGNEDUP_MESSAGES_PER_CHAT` (50) |

Anonymous users who hit the limit see a sign-up prompt (lead capture).
Signed-up users get a larger quota and can open support tickets. Limits are
env-configurable and enforced in [`backend/app/main.py`](backend/app/main.py).

## Tests

End-to-end tests use [Playwright](https://playwright.dev):

```bash
cd frontend
npm install
npx playwright install chromium
npm run test:e2e
```

Type-check:

```bash
cd frontend && npm run lint      # tsc --noEmit
cd leads-dashboard && npm run lint
```

## Deploy

Production uses Docker Swarm with images pushed to GHCR by GitHub Actions.

```bash
# On the server (once): init swarm, create mongo secret, drop TLS certs
# at /opt/keys/{cert,privkey}.pem, then:
cd deploy/swarm
cp .env.example .env   # and fill in real values
source .env
IMAGE_TAG=latest docker stack deploy -c docker-compose.swarm.yml mongodbhelp
```

Build via **Repo → Actions → Build → Run workflow** (pushes `:latest` + `:<sha>`
to GHCR), then **Repo → Actions → Deploy → Run workflow**.

Full guides: [`deploy/swarm/README.md`](deploy/swarm/README.md) ·
[`deploy/swarm/DEPLOY.md`](deploy/swarm/DEPLOY.md).

## Contributing

Contributions are welcome and appreciated -- this is a community project by
design. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

The short version:

1. Fork & clone the repo.
2. Create a branch off `main` (see [branching model](CONTRIBUTING.md#branching-model)): `feat/…`, `fix/…`, `docs/…`, `chore/…`.
3. Run the app locally with `docker compose up --build`.
4. Make your change. Add tests where reasonable. Keep diffs surgical.
5. Open a Pull Request against `main` and fill in the template.
6. Be excellent to each other ([Code of Conduct](CODE_OF_CONDUCT.md)).

Good first issues are labeled [`good first issue`](https://github.com/ozanonurtek/mongodb.help/labels/good%20first%20issue).


## 📚 Documentation

- [`deploy/swarm/README.md`](deploy/swarm/README.md) -- Production deploy guide.

## Security

Found a security issue? Please **do not open a public issue.** See
[`SECURITY.md`](SECURITY.md) for responsible disclosure.

## Trademark notice

"MongoDB" is a registered trademark of **MongoDB, Inc.** This project is
**unofficial, community-run, and not affiliated with, endorsed by, or
sponsored by MongoDB, Inc.** The project deliberately avoids MongoDB's logo,
leaf mark, and brand colors. Nothing in this repository should be read as an
endorsement by MongoDB, Inc.

The Apache 2.0 license under which this project is distributed does **not**
grant any right to use the "MongoDB" trade name or trademark except as
required to describe the origin of the work.

## License

Copyright 2025 Ozan Onur Tek and contributors.

Licensed under the **Apache License, Version 2.0**. See [`LICENSE`](LICENSE)
for the full text. By contributing, you agree your contributions will be
licensed under the same terms.

## 💛 Acknowledgements

- **[MongoDB Knowledge Service](https://knowledge.mongodb.com/)** -- the RAG
  grounding layer over official MongoDB docs.
- Every contributor, issue reporter, and star-er. Open source runs on you.
