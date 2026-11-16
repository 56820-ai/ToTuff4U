// Arcade Atlas leaderboard — Neon PostgreSQL API.
const ARCADE_ATLAS_API = "https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";

function makeScoreCard(row) {
  const card = document.createElement("article");
  card.className = "score-card";
  const text = document.createElement("div");
  text.className = "card-text-align";
  const game = document.createElement("h2");
  game.className = "card-text";
  game.textContent = "Game: " + (row.game_title || "Unknown game");
  const player = document.createElement("p");
  player.className = "card-text";
  player.textContent = "Player: " + (row.player_name || "Unknown");
  const score = document.createElement("p");
  score.className = "card-text";
  score.textContent = "Score: " + String(row.score ?? "—");
  const date = document.createElement("p");
  date.className = "card-text";
  date.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : "";
  text.append(game, player, score, date);
  card.append(text);
  return card;
}

async function loadArcadeAtlasLeaderboard() {
  const main = document.getElementById("main");
  if (!main) return;
  const status = document.createElement("p");
  status.id = "leaderboard-status";
  status.className = "leaderboard-status";
  status.style.cssText = "text-align:center;color:white;font-size:1.1rem;margin:1.5rem auto;";
  status.textContent = "Loading live scores…";
  main.append(status);

  try {
    const response = await fetch(ARCADE_ATLAS_API + "/scores", {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Leaderboard request failed (" + response.status + ").");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("The API returned an invalid leaderboard.");
    status.remove();
    if (rows.length === 0) {
      status.textContent = "No scores have been submitted yet. Be the first!";
      main.append(status);
      return;
    }
    const heading = document.createElement("h2");
    heading.textContent = "Live Leaderboard";
    heading.style.cssText = "text-align:center;color:white;margin:2rem 0 1rem;";
    main.append(heading);
    rows.forEach(row => main.append(makeScoreCard(row)));
  } catch (error) {
    console.error("Arcade Atlas leaderboard:", error);
    status.textContent = "The live leaderboard is temporarily unavailable. Please refresh to try again.";
  }
}

document.addEventListener("DOMContentLoaded", loadArcadeAtlasLeaderboard);
