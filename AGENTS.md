# HeyToolie — agent instructions

Read these before changing code:

1. **[RULES.md](RULES.md)** — stack, where things live, architecture rules, data rules, gotchas.
2. **[SPEC.md](SPEC.md)** — what the product does, its phases, and where the build differs from the spec.
3. **[README.md](README.md)** — running locally, deploying, troubleshooting.

Working agreements:

- `main` deploys to production. Commit only when asked; the user reviews before pushing.
- Database: forward-only, additive migrations. Anything that deletes or rewrites data needs an
  explicit yes first.
- Before finishing: `npm run typecheck`, `npm test`, and `npm run build` must pass. For UI changes,
  check the page in the browser at phone width (light and dark).
- Keep RULES.md, README.md, this file, CLAUDE.md and `.env.example` in step with the code.
