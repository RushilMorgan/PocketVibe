# HeyToolie — agent instructions

Personal "share a link, get the useful version back" PWA at heytoolie.com. Product spec (and where the
build deliberately differs from it): [SPEC.md](SPEC.md). Setup and deploy: [README.md](README.md).

Follow the rules below for every change.

@RULES.md

## Working agreements

- `main` deploys to production. Commit only when asked; the user reviews before pushing.
- Database: forward-only, additive migrations. Anything that deletes or rewrites data needs an
  explicit yes first.
- Before finishing: `npm run typecheck`, `npm test`, and `npm run build` must pass. For UI changes,
  check the page in the browser at phone width (light and dark).
- Keep this file, RULES.md, README.md and `.env.example` in step with the code when structure,
  setup or env vars change.
