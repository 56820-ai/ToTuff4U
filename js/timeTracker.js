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