// Arcade Atlas leaderboard: original neon theme, game logos, top-three medal rows.
const ARCADE_ATLAS_API = "https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";
const MEDALS = ["🥇", "🥈", "🥉"];
const catalogLogos = new Map();
window.catalogLogos = catalogLogos;
function normalizeGameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\\s+time$/, "").replace(/[^a-z0-9]+/g, " ").trim();
}
window.getGameLogo = function (value) {
  const key = normalizeGameKey(value);
  return catalogLogos.get(key) || (key === "daily pick streak" ? "../images/daily-pick-streak.svg" : "../assets/arcade-atlas-logo.png");
};

async function loadCatalogLogos() {
  try {
    const response = await fetch("../games.json", { cache: "no-cache" });
    if (!response.ok) return;
    const data = await response.json();
    catalogLogos.set("daily pick streak", "../images/daily-pick-streak.svg");
    (data.games || []).forEach(game => {
      const key = String(game.title || "").trim().toLowerCase();
      const image = String(game.image || "").trim();
      if (!key || !image) return;
      const external = /^(https?:|data:|blob:|\/\/)/i.test(image);
      const resolved = external ? image : image.startsWith("/") ? image : "../" + image.replace(/^\.\//, "");
      catalogLogos.set(key, resolved);
      catalogLogos.set(normalizeGameKey(key), resolved);
    });
  } catch (error) {
    console.warn("Arcade Atlas: game image catalog unavailable.", error);
  }
}

function getGameImage(row) {
  const titleKey = normalizeGameKey(row.game_title);
  const gameKey = normalizeGameKey(row.game_key);
  return row.game_image || catalogLogos.get(titleKey) || catalogLogos.get(gameKey) ||
    (titleKey === "daily pick streak" || gameKey === "daily pick streak" ? "../images/daily-pick-streak.svg" : "../assets/arcade-atlas-logo.png");
}

function formatCookieClickerScore(value) {
  const raw = String(value ?? "—").trim();
  if (!/^\d+$/.test(raw)) return raw;
  const n = BigInt(raw);
  if (n === 0n) return "0";
  const names = [
    "", "thousand", "million", "billion", "trillion", "quadrillion",
    "quintillion", "sextillion", "septillion", "octillion", "nonillion",
    "decillion", "undecillion", "duodecillion", "tredecillion",
    "quattuordecillion", "quindecillion", "sexdecillion",
    "septendecillion", "octodecillion", "novemdecillion", "vigintillion"
  ];
  const group = Math.floor((raw.length - 1) / 3);
  if (group === 0) return n.toLocaleString("en-US");
  const exponent = raw.length - 1;
  const significant = raw.slice(0, 3);
  const mantissa = Number(significant) / (10 ** (significant.length - 1));
  const amount = mantissa.toFixed(2);
  if (group < names.length) return amount + " " + names[group];
  if (group <= 66) {
    const ones = ["", "un", "duo", "tre", "quattuor", "quin", "sex", "septen", "octo", "novem"];
    const tens = ["", "", "viginti", "triginta", "quadraginta", "quinquaginta", "sexaginta"];
    const ten = Math.floor(group / 10);
    const one = group % 10;
    const name = (one ? ones[one] : "") + tens[ten] + "illion";
    return amount + " " + name;
  }
  // Beyond 200 zeroes, keep the magnitude readable without Number precision loss.
  return amount + " × 10^" + exponent;
}

function formatScore(value, gameTitle) {
  if (String(gameTitle || "").trim().toLowerCase() === "cookie clicker") {
    return formatCookieClickerScore(value);
  }
  const raw = String(value ?? "—");
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return raw;
}

function makePodiumCard(row, rank) {
  const card = document.createElement("article");
  card.className = "podium-card podium-rank-" + rank;
  card.setAttribute("aria-label", "Rank " + rank + ": " + (row.player_name || "Unknown player"));
  const medal = document.createElement("div");
  medal.className = "podium-medal";
  medal.textContent = MEDALS[rank - 1];
  const place = document.createElement("p");
  place.className = "podium-place";
  place.textContent = rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place";
  const image = document.createElement("img");
  image.className = "podium-game-image";
  image.src = getGameImage(row);
  image.alt = (row.game_title || "Game") + " logo";
  image.onerror = () => { image.onerror = null; image.src = "../assets/arcade-atlas-logo.png"; };
  const player = document.createElement("h3");
  player.className = "podium-player";
  player.textContent = row.player_name || "Unknown player";
  const score = document.createElement("strong");
  score.className = "podium-score";
  score.textContent = formatScore(row.score, String(row.game_title || ""));
  const date = document.createElement("p");
  date.className = "podium-date";
  date.textContent = row.created_at ? new Date(row.created_at).toLocaleDateString() : "";
  card.append(medal, place, image, player, score, date);
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
      const headingImage = document.createElement("img");
      headingImage.className = "game-title-image";
      headingImage.src = getGameImage(gameRows[0]);
      headingImage.alt = "";
      headingImage.onerror = () => { headingImage.onerror = null; headingImage.src = "../assets/arcade-atlas-logo.png"; };
      const headingText = document.createElement("span");
      headingText.textContent = title;
      heading.append(headingImage, headingText);
      board.append(heading);
      const stage = document.createElement("div");
      stage.className = "podium-stage";
      gameRows.slice(0,3).forEach((row,index) => stage.append(makePodiumCard(row,index+1)));
      board.append(stage);
      list.append(board);
    });
  } catch (error) {
    console.error("Arcade Atlas leaderboard:", error);
    status.textContent = "The live leaderboard is temporarily unavailable. Please refresh to try again.";
  }
}
document.addEventListener("DOMContentLoaded", loadArcadeAtlasLeaderboard);
