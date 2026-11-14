// Google Tag Manager container, initialized once per page.
(function () {
  if (window.__arcadeAtlasGTM_KHTBG5BX) return;
  window.__arcadeAtlasGTM_KHTBG5BX = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-KHTBG5BX';
  (document.head || document.documentElement).appendChild(s);
})();
// Minecraft 1.12.2 and Retro Bowl visible-playtime timer/leaderboard.
(function () {
  "use strict";
  // GitHub Pages serves this project beneath /ToTuff4U/, so match the
  // game route at the end of the path instead of requiring a root-domain path.
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  var isMinecraft = /\/g\/mc\/1\.12\.2$/.test(path);
  var isRetroBowl = /\/g\/retro-bowl$/.test(path);
  var isBlockyCombat = /\/g\/duckdb2-blocky-combat-swat-main$/.test(path);
  var miniGameTitles = { "neon-racer": "Neon Racer Time", "sky-hop": "Sky Hop Time", "asteroid-rush": "Asteroid Rush Time", "gem-maze": "Gem Maze Time", "color-clash": "Color Clash Time", "paddle-clash": "Paddle Clash Time", "whack-a-mole": "Whack-a-Mole Time" };
  var miniGameTitle = miniGameTitles[path.split("/").pop()] || "";
  if (!isMinecraft && !isRetroBowl && !isBlockyCombat && !miniGameTitle) return;
  var gameTitle = isRetroBowl ? "Retro Bowl Time" : isBlockyCombat ? "Blocky Combat SWAT Time" : miniGameTitle || "Minecraft";
  var playerName = "";
  try { playerName = (localStorage.getItem("arcadeLeaderboardPlayerName") || "").trim().slice(0, 24); } catch (e) {}
  

  var timer = document.createElement("div");
  timer.id = "arcade-playtime-timer";
  timer.setAttribute("role", "status");
  timer.textContent = "Playtime: 0d 0h 0m 0s";
  timer.style.cssText = "position:fixed;top:10px;right:10px;z-index:2147483647;padding:7px 11px;background:rgba(0,0,0,.82);color:#fff;border:1px solid #6bffd9;border-radius:8px;font:bold 14px/1.3 monospace;pointer-events:none;";
  (document.body || document.documentElement).appendChild(timer);

  // Persist the per-game total so restarting Blocky Combat does not reset it.
  var storageKey = "arcadeAtlasPlaytimeTotal:" + path;
  var totalSeconds = 0;
  try {
    var savedTotal = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(savedTotal) && savedTotal > 0) totalSeconds = Math.floor(savedTotal);
  } catch (e) {}
  var pendingSeconds = 0;
  var segmentStartedAt = document.visibilityState === "hidden" ? null : Date.now();
  var ended = false;
  function saveTotalSeconds() {
    try { localStorage.setItem(storageKey, String(totalSeconds)); } catch (e) {}
  }
  function formatTime(seconds) {
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return d + "d " + h + "h " + m + "m " + s + "s";
  }
  function updateTimer() {
    var seconds = totalSeconds;
    if (segmentStartedAt !== null) seconds += Math.floor((Date.now() - segmentStartedAt) / 1000);
    timer.textContent = "Playtime: " + formatTime(seconds);
  }
  function flushSegment() {
    if (segmentStartedAt === null) return;
    var segmentSeconds = Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
    totalSeconds += segmentSeconds;
    pendingSeconds += segmentSeconds;
    segmentStartedAt = null;
    saveTotalSeconds();
    updateTimer();
    if (pendingSeconds >= 5 && window.ArcadeScores && typeof window.ArcadeScores.submitSession === "function") {
      if (!playerName && typeof window.ArcadeScores.getPlayerName === "function") {
        playerName = window.ArcadeScores.getPlayerName("Enter your name for the " + gameTitle.replace(/ Time$/, "") + " playtime leaderboard (24 characters max):");
      }
      if (playerName) {
        var submittedSeconds = pendingSeconds;
        window.ArcadeScores.submitSession(gameTitle, submittedSeconds, playerName).then(function (ok) {
          if (ok) pendingSeconds = Math.max(0, pendingSeconds - submittedSeconds);
        }).catch(function () {});
      }
    }
  }
  function checkpointPlaytime() {
    if (ended || document.visibilityState === "hidden" || segmentStartedAt === null) return;
    flushSegment();
    if (!ended && document.visibilityState !== "hidden") {
      segmentStartedAt = Date.now();
      updateTimer();
    }
  }
  function onVisibilityChange() {
    if (document.visibilityState === "hidden") flushSegment();
    else if (!ended && segmentStartedAt === null) { segmentStartedAt = Date.now(); updateTimer(); }
  }
  function onPageHide() {
    if (ended) return;
    ended = true;
    flushSegment();
  }
  updateTimer();
  window.setInterval(updateTimer, 1000);
  // Send accumulated playtime every 30 seconds, not only when a tab closes.
  window.setInterval(checkpointPlaytime, 30000);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onPageHide);
})();
