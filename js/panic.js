// Google Tag Manager — guarded so pages loading multiple shared scripts
// still initialize the container only once.
(function () {
  if (window.__arcadeAtlasGTM_KHTBG5BX) return;
  window.__arcadeAtlasGTM_KHTBG5BX = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-KHTBG5BX';
  (document.head || document.documentElement).appendChild(script);
})(); 

// panicButton.js
document.addEventListener('DOMContentLoaded', function () {
    // Load saved keybind and URL from localStorage
    const savedKeybind = localStorage.getItem('customKeybind') || '\\'; // Default to '\' if not set
    const savedUrl = localStorage.getItem('customUrl') || 'https://www.google.com'; // Default URL if not set

    // Function to redirect without allowing back navigation
    function changeUrlWithoutRedirect(url) {
        window.location.replace(url);
    }

    // Listen for keydown events to trigger the panic redirect
    document.addEventListener('keydown', function (event) {
        if (event.key === savedKeybind) {
            changeUrlWithoutRedirect(savedUrl);
        }
    });
});
