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
  var path = location.pathname.replace(/\\/+$/, "").toLowerCase();
  if (path !== "/g/mc/1.12.2" && path !== "/g/retro-bowl") return;
  var gameTitle = path === "/g/retro-bowl" ? "Retro Bowl Time" : "Minecraft";
  var playerName = "";
  try { playerName = (localStorage.getItem("arcadeLeaderboardPlayerName") || "").trim().slice(0, 24); } catch (e) {}
  if (!playerName) playerName = "Uncontested";

  var timer = document.createElement("div");
  timer.id = "arcade-playtime-timer";
  timer.setAttribute("role", "status");
  timer.textContent = "Playtime: 00:00";
  timer.style.cssText = "position:fixed;top:10px;right:10px;z-index:2147483647;padding:7px 11px;background:rgba(0,0,0,.82);color:#fff;border:1px solid #6bffd9;border-radius:8px;font:bold 14px/1.3 monospace;pointer-events:none;";
  (document.body || document.documentElement).appendChild(timer);

  var totalSeconds = 0;
  var segmentStartedAt = document.visibilityState === "hidden" ? null : Date.now();
  var ended = false;
  function formatTime(seconds) {
    var h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return (h ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function updateTimer() {
    var seconds = totalSeconds;
    if (segmentStartedAt !== null) seconds += Math.floor((Date.now() - segmentStartedAt) / 1000);
    timer.textContent = "Playtime: " + formatTime(seconds);
  }
  function flushSegment() {
    if (segmentStartedAt === null) return;
    totalSeconds += Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
    segmentStartedAt = null;
    updateTimer();
    if (totalSeconds >= 5 && window.ArcadeScores && typeof window.ArcadeScores.submitSession === "function") {
      window.ArcadeScores.submitSession(gameTitle, totalSeconds, playerName);
      totalSeconds = 0;
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
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onPageHide);
})();
