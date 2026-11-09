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
// Minecraft and Retro Bowl rank by accumulated playtime per visit.
(function () {
  "use strict";
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "/g/mc" && path !== "/g/retro-bowl") return;
  var gameTitle = path === "/g/retro-bowl" ? "Retro Bowl Time" : "Minecraft";
  var playerName = "";
  try { playerName = (localStorage.getItem("arcadeLeaderboardPlayerName") || "").trim(); } catch (e) {}
  if (!playerName) {
    playerName = (window.prompt("Choose a name for the playtime leaderboard (24 characters max):", "") || "").trim().slice(0, 24);
    if (playerName) try { localStorage.setItem("arcadeLeaderboardPlayerName", playerName); } catch (e) {}
  }
  if (!playerName || !window.ArcadeScores) return;
  var startedAt = Date.now(), submitted = false;\n  // Submit on both navigation and tab close; the guard prevents duplicates.
  function submitPlaytime() {
    if (submitted) return;
    submitted = true;
    var seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (seconds >= 5) window.ArcadeScores.submitSession(gameTitle, seconds, playerName);
  }
  window.addEventListener("pagehide", submitPlaytime);\n  window.addEventListener("visibilitychange", function () {\n    if (document.visibilityState === "hidden") submitPlaytime();\n  });
  window.addEventListener("beforeunload", submitPlaytime);
})();