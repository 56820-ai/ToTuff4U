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

  // Retry failed HTML resources such as scripts, stylesheets, images, and audio.
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

  // Retry dedicated workers if the first CDN host cannot serve the worker file.
  if (window.Worker) {
    var NativeWorker = window.Worker;
    window.Worker = function (url, options) {
      var original = new URL(url, document.baseURI).href;
      var fallback = alternate(original);
      var active = new NativeWorker(original, options);
      if (!fallback) return active;
      var listeners = {};
      var handlers = { message: null, error: null, messageerror: null };
      var retried = false;
      function attach(worker) {
        Object.keys(listeners).forEach(function (type) {
          listeners[type].forEach(function (entry) {
            worker.addEventListener(type, entry.listener, entry.options);
          });
        });
        Object.keys(handlers).forEach(function (type) {
          worker["on" + type] = handlers[type];
        });
      }
      active.addEventListener("error", function (event) {
        if (retried) return;
        retried = true;
        try { event.preventDefault(); } catch (_) {}
        active.terminate();
        try {
          active = new NativeWorker(fallback, options);
          attach(active);
        } catch (error) {
          if (handlers.error) handlers.error.call(proxy, error);
        }
      });
      var proxy = new Proxy(active, {
        get: function (_, property) {
          if (property === "postMessage") return function () { return active.postMessage.apply(active, arguments); };
          if (property === "terminate") return function () { return active.terminate(); };
          if (property === "addEventListener") return function (type, listener, opts) {
            (listeners[type] = listeners[type] || []).push({ listener: listener, options: opts });
            active.addEventListener(type, listener, opts);
          };
          if (property === "removeEventListener") return function (type, listener, opts) {
            if (listeners[type]) listeners[type] = listeners[type].filter(function (entry) { return entry.listener !== listener; });
            active.removeEventListener(type, listener, opts);
          };
          if (property === "onmessage" || property === "onerror" || property === "onmessageerror") return handlers[property.slice(2)];
          var value = active[property];
          return typeof value === "function" ? value.bind(active) : value;
        },
        set: function (_, property, value) {
          if (property === "onmessage" || property === "onerror" || property === "onmessageerror") {
            handlers[property.slice(2)] = value;
            active[property] = value;
            return true;
          }
          active[property] = value;
          return true;
        }
      });
      return proxy;
    };
    window.Worker.prototype = NativeWorker.prototype;
  }
})();
