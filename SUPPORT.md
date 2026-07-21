# Support

> ℹ️ **`mongodb.help` is a community project, not affiliated with MongoDB, Inc.**
> We cannot help with MongoDB-the-product support tickets. For official MongoDB
> support, see the [MongoDB documentation](https://www.mongodb.com/docs/) or
> your MongoDB Atlas support plan.

## How to get help

Pick the channel that matches your need:

| You want to…                                    | Use                                                            |
|-------------------------------------------------|----------------------------------------------------------------|
| **Report a bug** in this project                | [Open a Bug Report issue](https://github.com/ozanonurtek/mongodb.help/issues/new?template=bug_report.yml) |
| **Request a feature**                           | [Open a Feature Request](https://github.com/ozanonurtek/mongodb.help/issues/new?template=feature_request.yml) |
| **Ask a "how do I…" question**                  | [Open an issue labelled `question`](https://github.com/ozanonurtek/mongodb.help/issues/new?labels=question) or [GitHub Discussions](https://github.com/ozanonurtek/mongodb.help/discussions) if enabled |
| **Report a security issue**                     | See [`SECURITY.md`](SECURITY.md) -- **do not open a public issue** |
| **Report a Code of Conduct violation**          | Email **ozanonurtek@gmail.com** (see [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)) |
| **Ask a question about MongoDB itself**         | [MongoDB Community Forums](https://www.mongodb.com/community/forums/) -- this project is *unofficial* |

## Before you file

1. **Search existing issues** -- your question may already be answered.
2. **Check the docs**:
   - [README](README.md) for setup and overview.
   - [`deploy/`](deploy/) for deployment.
3. **Pick the right channel** -- bug reports go in issues, "how do I" questions
   go in Discussions. Don't open issues just to ask questions; it pollutes the
   bug tracker.

## Response expectations

This is a volunteer-maintained project. There is **no SLA**. We aim to
triage new issues within a week, but complex questions may take longer. If
you need commercial-grade MongoDB support, contact MongoDB Inc. directly.

## Self-help checklist

If something isn't working locally, before filing an issue try:

- [ ] `docker compose down && docker compose up --build` -- clean rebuild.
- [ ] `docker compose ps` -- are all services healthy?
- [ ] `docker compose logs backend` (or `frontend`, `mongo`) -- any errors?
- [ ] Did you copy `.env.example` to `.env` and fill in required secrets?
- [ ] Are you on the latest `main`? `git pull && docker compose up --build`.
- [ ] Are ports `3333`, `3434`, `8888`, `27018` free on your machine?

Include the output of the above in your bug report -- it dramatically speeds
up the response.

## Paid / commercial support

None available from this project. If you'd like to offer commercial support
for self-hosters, you're welcome to -- just don't imply affiliation with the
project or with MongoDB, Inc. without written permission.
