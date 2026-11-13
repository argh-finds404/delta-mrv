# Git hooks

Copy `.githooks/` to the repository root, then enable once per clone:

```bash
chmod +x .githooks/*
git config core.hooksPath .githooks
```

`core.hooksPath` is a local config value, so it is not inherited by a fresh
clone — re-run it after cloning, and note it in the README.

## What they block

**commit-msg**
- `Co-Authored-By` trailers
- "Generated with", and the names Claude, Anthropic, Copilot, Cursor, ChatGPT, OpenAI
- `Signed-off-by` naming a bot or noreply address
- Emoji
- Subjects that are not Conventional Commits, lowercase, under 72 chars, no trailing period

**pre-commit**
- `git user.name` / `user.email` not matching the maintainer
- `.env` files (except `.env.example`)
- `package-lock.json`, `yarn.lock`
- `middleware.ts`
- Staged lines containing a 64-hex private key, a Google API key, a blob token,
  or a Postgres URL with an inline password. The file is named; the line is not
  printed. One exemption: the local Docker database's URL, which
  `docker-compose.yml` publishes. The hook does not scan itself
- `NEXT_PUBLIC_ANCHOR_PRIVATE_KEY`

## Bypassing

`--no-verify` bypasses both. That is a maintainer action. An agent that uses
`--no-verify` is violating `docs/12-AGENT-SCOPE.md` §3.
