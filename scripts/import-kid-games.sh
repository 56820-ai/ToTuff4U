#!/usr/bin/env bash
set -euo pipefail

# Remove the previous 50-game one-button collection completely.
DEST="g/one-button-collection"
node <<'NODE'
const fs = require("node:fs");
const catalog = JSON.parse(fs.readFileSync("games.json", "utf8"));
const before = catalog.games.length;
catalog.games = catalog.games.filter(game => !String(game.path || "").startsWith("g/one-button-collection/?"));
const removed = before - catalog.games.length;
if (removed !== 50) throw new Error("Expected to remove exactly 50 imported games; found " + removed);
fs.writeFileSync("games.json", JSON.stringify(catalog, null, 2) + "\n");
console.log("Removed " + removed + " catalog entries. Remaining games: " + catalog.games.length);
NODE
rm -rf "$DEST"
node -e 'JSON.parse(require("node:fs").readFileSync("games.json","utf8")); console.log("games.json is valid JSON")'
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A games.json "$DEST"
if git diff --cached --quiet; then
  echo "No imported collection remains."
  exit 0
fi
git commit -m "Remove obscure one-button game collection"
git pull --rebase origin main
git push
