# Arcade Atlas leaderboard — Neon setup

Arcade Atlas uses **Neon PostgreSQL** for score storage and a **Neon Function** for the public score API. The website remains a static GitHub Pages site. Cloudflare is not used.

## Live API

- Function: `arcadeapi`
- Branch: `main`
- API URL: `https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech`
- Health check: `GET /health`
- Read scores: `GET /scores`
- Submit scores: `POST /submit-score`

The browser configuration is in `js/arcade-score-config.js`. It contains only the public API URL. Database credentials are injected by Neon into the Function and must never be placed in browser JavaScript.

## Required one-time GitHub setup

The Neon Function source imports `pg`. Neon requires the function to be bundled with its dependencies before deployment; uploading the raw source ZIP leaves `pg` unavailable at runtime.

1. Open the repository's **Settings → Secrets and variables → Actions**.
2. Create a repository secret named **`NEON_API_KEY`** containing a Neon API key with access to project `blue-pine-80547059`.
3. Open **Actions → Deploy Arcade Atlas Neon API → Run workflow**.

The workflow installs `pg`, uses the official Neon CLI bundler, deploys to branch `br-flat-grass-bdhxbnam`, waits for completion, and checks both `/health` and `/scores`. It also runs automatically when files in `neon/functions/arcadeapi/` change on `main`.

Do not put the Neon API key in a repository file, browser JavaScript, or a commit. The production API currently responds to `/health`; changes to the Neon Function require the `NEON_API_KEY` repository secret and a successful deployment workflow. Check `/health` and `/scores` after deployment.

## Database tables

The production Neon branch contains `scores`, `score_ip_records`, and `leaderboard_top_scores`. The API inserts validated submissions into `scores`; the existing `scores_refresh_top3` database trigger maintains the leaderboard table.

## Submission format

```json
{
  "player_name": "Player",
  "game_title": "2048",
  "score": "2048",
  "kind": "score"
}
```

For playtime submissions, use `kind: "session"` and a score of at least 5 seconds. Zero scores are rejected. Scores are sent to Neon through the Function; no Cloudflare Worker or Supabase project is used for the active score API.

## Leaderboard appearance

The existing `duckmath-site/assets/css/leaderboard.css` design is intentionally preserved. The API deployment does not replace the dark background, red score cards, Space Mono typography, or page layout.
