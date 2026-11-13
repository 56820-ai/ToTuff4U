# Arcade 3D

Five 3D games in one browser tab: drive, fly, battle and launch rockets across a whole miniature
world, from city streets to the surface of Mars. Online multiplayer with squad voice chat, gold to
earn and spend, and in-game city billboards that real businesses can book. Built with Next.js and
Three.js. MIT licensed.

**▶ Play in your browser: [webgl-games.github.io/arcade-3d](https://webgl-games.github.io/arcade-3d/)**
(the games run offline and against bots there; live multiplayer, voice chat, the shop and
billboards need the full app below).

Part of [webgl-games](https://github.com/webgl-games), open-source games and 3D experiences for the browser.
Siblings: [Flight Sim](https://github.com/webgl-games/flight-sim) (a WebGL flight simulator),
[Live 3D Cricket](https://github.com/webgl-games/live-3d-cricket) (commentary feeds as 3D cricket) and
[OpenCity](https://github.com/webgl-games/opencity) (an open-world driving game in Godot).

## The games

| Mode | File | What it is |
| --- | --- | --- |
| **Explore: Tiny Planet** | `public/tiny-planet.html` | Open world on a curved tiny planet: cars, helicopters, trains, boats, rockets, a starfighter, deliveries, demolition contracts, police, achievements, a world map and a store. Fly on to the Moon and Mars. |
| **Team Deathmatch** | `public/team-deathmatch.html` | 4v4 arena shooter. Online over the built-in relay, or offline against bots. |
| **Battle Royale** | `public/battle-royale.html` | Parachute in, loot up, outlast the shrinking zone. Squads and voice online, bots offline. |
| **Destruction** | `public/destruction.html` | Co-op physics sandbox: level buildings and flip cars together, or solo with a bot crew. |
| **Rocket Mission** | `public/rocket-mission.html` | A step-by-step rocketry mission: stack the booster, load propellant, run the countdown, reach orbit, refuel and land. Opened from the launch console at the Launch Site in Explore. |

Each game is a self-contained HTML file (Three.js 0.160 from a CDN, procedural geometry, canvas
textures and synthesised sound). The Next.js app wraps them: a public landing page, accounts, the
game menu, a store, the billboard booking page and an admin area. There are no downloaded models,
textures or audio files in the repository.

## Features

- **Accounts** with username and password (scrypt), DB-backed sessions in an httpOnly cookie.
  Playing requires an account; `src/proxy.ts` sends guests to `/login`.
- **Gold wallet**: earned in-game (server-clamped per request) or bought as gold packs with
  Stripe Checkout. Items (hero cape, flying vehicle, blaster, starfighter) are bought with gold,
  server-authoritative.
- **City billboards**: three giant screens in Explore that anyone can book by the day on `/ads`
  ($4.99 per board per day, first come first served), with images or video, an optional
  click-through link, and view/click counts for the advertiser.
- **Multiplayer relay** (`server/mp-server.mjs`): rooms over WebSockets; the first player in a
  room hosts the simulation. Voice chat clips travel over the same relay.
- **Admin area** (`/admin`): metrics, users (grant gold or items, delete), the contact inbox and
  billboard bookings. Admins are the usernames in `ADMIN_USERNAMES`.
- **Contact form** saved to the admin inbox.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI at least
npm run dev
```

`npm run dev` starts `next dev` on port 3000 and the multiplayer relay on port 8031
(`MP_PORT`). Open [http://localhost:3000](http://localhost:3000), sign up and pick a mode.
Over plain `http` the games connect to the relay on port 8031; over `https` they use
`wss://<host>/mp` on the same port as the site.

## Configuration

See [`.env.example`](.env.example):

- `MONGODB_URI` (required): accounts, sessions, wallets, contact messages and billboard bookings
  (ad media is stored in MongoDB GridFS).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optional): gold packs and billboard payments.
  Point a Stripe webhook at `/api/stripe/webhook` for `checkout.session.completed`; it is the
  only thing that credits gold and activates bookings.
- `ADMIN_USERNAMES` (optional): comma-separated admin usernames. Empty means no admins.
- `PORT`, `MP_PORT` (optional).

## Production build

```bash
npm run build
npm start
```

`npm start` runs `server/prod.mjs`: the Next.js app and the multiplayer relay (at `/mp`) on one
port (`PORT`, default 3000). Serve it over `https`: that is when the games use `wss://<host>/mp`
(over plain `http` they look for the development relay on port 8031). `npm run start:web` runs
plain `next start` without multiplayer. The included `Dockerfile` builds the same thing as an image.

## Run Arcade 3D on Harakumo

Arcade 3D is open source (MIT) and listed on [Nucleus](https://nucleus.harakumo.com/-/explore),
Harakumo's code home. It is a Node server (Next.js plus a WebSocket relay), so on Harakumo it runs
as a **server app (Pro plan and up)**, not a static site.

1. **Create a project** at [harakumo.com/dashboard](https://harakumo.com/dashboard) → Projects → New project.
2. **Create an API key** under Settings → API keys.
3. **Add the environment** (Project → Environment) from `.env.example`: `MONGODB_URI` (MongoDB is
   required for now), `ADMIN_USERNAMES`, and the Stripe keys if you want payments.
4. **Deploy** from a folder with the CLI, or ask your AI assistant with the Harakumo connector:

   ```bash
   npm i -g @harakumo/cli
   harakumo login --key <your API key>
   harakumo deploy <project id> .
   ```

   Every deploy is saved as a commit in the project's private Nucleus repo.

Notes:

- **Multiplayer state lives in the server's memory**: a redeploy ends the current matches.
- **Your MongoDB must accept the server's connections**: allow its address range, and use a
  database user limited to this database.
- **Billboard media goes live as soon as it is paid for.** There is no review step; check
  bookings in `/admin` if you take real advertisers.

## A note on names

The Rocket Mission and the launch pad in Explore teach how modern reusable rockets work and name
real launch vehicles for that purpose. Arcade 3D is not affiliated with or
endorsed by any company or product it mentions.

## License

[MIT](LICENSE) © 2026 Charan Raj Kandula
