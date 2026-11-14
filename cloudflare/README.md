# Arcade Atlas on Cloudflare

This is an initial Cloudflare D1 + Workers backend scaffold. It does not change the live Supabase configuration.

## Included

- `worker/schema.sql`: D1 tables and indexes. Scores are decimal TEXT so very large Cookie Clicker values remain exact.
- `worker/src/index.js`: API endpoints:
  - `GET /scores?limit=20000&offset=0` returns the same basic row shape consumed by the current leaderboard.
  - `POST /submit-score` accepts the current `player_name`, `game_title`, `score`, and `kind` payload.
- `worker/wrangler.toml.example`: Wrangler configuration template.

## Deployment outline

1. Create a Cloudflare D1 database named `arcade-atlas`.
2. Copy the example Wrangler file to `wrangler.toml` and replace the database ID.
3. Apply `worker/schema.sql` to the database.
4. Set a private Worker secret named `IP_HASH_SECRET` (at least 32 characters).
5. Deploy the Worker.
6. Export existing Supabase score rows and import them into D1.
7. Test the API, then update the website's score configuration and client.

## Security and migration notes

Keep Supabase running until D1 is populated, the Worker is deployed, the frontend is switched, and score submission and leaderboard display are tested. Never put an API token or secret in a browser file or commit it to GitHub.

The Worker uses Cloudflare's `CF-Connecting-IP` request header and a private `IP_HASH_SECRET` to store a keyed IP hash, not the raw IP address. It preserves the current server-side field validation. This does not prove that a game score was legitimately earned; game-specific anti-cheat validation remains a separate concern.

The existing frontend is intentionally unchanged at this stage.
