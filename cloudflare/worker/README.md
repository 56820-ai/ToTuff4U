# Arcade Atlas score API — Neon setup

The API remains a Cloudflare Worker. Neon PostgreSQL is the score store, and Cloudflare Hyperdrive provides the Worker-to-Postgres connection.

## Build and deploy

From this directory:

```sh
npm install
npm run build
```

Before deploying, confirm the Neon score history has been migrated from the existing D1 database. The D1 account was at its daily free row-read limit during setup, so the historical export/import is still pending.

Then deploy:

```sh
npx wrangler login
npm run deploy
```

The existing `IP_HASH_SECRET` Worker secret must remain configured. Do not print it or commit it to Git. The `HYPERDRIVE` binding is configured in `wrangler.toml`; it points to the Neon database.

## Data safety

- The old D1 database has not been deleted or modified.
- The Neon production schema and leaderboard trigger functions are in `neon-schema.sql`.
- The Worker code writes scores and hashed IP records in one Postgres transaction.
- The leaderboard trigger maintains the top three rows per game, including Cookie Clicker best-per-player and cumulative time games.
