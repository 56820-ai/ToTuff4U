// Arcade Atlas leaderboard: original neon theme, game logos, top-three medal rows.
const ARCADE_ATLAS_API = "https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";
const MEDALS = ["🥇", "🥈", "🥉"];
const catalogLogos = new Map();

async function loadCatalogLogos() {
  try {
    const response = await fetch("../games.json", { cache: "no-cache" });
    if (!response.ok) return;
    const data = await response.json();
    (data.games || []).forEach(game => {
      const key = String(game.title || "").trim().toLowerCase();
      const image = String(game.image || "").trim();
      if (!key || !image) return;
      const external = /^(https?:|data:|blob:|\/\/)/i.test(image);
      const resolved = external ? image : image.startsWith("/") ? image : "../" + image.replace(/^\.\//, "");
      catalogLogos.set(key, resolved);
    });
  } catch (error) {
    console.warn("Arcade Atlas: game image catalog unavailable.", error);
  }
}

function getGameImage(row) {
  const title = String(row.game_title || "").trim().toLowerCase();
  const alias = title === "retro bowl time" ? "retro bowl" :
    title === "blocky combat swat time" ? "blocky combat swat" : title;
  return row.game_image || catalogLogos.get(alias) || "../assets/arcade-atlas-logo.png";
}

function formatScore(value, gameTitle) {
  const raw = String(value ?? "—");
  if (gameTitle.toLowerCase() === "cookie clicker" && /^\d+$/.test(raw)) {
    const n = BigInt(raw);
    if (n >= 1000000000000n) return (Number(n / 1000000000n) / 1000).toLocaleString("en-US", {maximumFractionDigits:3}) + " trillion";
    return n.toLocaleString("en-US");
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw).toLocaleString("en-US", {maximumFractionDigits:3});
  return raw;
}

function makeScoreCard(row, rank) {
  const card = document.createElement("article");
  card.className = "score-card";
  const medal = document.createElement("div");
  medal.className = "rank-medal";
  medal.textContent = MEDALS[rank - 1] || String(rank);
  const imageWrap = document.createElement("div");
  imageWrap.className = "game-icon-container";
  const image = document.createElement("img");
  image.className = "game-icon";
  image.src = getGameImage(row);
  image.alt = (row.game_title || "Game") + " logo";
  image.onerror = () => { image.onerror = null; image.src = "../assets/arcade-atlas-logo.png"; };
  imageWrap.append(image);
  const text = document.createElement("div");
  text.className = "card-text-align";
  const player = document.createElement("h3");
  player.className = "player-name";
  player.textContent = row.player_name || "Unknown player";
  const game = document.createElement("p");
  game.className = "game-name";
  game.textContent = row.game_title || "Unknown game";
  const date = document.createElement("p");
  date.className = "score-date";
  date.textContent = row.created_at ? new Date(row.created_at).toLocaleDateString() : "";
  text.append(player, game, date);
  const score = document.createElement("div");
  score.className = "leaderboard-score";
  score.textContent = formatScore(row.score, String(row.game_title || ""));
  card.append(medal, imageWrap, text, score);
  return card;
}

async function loadArcadeAtlasLeaderboard() {
  const list = document.getElementById("score-list");
  if (!list) return;
  const status = document.createElement("p");
  status.className = "leaderboard-status";
  status.textContent = "Loading live scores…";
  list.append(status);
  try {
    await loadCatalogLogos();
    const response = await fetch(ARCADE_ATLAS_API + "/scores", {
      method: "GET", headers: { Accept: "application/json" }, cache: "no-store"
    });
    if (!response.ok) throw new Error("Leaderboard request failed (" + response.status + ").");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid leaderboard response.");
    status.remove();
    const grouped = new Map();
    rows.filter(row => Number(row.score) > 0).forEach(row => {
      const key = String(row.game_key || row.game_title || "other").trim().toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    if (!grouped.size) {
      status.textContent = "No scores have been submitted yet.";
      list.append(status);
      return;
    }
    [...grouped.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([, gameRows]) => {
      const title = gameRows[0].game_title || "Game";
      gameRows.sort((a,b) => {
        if (title.toLowerCase() === "cookie clicker") {
          try { const x=BigInt(String(a.score)); const y=BigInt(String(b.score)); return x===y?0:x>y?-1:1; } catch {}
        }
        return Number(b.score) - Number(a.score);
      });
      const board = document.createElement("section");
      board.className = "game-board";
      const heading = document.createElement("h2");
      heading.className = "game-board-title";
      heading.textContent = title;
      board.append(heading);
      gameRows.slice(0,3).forEach((row,index) => board.append(makeScoreCard(row,index+1)));
      list.append(board);
    });
  } catch (error) {
    console.error("Arcade Atlas leaderboard:", error);
    status.textContent = "The live leaderboard is temporarily unavailable. Please refresh to try again.";
  }
}
document.addEventListener("DOMContentLoaded", loadArcadeAtlasLeaderboard);
