// Minecraft has no single built-in score, so it ranks by accumulated playtime.
(function () {
  "use strict";
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "/g/mc") return;
  var playerName = "";
  try { playerName = (localStorage.getItem("arcadeLeaderboardPlayerName") || "").trim(); } catch (e) {}
  if (!playerName) {
    playerName = (window.prompt("Choose a name for the Minecraft playtime leaderboard (24 characters max):", "") || "").trim().slice(0, 24);
    if (playerName) try { localStorage.setItem("arcadeLeaderboardPlayerName", playerName); } catch (e) {}
  }
  if (!playerName || !window.ArcadeScores) return;
  var startedAt = Date.now(), submitted = false;
  function submitPlaytime() {
    if (submitted) return;
    submitted = true;
    var seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (seconds >= 5) window.ArcadeScores.submitSession("Minecraft", seconds, playerName);
  }
  window.addEventListener("pagehide", submitPlaytime);
  window.addEventListener("beforeunload", submitPlaytime);
})();