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
// Minecraft 1.12.2 and Retro Bowl rank by accumulated visible playtime.
(function () {
  "use strict";
  var path = location.pathname.replace(/\\/+$/, "").toLowerCase();
  if (path !== "/g/mc/1.12.2" && path !== "/g/retro-bowl") return;

  var gameTitle = path === "/g/retro-bowl" ? "Retro Bowl Time" : "Minecraft";
  var playerName = "";
  try {
    playerName = (localStorage.getItem("arcadeLeaderboardPlayerName") || "").trim().slice(0, 24);
  } catch (e) {}
  if (!playerName) {
    playerName = (window.prompt("Choose a name for the playtime leaderboard (24 characters max):", "") || "").trim().slice(0, 24);
    if (playerName) try { localStorage.setItem("arcadeLeaderboardPlayerName", playerName); } catch (e) {}
  }
  if (!playerName || !window.ArcadeScores || typeof window.ArcadeScores.submitSession !== "function") return;

  var segmentStartedAt = document.visibilityState === "hidden" ? null : Date.now();
  var ended = false;

  // Submit each visible segment once. When the tab becomes visible again,
  // begin a fresh segment so hidden time is never counted.
  function flushSegment() {
    if (segmentStartedAt === null) return;
    var seconds = Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
    segmentStartedAt = null;
    if (seconds >= 5) {
      window.ArcadeScores.submitSession(gameTitle, seconds, playerName);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      flushSegment();
    } else if (!ended && segmentStartedAt === null) {
      segmentStartedAt = Date.now();
    }
  }

  function onPageHide() {
    if (ended) return;
    ended = true;
    flushSegment();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onPageHide);
})();
