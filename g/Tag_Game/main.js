(function() {
  "use strict";

  if ("querySelector" in document && "addEventListener" in window) {
    var body = document.body;

    body.addEventListener("mousedown", function() {
      body.classList.add("using-mouse");
    });

    body.addEventListener("keydown", function() {
      body.classList.remove("using-mouse");
    });
  }
})();

const gameIframe = document.getElementById('ubgs');

document.addEventListener('keydown', (event) => {

    if (event.keyCode >= 37 && event.keyCode <= 40) {

        if (document.activeElement === gameIframe) {

            return;
        } else {

            event.preventDefault();
        }
    }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    document.getElementById("ubgs").contentWindow.focus();
  }
});

(function() {
  "use strict";

  if ("querySelector" in document && "addEventListener" in window) {
    var body = document.body;

    body.addEventListener("mousedown", function() {
      body.classList.add("using-mouse");
    });

    body.addEventListener("keydown", function() {
      body.classList.remove("using-mouse");
    });
  }
})();

document.addEventListener('click', function(event) {
            var iframe = document.getElementById('ubgs');
            var rect = iframe.getBoundingClientRect();
            var isClickInside = (
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            );

            if (!isClickInside) {
                // Refocus the iframe
                iframe.contentWindow.focus();
            }
        });

        window.addEventListener('load', function() {
            var iframe = document.getElementById('ubgs');
            iframe.focus();
            iframe.contentWindow.focus();
        });
