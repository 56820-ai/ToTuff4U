// Arcade Atlas leaderboard: original neon theme, game logos, top-three medal rows.
const ARCADE_ATLAS_API = "https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";
const MEDALS = ["🥇", "🥈", "🥉"];
const catalogLogos = new Map();
window.catalogLogos = catalogLogos;
function normalizeGameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+time$/, "").replace(/[^a-z0-9]+/g, " ").trim();
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
    const tens = ["", "", "vigint", "trigint", "quadragint", "quinquagint", "sexagint"];
    const ten = Math.floor(group / 10);
    const one = group % 10;
    const name = (one ? ones[one] : "") + tens[ten] + "illion";
    return amount + " " + name;
  }
  // Beyond 200 zeroes, keep the magnitude readable without Number precision loss.
  return amount + " × 10^" + exponent;
}

function formatDurationSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [];
  if (days) parts.push(days + "d");
  if (hours || days) parts.push(hours + "h");
  if (minutes || hours || days) parts.push(minutes + "m");
  if (seconds || !parts.length) parts.push(seconds + "s");
  return parts.join(" ");
}

function formatReactionTime(value) {
  const elapsedMs = Math.max(0, 10000 - Number(value));
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = ((elapsedMs % 60000) / 1000).toFixed(3).padStart(6, "0");
  return minutes + ":" + seconds;
}

function formatScore(value, gameTitle) {
  const title = String(gameTitle || "").trim().toLowerCase();
  if (title.includes("reaction test")) return formatReactionTime(value);
  if (title.endsWith(" time") || title === "minecraft") return formatDurationSeconds(value);
  if (title.includes("cookie clicker")) return formatCookieClickerScore(value);
  const raw = String(value ?? "—");
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw).toLocaleString("en-US", { maximumFractionDigits: 3 });
  return raw;
}

// Expose pure formatters for the browser audit and keep score formatting consistent.
window.arcadeAtlasFormatScore = formatScore;
window.arcadeAtlasFormatCookieClickerScore = formatCookieClickerScore;

function makeScoreRow(row, rank) {
  const card = document.createElement("article");
  card.className = "score-row rank-" + rank;
  const rankLabel = document.createElement("span");
  rankLabel.className = "score-rank";
  rankLabel.textContent = rank === 1 ? "🥇 1" : rank === 2 ? "🥈 2" : "🥉 3";
  const image = document.createElement("img");
  image.className = "score-game-image";
  image.src = getGameImage(row);
  image.alt = (row.game_title || "Game") + " logo";
  image.onerror = () => { image.onerror = null; image.src = "../assets/arcade-atlas-logo.png"; };
  const playerInfo = document.createElement("div");
  playerInfo.className = "score-player-info";
  const player = document.createElement("strong");
  player.className = "score-player";
  player.textContent = row.player_name || "Unknown player";
  const date = document.createElement("span");
  date.className = "score-date";
  date.textContent = row.created_at ? new Date(row.created_at).toLocaleDateString() : "";
  playerInfo.append(player, date);
  const score = document.createElement("strong");
  score.className = "score-value";
  score.textContent = formatScore(row.score, [row.game_title, row.game_key].filter(Boolean).join(" "));
  card.append(rankLabel, image, playerInfo, score);
  return card;
}

async function loadArcadeAtlasLeaderboard() {
  const list = document.getElementById("score-list");
  if (!list) return;
  list.innerHTML = '<p class="leaderboard-status">Loading scores…</p>';
  try {
    await loadCatalogLogos();
    const response = await fetch(ARCADE_ATLAS_API + "/scores", {
      method: "GET", headers: { Accept: "application/json" }, cache: "no-store"
    });
    if (!response.ok) throw new Error("Leaderboard request failed (" + response.status + ").");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid leaderboard response.");
    list.innerHTML = "";
    const grouped = new Map();
    rows.filter(row => Number(row.score) > 0).forEach(row => {
      const key = String(row.game_key || row.game_title || "other").trim().toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    if (!grouped.size) {
      list.innerHTML = '<p class="leaderboard-status">No scores have been submitted yet.</p>';
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "leaderboard-tools";
    toolbar.innerHTML = '<label class="search-wrap"><span>Find a game</span><input id="game-search" type="search" placeholder="Search games…" autocomplete="off"></label><label class="sort-wrap"><span>Jump to game</span><select id="game-jump"><option value="">All games</option></select></label><span class="game-count" id="game-count"></span>';
    list.append(toolbar);
    const boards = [];
    [...grouped.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([gameKey, sourceRows]) => {
      let gameRows = sourceRows;
      if (gameKey === "daily pick streak") {
        const bestByPlayer = new Map();
        gameRows.forEach(row => {
          const playerKey = String(row.player_name || "Unknown player").trim().toLowerCase();
          const prior = bestByPlayer.get(playerKey);
          let isBetter = !prior;
          if (prior) {
            try {
              const score = BigInt(String(row.score));
              const priorScore = BigInt(String(prior.score));
              isBetter = score > priorScore || (score === priorScore && new Date(row.created_at || 0) > new Date(prior.created_at || 0));
            } catch { isBetter = Number(row.score) > Number(prior.score); }
          }
          if (isBetter) bestByPlayer.set(playerKey, row);
        });
        gameRows = [...bestByPlayer.values()];
      }
      if (!gameRows.length) return;
      const title = gameRows[0].game_title || "Game";
      gameRows.sort((a,b) => {
        if (String(title).toLowerCase() === "cookie clicker") {
          try { const x=BigInt(String(a.score)); const y=BigInt(String(b.score)); return x===y?0:x>y?-1:1; } catch {}
        }
        return Number(b.score) - Number(a.score);
      });
      const board = document.createElement("section");
      board.className = "game-board";
      board.id = "game-" + normalizeGameKey(gameKey).replace(/\s+/g, "-");
      const heading = document.createElement("h2");
      heading.className = "game-board-title";
      const headingImage = document.createElement("img");
      headingImage.className = "game-title-image";
      headingImage.src = getGameImage(gameRows[0]);
      headingImage.alt = "";
      headingImage.onerror = () => { headingImage.onerror = null; headingImage.src = "../assets/arcade-atlas-logo.png"; };
      const headingText = document.createElement("span");
      headingText.textContent = title;
      const total = document.createElement("span");
      total.className = "game-board-total";
      total.textContent = gameRows.length + (gameRows.length === 1 ? " score" : " scores");
      heading.append(headingImage, headingText, total);
      board.append(heading);
      const entries = document.createElement("div");
      entries.className = "score-rows";
      gameRows.slice(0,3).forEach((row,index) => entries.append(makeScoreRow(row,index+1)));
      board.append(entries);
      list.append(board);
      boards.push({board,title});
      const option=document.createElement("option");
      option.value=board.id;
      option.textContent=title;
      document.getElementById("game-jump").append(option);
    });

    const search=document.getElementById("game-search");
    const jump=document.getElementById("game-jump");
    const count=document.getElementById("game-count");
    const filterBoards=()=>{
      const query=search.value.trim().toLowerCase();
      let visible=0;
      boards.forEach(({board,title})=>{
        const show=title.toLowerCase().includes(query);
        board.hidden=!show;
        if(show) visible++;
      });
      count.textContent=visible+" of "+boards.length+" games";
      if(jump.value && !document.getElementById(jump.value)?.hidden) {
        document.getElementById(jump.value)?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    };
    search.addEventListener("input",()=>{
      jump.value="";
      filterBoards();
    });
    jump.addEventListener("change",()=>{
      search.value="";
      filterBoards();
      if(jump.value) document.getElementById(jump.value)?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    filterBoards();
  } catch (error) {
    console.error("Arcade Atlas leaderboard:", error);
    list.innerHTML = '<p class="leaderboard-status">The live leaderboard is temporarily unavailable. Please refresh to try again.</p>';
  }
}

document.addEventListener("DOMContentLoaded", loadArcadeAtlasLeaderboard);
