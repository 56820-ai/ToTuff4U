# Arcade Atlas leaderboard — Neon setup

Arcade Atlas uses **Neon PostgreSQL** for score storage and a **Neon Function** for the public score API. The website remains a static GitHub Pages site.

## Live API

- Function: `arcadeapi`
- Branch: `main`
- API URL: `https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech`
- Read scores: `GET /scores`
- Submit scores: `POST /submit-score`

The browser configuration is in `js/arcade-score-config.js`. It contains only the public API URL. Database credentials are injected by Neon into the Function and must never be placed in browser JavaScript.

## Database tables

The production Neon branch already contains `scores`, `score_ip_records`, and `leaderboard_top_scores`. The API reads the precomputed top-three table and inserts validated submissions into `scores`.

## Submission format

```json
{
  "player_name": "Player",
  "game_title": "2048",
  "score": "2048",
  "kind": "score"
}
```

For playtime submissions, use `kind: "session"` and a score of at least 5 seconds. Zero scores are rejected. Scores are sent to Neon through the Function; no Cloudflare Worker or Supabase project is required for the active score API.

## Deployment source

The Function source is in `neon/functions/arcadeapi/`. It uses the Neon-injected `DATABASE_URL` and the `pg` package. Deploy changes to the Neon `main` branch using the Neon Functions deployment workflow.
