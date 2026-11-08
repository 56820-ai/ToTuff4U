// Tracks total site time locally and submits playtime for games without a reliable
// readable score. The leaderboard stores seconds in the existing score column.
(function () {
  "use strict";
  function loadTimeSpent(key) {
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  function saveTimeSpent(key, time) { localStorage.setItem(key, String(time)); }
  function trackTimeSpent() {
    const totalKey = "totalTimeSpent";
    const startTime = Date.now();
    let saved = false;
    function save() {
      if (saved) return;
      saved = true;
      const seconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      if (seconds) saveTimeSpent(totalKey, loadTimeSpent(totalKey) + seconds);
    }
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
  }
  trackTimeSpent();

  const timedGames = {
    "/g/slope": "Slope",
    "/g/retro-bowl": "Retro Bowl",
    "/g/blockblast": "Block Blast",
    "/g/driftboss": "Drift Boss"
  };
  const path = location.pathname.replace(/\/+$/, "").toLowerCase();
  const gameTitle = timedGames[path];
  if (!gameTitle || !window.ArcadeScores) return;

  const nameKey = "arcadeLeaderboardPlayerName";
  let playerName = (localStorage.getItem(nameKey) || "").trim();
  if (!playerName) {
    playerName = (window.prompt("Choose a name for the Arcade Atlas leaderboard (you only need to do this once):", "") || "").trim().slice(0, 24);
    if (playerName) localStorage.setItem(nameKey, playerName);
  }
  if (!playerName) return;

  const startedAt = Date.now();
  let submitted = false;
  function submitPlaytime() {
    if (submitted) return;
    submitted = true;
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (seconds < 5) return;
    window.ArcadeScores.submitSession(gameTitle, seconds, playerName);
  }
  window.addEventListener("pagehide", submitPlaytime);
  window.addEventListener("beforeunload", submitPlaytime);
})();
