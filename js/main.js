/* ---------------------------------------------------------------
 * Shared utility used by every tool page's own script: copy text
 * to the clipboard and flash the trigger button's icon on success.
 * Exposed on window since each page's script is its own closure.
 * ------------------------------------------------------------- */
window.ShadeTools = window.ShadeTools || {};

// Every tool page's output box follows the same markup: a container
// with a placeholder span (shown when empty) and a chars span (the
// result). Toggling between them is identical everywhere, so it lives
// here instead of once per tool script.
window.ShadeTools.renderOutput = function (text, placeholderId, charsId) {
    var placeholder = document.getElementById(placeholderId || "output-placeholder");
    var chars = document.getElementById(charsId || "output-chars");
    if (!text) {
        placeholder.style.display = "";
        chars.textContent = "";
        return;
    }
    placeholder.style.display = "none";
    chars.textContent = text;
};

window.ShadeTools.prefersReducedMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

window.ShadeTools.copyToClipboard = function (text, triggerEl) {
    if (!text) return;

    function done() {
        if (!triggerEl) return;
        var icon = triggerEl.querySelector("i");
        if (!icon) return;
        var original = icon.className;
        icon.className = "bi bi-check2";
        triggerEl.classList.add("st-btn-icon-success");
        setTimeout(function () {
            icon.className = original;
            triggerEl.classList.remove("st-btn-icon-success");
        }, 1200);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
        var temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        try { document.execCommand("copy"); done(); } catch (err) { /* no-op */ }
        document.body.removeChild(temp);
    }
};

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

    // Marks whichever header nav link matches the current page as active,
    // and highlights a "Tools" dropdown trigger too if one of its items is
    // the active page. The header markup itself carries no per-page state,
    // since it's the same fetched partial on every page.
    function markActiveNavLink() {
        var links = document.querySelectorAll(".st-nav-link");
        links.forEach(function (link) {
            var isActive = link.getAttribute("href") === location.pathname;
            link.classList.toggle("active", isActive);
            if (isActive) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        document.querySelectorAll(".st-nav-dropdown-toggle").forEach(function (toggle) {
            var panel = toggle.nextElementSibling;
            var hasActiveItem = panel && !!panel.querySelector(".st-nav-link.active");
            toggle.classList.toggle("active", hasActiveItem);
        });
    }

    // Desktop "Tools" dropdown: opens on hover (real pointer devices) and
    // on click/tap/keyboard (everyone else). Mobile uses Bootstrap's own
    // nested collapse instead, wired entirely via data attributes.
    function initDesktopDropdown() {
        var dropdown = document.querySelector(".st-nav-dropdown");
        if (!dropdown) return;

        var toggle = dropdown.querySelector(".st-nav-dropdown-toggle");
        if (!toggle) return;

        function setOpen(open) {
            dropdown.classList.toggle("open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }

        toggle.addEventListener("click", function () {
            setOpen(!dropdown.classList.contains("open"));
        });

        document.addEventListener("click", function (e) {
            if (!dropdown.contains(e.target)) setOpen(false);
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") setOpen(false);
        });
    }

    // System preference by default; a click on the header's theme toggle
    // stores an explicit choice that overrides and persists across visits
    // (localStorage), until the toggle is used again.
    var THEME_STORAGE_KEY = "shadetools-theme";

    function getStoredTheme() {
        try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { return null; }
    }

    function setStoredTheme(value) {
        try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch (e) { /* no-op, e.g. private mode */ }
    }

    function initTheme() {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");

        function apply(isDark) {
            document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
            document.querySelectorAll(".st-theme-toggle").forEach(function (btn) {
                btn.setAttribute("aria-pressed", isDark ? "true" : "false");
            });
        }

        var stored = getStoredTheme();
        apply(stored ? stored === "dark" : mq.matches);

        // Live-follow the system theme only while nothing has been chosen
        // manually yet.
        function onSystemChange(e) {
            if (!getStoredTheme()) apply(e.matches);
        }
        if (mq.addEventListener) {
            mq.addEventListener("change", onSystemChange);
        } else if (mq.addListener) {
            // Safari < 14 fallback
            mq.addListener(onSystemChange);
        }

        // Delegated so it also covers the toggle button once the header
        // component (loaded async via fetch) lands in the DOM.
        document.addEventListener("click", function (e) {
            var btn = e.target.closest(".st-theme-toggle");
            if (!btn) return;
            var next = document.documentElement.getAttribute("data-bs-theme") !== "dark";
            setStoredTheme(next ? "dark" : "light");
            apply(next);
        });
    }

    /* ---------------------------------------------------------------
     * Secure-ish random pick for the decorative scramble effect
     * (visual only, no security requirement here)
     * ------------------------------------------------------------- */
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    function randomGlyph() {
        return SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
    }

    /* ---------------------------------------------------------------
     * One-time hero wordmark scramble-reveal, echoing the same
     * decode effect used on the password generator tool.
     * ------------------------------------------------------------- */
    function animateHero() {
        var words = document.querySelectorAll(".st-hero-word");
        if (!words.length) return;

        if (window.ShadeTools.prefersReducedMotion()) return; // final text is already in the markup

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
            loadComponent("header", "/components/header.html"),
            loadComponent("footer", "/components/footer.html")
        ]).then(function () {
            markActiveNavLink();
            initDesktopDropdown();
        });

        animateHero();
    });
})();
