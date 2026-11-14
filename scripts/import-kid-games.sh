#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/abagames/crisp-game-lib-games.git"
DEST="g/one-button-collection"
TMP="$(mktemp -d)"
SOURCE="$TMP/crisp-game-lib-games"

slugs=(
  rebirth intow castn thunder descents laserfortress froooog rwheel pizzaarrow thrustlr accelb futurewake updownpress ladderdrop counterb mrider chargebeam sshake zoneb mjamming tlanes lrain scrambird dlaser islash raid catapult rring tpunch dfight ballsbombs dmissile vbomb dpistols grenadier bcannon hyperlaser bombup upshot rolls bblast smokeg mortar turbulent graveler throwm orbitman embattled udcave darkcave
)

if [[ "${#slugs[@]}" -ne 50 ]]; then
  echo "Expected exactly 50 game slugs, found ${#slugs[@]}" >&2
  exit 1
fi

git clone --depth 1 --filter=blob:none --sparse "$REPO" "$SOURCE"
cd "$SOURCE"
patterns=(LICENSE.txt README.md docs/index.html)
for slug in "${slugs[@]}"; do
  patterns+=("docs/$slug/**")
done
git sparse-checkout set --no-cone "${patterns[@]}"
source_commit="$(git rev-parse HEAD)"
cd "$GITHUB_WORKSPACE"

rm -rf "$DEST"
mkdir -p "$DEST"
cp "$SOURCE/docs/index.html" "$DEST/index.html"
cp "$SOURCE/LICENSE.txt" "$DEST/LICENSE.txt"
cp "$SOURCE/README.md" "$DEST/README-UPSTREAM.md"

for slug in "${slugs[@]}"; do
  test -s "$SOURCE/docs/$slug/main.js"
  test -s "$SOURCE/docs/$slug/screenshot.gif"
  mkdir -p "$DEST/$slug"
  cp "$SOURCE/docs/$slug/main.js" "$DEST/$slug/main.js"
  cp "$SOURCE/docs/$slug/screenshot.gif" "$DEST/$slug/screenshot.gif"
done

cat > "$RUNNER_TEMP/games-additions.json" <<'GAMES'
[
  {
    "title": "Rebirth",
    "slug": "rebirth"
  },
  {
    "title": "In Tow",
    "slug": "intow"
  },
  {
    "title": "Cast N",
    "slug": "castn"
  },
  {
    "title": "Thunder",
    "slug": "thunder"
  },
  {
    "title": "Descent S",
    "slug": "descents"
  },
  {
    "title": "Laser Fortress",
    "slug": "laserfortress"
  },
  {
    "title": "Froooog",
    "slug": "froooog"
  },
  {
    "title": "R Wheel",
    "slug": "rwheel"
  },
  {
    "title": "Pizza Arrow",
    "slug": "pizzaarrow"
  },
  {
    "title": "Thrust LR",
    "slug": "thrustlr"
  },
  {
    "title": "Accel B",
    "slug": "accelb"
  },
  {
    "title": "Future Wake",
    "slug": "futurewake"
  },
  {
    "title": "Up Down Press",
    "slug": "updownpress"
  },
  {
    "title": "Ladder Drop",
    "slug": "ladderdrop"
  },
  {
    "title": "Counter B",
    "slug": "counterb"
  },
  {
    "title": "M Rider",
    "slug": "mrider"
  },
  {
    "title": "Charge Beam",
    "slug": "chargebeam"
  },
  {
    "title": "S Shake",
    "slug": "sshake"
  },
  {
    "title": "Zone B",
    "slug": "zoneb"
  },
  {
    "title": "M Jamming",
    "slug": "mjamming"
  },
  {
    "title": "T Lanes",
    "slug": "tlanes"
  },
  {
    "title": "L Rain",
    "slug": "lrain"
  },
  {
    "title": "Scrambird",
    "slug": "scrambird"
  },
  {
    "title": "D Laser",
    "slug": "dlaser"
  },
  {
    "title": "I Slash",
    "slug": "islash"
  },
  {
    "title": "Raid",
    "slug": "raid"
  },
  {
    "title": "Catapult",
    "slug": "catapult"
  },
  {
    "title": "R Ring",
    "slug": "rring"
  },
  {
    "title": "T Punch",
    "slug": "tpunch"
  },
  {
    "title": "D Fight",
    "slug": "dfight"
  },
  {
    "title": "Balls Bombs",
    "slug": "ballsbombs"
  },
  {
    "title": "D Missile",
    "slug": "dmissile"
  },
  {
    "title": "V Bomb",
    "slug": "vbomb"
  },
  {
    "title": "D Pistols",
    "slug": "dpistols"
  },
  {
    "title": "Grenadier",
    "slug": "grenadier"
  },
  {
    "title": "B Cannon",
    "slug": "bcannon"
  },
  {
    "title": "Hyper Laser",
    "slug": "hyperlaser"
  },
  {
    "title": "Bomb Up",
    "slug": "bombup"
  },
  {
    "title": "Up Shot",
    "slug": "upshot"
  },
  {
    "title": "Roll S",
    "slug": "rolls"
  },
  {
    "title": "B Blast",
    "slug": "bblast"
  },
  {
    "title": "Smoke G",
    "slug": "smokeg"
  },
  {
    "title": "Mortar",
    "slug": "mortar"
  },
  {
    "title": "Turbulent",
    "slug": "turbulent"
  },
  {
    "title": "Graveler",
    "slug": "graveler"
  },
  {
    "title": "Throw M",
    "slug": "throwm"
  },
  {
    "title": "Orbit Man",
    "slug": "orbitman"
  },
  {
    "title": "Embattled",
    "slug": "embattled"
  },
  {
    "title": "UD Cave",
    "slug": "udcave"
  },
  {
    "title": "Dark Cave",
    "slug": "darkcave"
  }
]
GAMES

node <<'NODE'
const fs = require("node:fs");
const additions = JSON.parse(fs.readFileSync(process.env.RUNNER_TEMP + "/games-additions.json", "utf8"));
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const catalog = JSON.parse(fs.readFileSync("games.json", "utf8"));
catalog.games = catalog.games.filter(game => !String(game.path || "").startsWith("g/one-button-collection/?"));
for (const item of additions) {
  const path = "g/one-button-collection/?" + item.slug;
  const existing = catalog.games.find(game => normalize(game.title) === normalize(item.title));
  if (existing) {
    if (existing.path !== path) throw new Error("Conflicting title already exists: " + item.title);
    continue;
  }
  catalog.games.push({
    title: item.title,
    path,
    image: "g/one-button-collection/" + item.slug + "/screenshot.gif",
    category: "ARCADE"
  });
}
const imported = catalog.games.filter(game => String(game.path || "").startsWith("g/one-button-collection/?"));
if (imported.length !== 50) throw new Error("Expected 50 catalog entries, found " + imported.length);
if (catalog.games.some(game => String(game.path || "").includes("duckmath-site"))) {
  throw new Error("DuckMath games unexpectedly appeared in games.json");
}
for (const item of additions) {
  if (!fs.existsSync("g/one-button-collection/" + item.slug + "/main.js")) throw new Error("Missing source: " + item.slug);
  if (!fs.existsSync("g/one-button-collection/" + item.slug + "/screenshot.gif")) throw new Error("Missing thumbnail: " + item.slug);
}
fs.writeFileSync("games.json", JSON.stringify(catalog, null, 2) + "\n");
console.log("Verified replacement pack of 50 action/skill games. Total catalog: " + catalog.games.length);
NODE

cat > "$DEST/ATTRIBUTION.txt" <<EOF
Source repository: https://github.com/abagames/crisp-game-lib-games
Upstream author: abagames
License: MIT (see LICENSE.txt and README-UPSTREAM.md)
Upstream commit: $source_commit
Game source files and screenshots are stored locally. The upstream index.html loads crisp-game-lib and helper libraries from their published CDN URLs.
EOF

node -e 'JSON.parse(require("node:fs").readFileSync("games.json","utf8")); console.log("games.json is valid JSON")'

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add games.json "$DEST"
if git diff --cached --quiet; then
  echo "All 50 games are already imported; no commit needed."
  exit 0
fi
git commit -m "Add 50 kid-friendly browser games"
git pull --rebase origin main
git push
