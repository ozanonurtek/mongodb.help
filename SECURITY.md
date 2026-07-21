# Security Policy

## 🔒 Supported versions

This project is pre-1.0 and ships security fixes against the latest `main`
branch only. There are no LTS release lines yet.

| Version | Supported          |
|---------|--------------------|
| `main`  | ✅ Latest commit   |
| `<tag>` | ⚠️ Best-effort     |

If you are self-hosting, **pin to a specific commit SHA** and track `main` for
security updates.

## 📣 Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, report vulnerabilities **privately** using one of these channels:

1. **Preferred:** use GitHub's private vulnerability reporting at
   https://github.com/ozanonurtek/mongodb.help/security/advisories/new
   (Security tab → "Report a vulnerability"). This keeps the report encrypted
   and visible only to maintainers.
2. **Fallback:** email **ozanonurtek@gmail.com** with the subject
   `[SECURITY] <short summary>`. If the issue affects a maintainer personally,
   email **ozanonurtek@gmail.com** instead.

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, including any proof-of-concept. A minimal repro is gold.
- Affected versions / commits, if you know them.
- Any suggested mitigations or fixes.
- How you would like to be credited (name/handle/link, or "anonymous").

## 🤝 Our commitment

We will:

- Acknowledge receipt of your report within **120 hours**.
- Aim to provide an initial assessment within **30 days**.
- Keep you informed of progress as we work on a fix.
- Credit you in the advisory unless you prefer to remain anonymous.

We ask that you:

- Give us reasonable time to investigate and patch before any public
  disclosure. We'll coordinate a disclosure date with you (default target:
  90 days from report, per industry norms).
- Do not access or modify data that does not belong to you.
- Do not perform DoS, social engineering, or physical attacks against the live
  `mongodb.help` service or its infrastructure.
- Make a good-faith effort to avoid privacy violations and damage to other
  users.

## 🏆 Recognition

Responsible disclosures are credited in the
[GitHub Security Advisories](https://github.com/ozanonurtek/mongodb.help/security/advisories)
page for this repository. We're grateful for every report -- even false
positives that improve our understanding.

## 🛡️ Security considerations for self-hosters

If you deploy this project, keep the following in mind:

- **Never expose the backend port publicly.** It binds to `127.0.0.1` by
  default. The backend has two independent auth mechanisms:
  - **User-facing endpoints** (`/api/chats`, `/api/queries`, `/api/tickets`,
    `/api/account`, …) trust `X-Auth-User-Id` **only when accompanied by a
    valid `X-Gateway-Sig` HMAC** computed by the trusted frontend gateway
    (`backend/app/identity.py`). The signature covers
    `(method, path, user_id, ts)` and is HMAC-SHA256'd with
    `GATEWAY_HMAC_SECRET`, which is shared between the frontend and backend.
    The gateway strips any client-supplied identity/gateway headers before
    signing (`frontend/src/app/api/[...slug]/route.ts`).
    Direct backend access without the secret cannot forge a user identity --
    at worst, an attacker is treated as anonymous (rate-limited, no access
    to user data). A captured signature can be replayed only on the same
    method+path within the 120-second timestamp window.
  - **Admin endpoints** (`/api/admin/*`) verify a signed `X-Admin-Token`
    (HMAC-SHA256 JWT, `ADMIN_SECRET`) and are not bypassable by direct
    access alone -- but exposing the backend still lets attackers probe
    those endpoints, so the `127.0.0.1` binding must hold for both.
- **Generate strong `GATEWAY_HMAC_SECRET`.** Like `AUTH_SECRET`, the dev
  default (`dev-insecure-gateway-secret-change-me`) MUST be replaced before
  any non-local deployment. Use `openssl rand -hex 32`.
- **Rotation of `GATEWAY_HMAC_SECRET` causes a brief service blip.** With a
  single secret there is no deploy order that avoids this: as soon as one
  service has the new value and the other still has the old, every signed-in
  request fails signature verification and downgrades the caller to
  anonymous for ~60s (until both services are redeployed). Users will see
  "sign in for more" prompts and need to refresh. No data is lost, but new
  chats started during the blip are keyed to the caller's IP hash and won't
  appear in their history afterward. If you need zero-downtime rotation,
  extend the backend to accept a comma-separated list of accepted secrets
  and roll forward (add new → redeploy → switch frontend → redeploy → drop
  old).
- **Generate strong `AUTH_SECRET` and `ADMIN_SECRET`.** The dev defaults
  (`dev-insecure-…`) MUST be replaced before any non-local deployment.
- **Rotate OAuth client secrets** if they leak. They live in `.env`, which is
  git-ignored -- but if you ever paste one into a PR or log, rotate it
  immediately.
- **Keep MongoDB credentials out of version control.** Use Docker secrets or
  your orchestrator's secret store in production; never hard-code them.
- **TLS is required in production.** The Swarm deploy expects certs at
  `/opt/keys/{cert,privkey}.pem`. Terminate TLS at nginx and redirect HTTP →
  HTTPS.
- **Anonymous rate-limiting is IP-based and bypassable.** Add CAPTCHA before
  scaling.
- **Secrets are redacted from pasted user input before model calls**, but you
  should still treat the `queries` collection as potentially sensitive --
  enforce your own access controls on the database.

## 🔎 Scope

**In scope:**

- Vulnerabilities in this repository's source code (backend, frontend,
  leads-dashboard, deploy configs).
- Misconfigurations in the provided Docker / Swarm setup that lead to a
  security issue when deployed as documented.
- Authentication, authorization, or rate-limiting bypasses.

**Out of scope:**

- Vulnerabilities in third-party dependencies themselves -- report those to the
  upstream project. (We still appreciate a heads-up so we can bump the dep.)
- Findings from automated scanners without a working proof-of-concept.
- Theoretical issues that require an attacker to already be authenticated as an
  admin.
- Self-hosted deployments that have deviated from the documented setup in ways
  that introduce the issue.

Thank you for helping keep this project and its users safe. 🛡️
