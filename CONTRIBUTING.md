# Contributing to mongodb.help

First off -- **thank you for taking the time to contribute.** ❤️ This is a
community-run project and every issue, PR, and review makes it better.

This document describes how to set up the project, the conventions we follow,
and the workflow we use to merge changes. It is meant to be read once and
referred back to. If anything is unclear, please open an issue labelled
`question` and we'll help.

> 📌 **TL;DR** -- Fork → branch off `main` (`feat/…`, `fix/…`, `docs/…`) → open
> a PR → address review → squash-merge. Follow [Conventional
> Commits](#commit-messages). Be kind ([Code of Conduct](CODE_OF_CONDUCT.md)).

---

## 🔆 Code of Conduct

Participation in this project is governed by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating
you are expected to uphold that code. Please report unacceptable behaviour to
**ozanonurtek@gmail.com**.

---

## 🌿 Branching model -- GitHub Flow

We use **[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)**,
a lightweight, branch-based workflow. It keeps history linear, deploys
predictable, and is friendly to new contributors.

```
                 ┌─────────────────────────────────────────────┐
                 │                    main                     │
                 │  (always deployable, always green, protected)│
                 └─────────────────────────────────────────────┘
                          ▲              ▲              ▲
                          │              │              │
                  ┌───────┴────┐  ┌──────┴──────┐  ┌────┴─────────┐
                  │ feat/… PR  │  │ fix/… PR    │  │ docs/… PR    │
                  │ (1+ review)│  │ (1+ review) │  │ (1+ review)  │
                  └────────────┘  └─────────────┘  └──────────────┘
```

### Rules

1. **`main` is always deployable.** Never commit directly to `main`. It is a
   protected branch.
2. **One branch per unit of work.** Branch off the latest `main`:
   ```bash
   git checkout main
   git pull --ff-only
   git checkout -b feat/add-rate-limit-header
   ```
3. **Open a Pull Request early** -- mark it `Draft` until it's ready for review.
4. **At least one approving review** is required before merge (see
   [Review process](#review-process)).
5. **CI must be green** before merge.
6. **Squash-and-merge** into `main`. The squashed commit message becomes the
   canonical history entry (see [Commit messages](#commit-messages)).
7. **Delete the branch** after merge to keep the repo tidy.

### Branch naming

Use lowercase, kebab-case, prefixed by type:

| Prefix       | Use for                                                 | Example                              |
|--------------|---------------------------------------------------------|--------------------------------------|
| `feat/`      | New user-facing feature or capability                   | `feat/share-chat-link`               |
| `fix/`       | Bug fix                                                 | `fix/wallet-double-deduct`           |
| `docs/`      | Documentation only                                      | `docs/update-deploy-guide`           |
| `refactor/`  | Code change that neither fixes a bug nor adds a feature | `refactor/extract-redaction`         |
| `perf/`      | Performance improvement                                 | `perf/stream-grounding`              |
| `test/`      | Adding or correcting tests                              | `test/e2e-anon-quota`                |
| `chore/`     | Tooling, deps, CI, build                                | `chore/bump-next-16-2-7`             |
| `ci/`        | CI configuration changes                                | `ci/add-python-lint-job`             |

### Long-running feature branches

Avoid them. If a change needs more than ~1 week of work, break it into smaller
PRs that each land on `main`. Long branches diverge, conflict, and demoralise.
If you genuinely need a development branch (e.g. a multi-PR epic), prefix it
with `wip/` and rebase against `main` daily.

### Releases

We do not maintain long-lived `release/*` branches. `main` is the release
branch; production deploys are pinned to a specific commit SHA from `main`
(see [`deploy/swarm/DEPLOY.md`](deploy/swarm/DEPLOY.md)). Versioned releases
are tagged as `git tag v0.2.0` on the relevant commit and published via GitHub
Releases.

### Hotfixes

```bash
git checkout main
git pull --ff-only
git checkout -b fix/critical-rate-limit-bypass
# fix, test, PR, review, merge -- same flow as any other change
```

Because `main` is always deployable, hotfixes are just fast-tracked PRs. After
merge, redeploy the new `main` SHA.

---

## 🛠️ Development setup

### Prerequisites

- **Docker** + **Docker Compose** (recommended path; everything else just works)
- Or, for native dev: **Node 20+**, **Python 3.11+**, a local MongoDB 8
  (or a free [Atlas](https://www.mongodb.com/atlas/database) M0 cluster)

### Get the code

```bash
# Fork the repo on GitHub, then:
git clone git@github.com:YOUR_USERNAME/mongodb-help.git
cd mongodb-help
git remote add upstream https://github.com/ozanonurtek/mongodb.help.git
```

### Run it

```bash
cp .env.example .env
# Edit .env: set AUTH_SECRET and ADMIN_SECRET to anything for local dev.
# OAuth (AUTH_GITHUB_*, AUTH_GOOGLE_*) is only needed to test sign-in.
docker compose up --build
```

- Frontend: http://localhost:3333
- Backend API docs: http://localhost:8888/docs
- Leads dashboard: http://localhost:3434/login (password: `admin` by default)

### Keep your fork in sync

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
```

---

## 🧭 Where to work

| You want to…                        | Look at…                                                |
|-------------------------------------|---------------------------------------------------------|
| Add a chat feature                  | [`backend/app/main.py`](backend/app/main.py) + [`frontend/src/`](frontend/src/) |
| Work on the design system           | [`frontend/src/app/globals.css`](frontend/src/app/globals.css) |
| Add a language                      | [`frontend/messages/`](frontend/messages/) -- see [i18n](#adding-a-language) |
| Improve admin / leads dashboard     | [`leads-dashboard/src/`](leads-dashboard/src/) + [`backend/app/admin.py`](backend/app/admin.py) |
| Tweak deploy / ops                  | [`deploy/`](deploy/) + [`.github/workflows/`](.github/workflows/) |

### Good first issues

Issues labelled [`good first issue`](https://github.com/ozanonurtek/mongodb.help/labels/good%20first%20issue)
are scoped to be approachable for newcomers. Issues labelled
[`help wanted`](https://github.com/ozanonurtek/mongodb.help/labels/help%20wanted)
welcome community contributions but may be more involved.

If an issue is unassigned and you want to work on it, **leave a comment** so
we can assign it to you and avoid duplicated work.

---

## 📐 Coding conventions

The short version: **match what's already there.** Surgical changes beat
rewrites.

### General

- **Touch only what you must.** Don't reformat adjacent code or "improve" what
  isn't broken in the same PR.
- **No speculative features.** Solve the problem in front of you.
- **No commented-out code** in merged PRs.
- **Comments are for *why*, not *what*.** The code already says what.
- **Secrets never go in source.** Use `.env` (git-ignored) or env vars. If you
  add a new secret, also add an empty entry to `.env.example`.

### Backend (Python)

- Python 3.11+. Target the versions in [`backend/requirements.txt`](backend/requirements.txt).
- Style: enforced by [Ruff](https://docs.astral.sh/ruff/) -- run
  `ruff check backend/app` locally before pushing (config in
  [`backend/ruff.toml`](backend/ruff.toml), line length 100).
- 4-space indent, type-hint public function signatures.
- Prefer `async def` for anything touching the DB or HTTP.
- Add new dependencies to `backend/requirements.txt` with a pinned version and
  justify the addition in the PR description.
- No new top-level module without discussing in an issue first.

### Frontend & leads-dashboard (TypeScript / Next.js)

- TypeScript `strict`. `npm run lint` (`tsc --noEmit`) must pass.
- Components: **shadcn/ui + Tailwind CSS v4**, using the token system in
  [`globals.css`](frontend/src/app/globals.css). **Never hardcode hex/oklch in
  component files** -- use Tailwind tokens (`bg-background`, `text-primary`, …).
- **Do not introduce MongoDB brand colors** (greens, leaf mark). Brand accent
  is amber.
- Co-locate translations for any user-facing string in
  [`frontend/messages/`](frontend/messages/) (all 7 locales, see
  [i18n](#adding-a-language)).
- Prefer composition over inheritance. Prefer named exports.

### Adding a language

1. Copy `frontend/messages/en.json` → `frontend/messages/<locale>.json` and translate.
2. Register the locale in the next-intl config (`frontend/src/i18n/`).
3. Add the locale to the language switcher and any locale arrays.
4. If the locale is RTL (e.g. a future Hebrew or Pashto addition), wire
   `dir="rtl"` in the root layout.

---

## 🧪 Testing

- **E2E tests** ([Playwright](https://playwright.dev)) live in
  [`frontend/e2e/`](frontend/e2e/). Run them with:
  ```bash
  cd frontend && npm run test:e2e
  ```
- **Type-check** before pushing:
  ```bash
  cd frontend && npm run lint
  cd leads-dashboard && npm run lint
  ```
- **Backend lint** ([Ruff](https://docs.astral.sh/ruff/)) before pushing:
  ```bash
  pip install ruff          # or: pipx install ruff
  ruff check backend/app
  ```
- We don't yet have a Python unit test suite. If you're adding logic that's
  non-trivial, please ask in an issue -- we may want to set up `pytest` first.

**Every PR that changes behaviour should include or update a test** where
reasonably possible. Bug-fix PRs should ideally include a regression test.

---

## 💬 Commit messages

We follow **[Conventional Commits](https://www.conventionalcommits.org/)** so
changelogs and release notes can be generated automatically.

```
<type>(<optional scope>): <imperative summary up to ~72 chars>

<optional body, wrapped at ~100 cols, explaining *why* not *what*>

<optional footer: BREAKING CHANGE:, Refs: #123, Co-authored-by: …>
```

### Types

`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`, `style`.

### Examples

```
feat(share): add shareable chat link endpoint
fix(limits): prevent daily chat counter from going negative
docs(readme): document leads dashboard env vars
chore(deps): bump next-intl to 4.0.1
```

### Rules

- **Imperative mood** in the summary: "add" not "added", "fix" not "fixes".
- **No period** at the end of the summary.
- **Reference issues** in the footer, not the summary: `Refs: #142`.
- **Breaking changes**: add `BREAKING CHANGE: <description>` in the footer and
  bump the major version on release.
- Because we **squash-and-merge**, only the PR's squashed message lands on
  `main` -- so make the PR title your final conventional commit summary. Commit
  messages on your feature branch can be messy ("wip", "fix tests"); they get
  squashed away.

---

## 🔁 Review process

1. **Open the PR** against `main` from your feature branch.
2. **Fill in the PR template** -- what changed, why, how to test, screenshots
   for UI changes.
3. **CI runs automatically.** Fix any failures.
4. **Request review** from a maintainer (or it will be picked up in triage).
5. **At least one approval** is required. Most non-trivial changes need two.
6. **Address feedback** with new commits on the same branch (don't force-push
   after review unless asked -- it makes diffs hard to read).
7. **Maintainer squashes & merges** once approved and green.
8. **Branch is deleted** automatically.

### What reviewers look for

- ✅ Does it do what the issue/PR says?
- ✅ Does it match existing conventions?
- ✅ Are secrets/credentials kept out of source?
- ✅ Are tests included or updated?
- ✅ Is the change surgical -- no drive-by refactors that belong in their own PR?
- ✅ For UI: does it avoid MongoDB brand colors and use Tailwind tokens?
- ✅ For new dependencies: are they justified and pinned?

### Expectations

- **Be responsive.** If review feedback sits untouched for 7 days, we may close
  the PR with an invite to reopen when you're ready. (No judgment -- life
  happens. Just say so.)
- **Be kind.** Push back on ideas, not people. See
  [Code of Conduct](CODE_OF_CONDUCT.md).
- **Small is beautiful.** A 50-line PR that does one thing will merge faster
  than a 500-line PR that does five. Split when you can.

---

## 🏷️ Labels

| Label              | Meaning                                                          |
|--------------------|------------------------------------------------------------------|
| `good first issue` | Small, self-contained, good for newcomers                        |
| `help wanted`      | Community contribution welcome                                   |
| `bug`              | Something is broken                                              |
| `enhancement`      | Improvement to existing functionality                            |
| `feature`          | Net-new functionality                                            |
| `docs`             | Documentation                                                    |
| `question`         | Clarification, not a code change                                 |
| `wontfix`          | We decided not to do this                                        |
| `needs-triage`     | Newly filed, not yet categorised by maintainers                  |
| `blocked`          | Waiting on another issue/PR/decision                             |

---

## 📦 Releases

- `main` is continuously deployable; production is pinned to a specific SHA.
- Maintainers cut a release by tagging a SHA on `main`:
  ```bash
  git tag -a v0.2.0 -m "Release v0.2.0"
  git push origin v0.2.0
  ```
- A GitHub Release is then published from that tag, with notes generated from
  the squashed commit history since the last tag.

---

## 📋 Issue reporting

- **Bugs:** use the Bug Report template. Include repro steps, expected vs
  actual, environment, and logs (redact secrets!).
- **Features:** use the Feature Request template. Explain the problem first,
  then the proposed solution.
- **Search first** to avoid duplicates.
- **One issue per problem** -- don't bundle.
- **Don't `+1`** with a comment; use 👍 on the issue. This keeps threads
  readable.

---

## ❓ Need help?

- Open a discussion / issue labelled `question`
- Email maintainers at **ozanonurtek@gmail.com**
- See [`SUPPORT.md`](SUPPORT.md) for the full support matrix

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE) that covers this project. You also confirm that
you have the right to make those contributions (e.g. it's your own work, or
your employer allows it).

---

*This document is itself open source -- PRs to improve it are welcome.*
