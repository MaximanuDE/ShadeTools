(function () {
    "use strict";

    /* ---------------------------------------------------------------
     * Components: load header/footer partials, then sync theme label
     * ------------------------------------------------------------- */
    function loadComponent(id, path) {
        return fetch(path)
            .then(function (res) {
                if (!res.ok) throw new Error("Failed to load " + path);
                return res.text();
            })
            .then(function (html) {
                var target = document.getElementById(id);
                if (target) target.innerHTML = html;
            })
            .catch(function (err) {
                console.error(err);
            });
    }

    function updateThemeIndicator(isDark) {
        var indicator = document.getElementById("theme-indicator");
        if (indicator) {
            indicator.innerHTML = '<i class="bi bi-circle-half"></i> Following system theme (' +
                (isDark ? "dark" : "light") + ")";
        }
    }

    function initTheme() {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");

        function apply(matches) {
            document.documentElement.setAttribute("data-bs-theme", matches ? "dark" : "light");
            updateThemeIndicator(matches);
        }

        apply(mq.matches);
        // Live update, no reload required
        if (mq.addEventListener) {
            mq.addEventListener("change", function (e) { apply(e.matches); });
        } else if (mq.addListener) {
            // Safari < 14 fallback
            mq.addListener(function (e) { apply(e.matches); });
        }
    }

    /* ---------------------------------------------------------------
     * Secure-ish random pick for the decorative scramble effect
     * (visual only, no security requirement here)
     * ------------------------------------------------------------- */
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    function randomGlyph() {
        return SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
    }

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    /* ---------------------------------------------------------------
     * One-time hero wordmark scramble-reveal, echoing the same
     * decode effect used on the password generator tool.
     * ------------------------------------------------------------- */
    function animateHero() {
        var words = document.querySelectorAll(".st-hero-word");
        if (!words.length) return;

        if (prefersReducedMotion()) return; // final text is already in the markup

        var charIndex = 0;

        words.forEach(function (wordEl) {
            var finalText = wordEl.dataset.final || wordEl.textContent;
            wordEl.textContent = "";

            var spans = [];
            for (var i = 0; i < finalText.length; i++) {
                var span = document.createElement("span");
                span.className = "st-hero-char st-hero-char-scrambling";
                span.textContent = randomGlyph();
                wordEl.appendChild(span);
                spans.push({ span: span, finalChar: finalText[i], globalIndex: charIndex });
                charIndex++;
            }

            spans.forEach(function (item) {
                var delayFrames = item.globalIndex * 2;
                var totalFrames = delayFrames + 6;
                var frame = 0;

                var timer = setInterval(function () {
                    frame++;
                    if (frame < delayFrames) return;
                    if (frame >= totalFrames) {
                        item.span.textContent = item.finalChar;
                        item.span.classList.remove("st-hero-char-scrambling");
                        item.span.classList.add("st-hero-char-settled");
                        clearInterval(timer);
                        return;
                    }
                    item.span.textContent = randomGlyph();
                }, 35);
            });
        });
    }

    /* ---------------------------------------------------------------
     * Init
     * ------------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        initTheme();

        Promise.all([
            loadComponent("header", "components/header.html"),
            loadComponent("footer", "components/footer.html")
        ]).then(function () {
            var mq = window.matchMedia("(prefers-color-scheme: dark)");
            updateThemeIndicator(mq.matches);
        });

        animateHero();
    });
})();
