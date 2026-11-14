#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/abagames/crisp-game-lib-games.git"
DEST="g/one-button-collection"
TMP="$(mktemp -d)"
SOURCE="$TMP/crisp-game-lib-games"

slugs=(
  tappump gpress portalj circlew revolvea mrider tlanes holes flipo thanoi
  sumten ttfence ctower growth geocent bsfish gtail breedc kite intow
  snaky wiper rwheel zoomio numberline lineb makemaze squarebar teeter reflector
  liftup rps numberball mirrorfloor crossline subjump scaffold aerialbar pinclimb
  parking balance bamboo froooog findastar pairsdrop cardq shiny floater hoppingp
  updownpress
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
    "title": "Tap Pump",
    "slug": "tappump"
  },
  {
    "title": "G Press",
    "slug": "gpress"
  },
  {
    "title": "Portal Jump",
    "slug": "portalj"
  },
  {
    "title": "Circle W",
    "slug": "circlew"
  },
  {
    "title": "Revolve A",
    "slug": "revolvea"
  },
  {
    "title": "M Rider",
    "slug": "mrider"
  },
  {
    "title": "T Lanes",
    "slug": "tlanes"
  },
  {
    "title": "Holes",
    "slug": "holes"
  },
  {
    "title": "Flip O",
    "slug": "flipo"
  },
  {
    "title": "Tower of Hanoi",
    "slug": "thanoi"
  },
  {
    "title": "Sum Ten",
    "slug": "sumten"
  },
  {
    "title": "TT Fence",
    "slug": "ttfence"
  },
  {
    "title": "C Tower",
    "slug": "ctower"
  },
  {
    "title": "Growth",
    "slug": "growth"
  },
  {
    "title": "GeoCent",
    "slug": "geocent"
  },
  {
    "title": "BS Fish",
    "slug": "bsfish"
  },
  {
    "title": "G Tail",
    "slug": "gtail"
  },
  {
    "title": "Breed C",
    "slug": "breedc"
  },
  {
    "title": "Kite",
    "slug": "kite"
  },
  {
    "title": "In Tow",
    "slug": "intow"
  },
  {
    "title": "Snaky",
    "slug": "snaky"
  },
  {
    "title": "Wiper",
    "slug": "wiper"
  },
  {
    "title": "R Wheel",
    "slug": "rwheel"
  },
  {
    "title": "Zoomio",
    "slug": "zoomio"
  },
  {
    "title": "Number Line",
    "slug": "numberline"
  },
  {
    "title": "Line B",
    "slug": "lineb"
  },
  {
    "title": "Make Maze",
    "slug": "makemaze"
  },
  {
    "title": "Square Bar",
    "slug": "squarebar"
  },
  {
    "title": "Teeter",
    "slug": "teeter"
  },
  {
    "title": "Reflector",
    "slug": "reflector"
  },
  {
    "title": "Lift Up",
    "slug": "liftup"
  },
  {
    "title": "Rock Paper Scissors",
    "slug": "rps"
  },
  {
    "title": "Number Ball",
    "slug": "numberball"
  },
  {
    "title": "Mirror Floor",
    "slug": "mirrorfloor"
  },
  {
    "title": "Cross Line",
    "slug": "crossline"
  },
  {
    "title": "Sub Jump",
    "slug": "subjump"
  },
  {
    "title": "Scaffold",
    "slug": "scaffold"
  },
  {
    "title": "Aerial Bar",
    "slug": "aerialbar"
  },
  {
    "title": "Pin Climb",
    "slug": "pinclimb"
  },
  {
    "title": "Parking",
    "slug": "parking"
  },
  {
    "title": "Balance",
    "slug": "balance"
  },
  {
    "title": "Bamboo",
    "slug": "bamboo"
  },
  {
    "title": "Froooog",
    "slug": "froooog"
  },
  {
    "title": "Find a Star",
    "slug": "findastar"
  },
  {
    "title": "Pairs Drop",
    "slug": "pairsdrop"
  },
  {
    "title": "Card Q",
    "slug": "cardq"
  },
  {
    "title": "Shiny",
    "slug": "shiny"
  },
  {
    "title": "Floater",
    "slug": "floater"
  },
  {
    "title": "Hopping P",
    "slug": "hoppingp"
  },
  {
    "title": "Up Down Press",
    "slug": "updownpress"
  }
]
GAMES

node <<'NODE'
const fs = require("node:fs");
const additions = JSON.parse(fs.readFileSync(process.env.RUNNER_TEMP + "/games-additions.json", "utf8"));
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const catalog = JSON.parse(fs.readFileSync("games.json", "utf8"));
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
console.log("Verified 50 new game entries. Total catalog: " + catalog.games.length);
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
