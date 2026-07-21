<!--
Thank you for opening a PR! Please fill in the sections below.
Read CONTRIBUTING.md if you haven't already: https://github.com/ozanonurtek/mongodb.help/blob/main/CONTRIBUTING.md

A few things that help reviewers:
- Keep PRs small and focused. Split when you can.
- Don't reformat unrelated code. Surgical changes only.
- Secrets/credentials must stay out of source.
- Squash-merge is the default -- your PR title becomes the canonical commit, so
  follow Conventional Commits (feat: …, fix: …, docs: …, chore: …).
-->

## What & why

<!-- 1–3 sentences. What does this PR do, and why? Link the issue if any. -->

Refs: #<!-- issue number, or remove if none -->

## What changed

<!-- Bullet list of meaningful changes. Skip trivial stuff. -->

-

## How to test

<!-- Steps a reviewer can follow to verify this works. Include test commands. -->

1.
2.

**Expected:**

## Screenshots / recordings

<!-- For UI changes ONLY. Before/after is gold. Delete this section for non-UI PRs. -->

## Checklist

- [ ] Branch is off the latest `main` and named per the convention (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
- [ ] The change is **surgical** -- no drive-by refactors that belong in their own PR.
- [ ] I have **added or updated tests** where reasonable.
- [ ] I have **run the type-check / lint / tests** locally and they pass.
      - `cd frontend && npm run lint`
      - `cd leads-dashboard && npm run lint`
      - `ruff check backend/app`
      - `cd frontend && npm run test:e2e` (for frontend changes)
- [ ] I have **not introduced any secrets** or credentials in this diff.
- [ ] For UI changes: I used the shadcn token system (`bg-background`, `text-primary`, …) and did **not** use MongoDB brand colors.
- [ ] For user-facing strings: I added/updated translations in **all** `frontend/messages/*.json`.
- [ ] For new env vars: I added an entry to `.env.example` and documented it in `README.md`.
- [ ] For new dependencies: they are justified and pinned, and I've updated the lockfile.
- [ ] PR title follows **Conventional Commits** (`feat(scope): …`, `fix(scope): …`).

## Breaking changes

<!-- If yes, describe the impact and migration steps. Add "BREAKING CHANGE:" to the commit body when this merges. If no, delete this section. -->

## Notes for reviewers

<!-- Anything reviewers should pay extra attention to, tricky edge cases, or areas you're unsure about. -->
