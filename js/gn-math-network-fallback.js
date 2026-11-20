/* Arcade Atlas GN Math CDN fallback.
 * Retries failed game assets through alternate public mirrors. This is asset
 * reliability logic, not a way to bypass school or network access controls.
 */
(function () {
  "use strict";
  if (window.__arcadeAtlasGnFallback) return;
  window.__arcadeAtlasGnFallback = true;

  function alternate(input) {
    try {
      var u = new URL(input, document.baseURI);
      var p = u.pathname;
      var next = null;
      if ((u.hostname === "cdn.jsdelivr.net" || u.hostname === "fastly.jsdelivr.net") && p.indexOf("/gh/") === 0) {
        var bits = p.slice(4).split("/");
        var owner = bits.shift(), repoRef = bits.shift();
        if (owner && repoRef) {
          var at = repoRef.indexOf("@");
          var repo = at < 0 ? repoRef : repoRef.slice(0, at);
          var ref = at < 0 ? "main" : repoRef.slice(at + 1);
          next = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + ref + "/" + bits.join("/");
        }
      } else if (u.hostname === "raw.githubusercontent.com") {
        var parts = p.slice(1).split("/");
        if (parts.length >= 3) {
          var o = parts.shift(), r = parts.shift(), branch = parts.shift();
          next = "https://cdn.jsdelivr.net/gh/" + o + "/" + r + "@" + branch + "/" + parts.join("/");
        }
      } else if (u.hostname === "cdn.jsdelivr.net" && p.indexOf("/npm/") === 0) {
        next = "https://unpkg.com/" + p.slice(5);
      } else if (u.hostname === "unpkg.com") {
        next = "https://cdn.jsdelivr.net/npm/" + p.slice(1);
      }
      return next ? next + u.search + u.hash : null;
    } catch (_) { return null; }
  }

  // Retry failed HTML resources such as scripts, stylesheets, images, and media.
  document.addEventListener("error", function (event) {
    var el = event.target;
    if (!el || !el.getAttribute) return;
    var attr = el.hasAttribute("src") ? "src" : (el.hasAttribute("href") ? "href" : null);
    if (!attr || el.getAttribute("data-aa-fallback-used") === "1") return;
    var next = alternate(el[attr] || el.getAttribute(attr));
    if (!next) return;
    el.setAttribute("data-aa-fallback-used", "1");
    console.warn("[Arcade Atlas] Retrying game asset on alternate mirror:", next);
    el.setAttribute(attr, next);
  }, true);

  // Retry fetch-based game assets, including many engine data requests.
  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url);
      var next = url && alternate(url);
      if (!next) return nativeFetch(input, init);
      var retryInput;
      try { retryInput = typeof input === "string" ? next : new Request(next, input.clone()); }
      catch (_) { retryInput = next; }
      return nativeFetch(input, init).then(function (response) {
        if (response.ok || response.status < 500) return response;
        return nativeFetch(retryInput, init).then(function (retry) {
          return retry.ok ? retry : response;
        }).catch(function () { return response; });
      }).catch(function () {
        return nativeFetch(retryInput, init);
      });
    };
  }
})();
