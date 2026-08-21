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

    function initTheme() {
        var mq = window.matchMedia("(prefers-color-scheme: dark)");

        function apply(matches) {
            document.documentElement.setAttribute("data-bs-theme", matches ? "dark" : "light");
            var indicator = document.getElementById("theme-indicator");
            if (indicator) {
                indicator.innerHTML = '<i class="bi bi-circle-half"></i> Following system theme (' +
                    (matches ? "dark" : "light") + ")";
            }
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
     * Word list for passphrase mode (fixed, common English words)
     * ------------------------------------------------------------- */
    var WORDLIST = [
        "anchor","amber","apricot","atlas","attic","aurora","badger","balcony","barley","basket",
        "beacon","beetle","biscuit","bison","blanket","blizzard","bobcat","boulder","breeze","bridge",
        "bronze","bucket","candle","canvas","canyon","caramel","carve","cascade","castle","cellar",
        "ceramic","chamber","cheetah","chestnut","chisel","chowder","cinnamon","cipher","cobalt","cobra",
        "comet","compass","copper","corridor","cottage","cotton","coyote","crate","crimson","current",
        "cushion","custard","desert","dolphin","drawer","drift","drought","dumpling","dusk","ebony",
        "echo","ember","engine","enigma","fabric","falcon","faucet","filament","flicker","forest",
        "forge","funnel","gale","gazelle","gecko","ginger","girder","glacier","glide","glimmer",
        "glow","granite","gateway","harbor","hazel","heron","hinge","hornet","horizon","indigo",
        "island","ivory","jackal","jaguar","kettle","kindle","koala","lagoon","lantern","lattice",
        "leather","lemur","lentil","leopard","lever","linen","lizard","locket","mallet","mango",
        "marble","marlin","marsh","meadow","mezzanine","mirror","monsoon","mosaic","moose","murmur",
        "nebula","needle","noodle","nutmeg","oatmeal","obsidian","ocelot","orbit","oregano","otter",
        "outpost","oyster","paddle","panda","panther","papaya","paprika","pavilion","pendant","pepper",
        "pillow","pipeline","plateau","polish","prairie","pretzel","prism","puffin","pulley","python",
        "quartz","quench","quiver","rabbit","rampart","relay","ribbon","ridge","riddle","ripple",
        "risotto","rivet","rustle","saffron","salmon","sanctuary","satchel","sculpt","shadow","sparrow",
        "shimmer","shovel","signal","silver","socket","spark","spectrum","spider","staircase","summit",
        "temper","terrace","thimble","thunder","toucan","tower","tremor","tundra","turret","twilight",
        "valley","vector","velvet","vertex","veranda","volcano","walnut","walrus","weasel","whisper",
        "wrench","zebra","zenith"
    ];

    /* ---------------------------------------------------------------
     * Character sets
     * ------------------------------------------------------------- */
    var SETS = {
        upperFull: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        upperSafe: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I, O
        lowerFull: "abcdefghijklmnopqrstuvwxyz",
        lowerSafe: "abcdefghijkmnpqrstuvwxyz", // no l, o
        numbersFull: "0123456789",
        numbersSafe: "23456789", // no 0, 1
        symbols: "!@#$%^&*()-_=+[]{};:,.<>?/"
    };
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

    /* ---------------------------------------------------------------
     * Secure random helpers
     * ------------------------------------------------------------- */
    function secureRandomInt(maxExclusive) {
        var range = maxExclusive;
        var maxUint = 4294967296; // 2^32
        var limit = maxUint - (maxUint % range);
        var buf = new Uint32Array(1);
        var val;
        do {
            window.crypto.getRandomValues(buf);
            val = buf[0];
        } while (val >= limit);
        return val % range;
    }

    function pickRandom(str) {
        return str[secureRandomInt(str.length)];
    }

    function shuffleInPlace(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = secureRandomInt(i + 1);
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    /* ---------------------------------------------------------------
     * State
     * ------------------------------------------------------------- */
    var state = {
        mode: "characters",
        currentPassword: "",
        currentEntropyBits: 0,
        history: [] // in-memory only, intentionally never persisted to storage
    };

    /* ---------------------------------------------------------------
     * Generation: character mode
     * ------------------------------------------------------------- */
    function generateCharacterPassword(opts) {
        var pool = "";
        var guaranteed = [];

        var upperSet = opts.excludeAmbiguous ? SETS.upperSafe : SETS.upperFull;
        var lowerSet = opts.excludeAmbiguous ? SETS.lowerSafe : SETS.lowerFull;
        var numberSet = opts.excludeAmbiguous ? SETS.numbersSafe : SETS.numbersFull;

        if (opts.upper) { pool += upperSet; guaranteed.push(pickRandom(upperSet)); }
        if (opts.lower) { pool += lowerSet; guaranteed.push(pickRandom(lowerSet)); }
        if (opts.numbers) { pool += numberSet; guaranteed.push(pickRandom(numberSet)); }
        if (opts.symbols) { pool += SETS.symbols; guaranteed.push(pickRandom(SETS.symbols)); }

        if (pool.length === 0) {
            return { password: "", entropyBits: 0, poolSize: 0 };
        }

        var length = Math.max(opts.length, guaranteed.length);
        var chars = guaranteed.slice();
        for (var i = chars.length; i < length; i++) {
            chars.push(pickRandom(pool));
        }
        shuffleInPlace(chars);

        var entropyBits = length * Math.log2(pool.length);

        return { password: chars.join(""), entropyBits: entropyBits, poolSize: pool.length };
    }

    /* ---------------------------------------------------------------
     * Generation: passphrase mode
     * ------------------------------------------------------------- */
    function generatePassphrase(opts) {
        var words = [];
        for (var i = 0; i < opts.wordCount; i++) {
            var w = WORDLIST[secureRandomInt(WORDLIST.length)];
            if (opts.capitalize) {
                w = w.charAt(0).toUpperCase() + w.slice(1);
            }
            words.push(w);
        }

        var entropyBits = opts.wordCount * Math.log2(WORDLIST.length);

        var result = words.join(opts.separator);

        if (opts.appendNumber) {
            var digit = secureRandomInt(10);
            result += opts.separator + digit;
            entropyBits += Math.log2(10);
        }

        return { password: result, entropyBits: entropyBits };
    }

    /* ---------------------------------------------------------------
     * Strength label from entropy bits
     * ------------------------------------------------------------- */
    function strengthFromEntropy(bits) {
        if (bits <= 0) return { label: "—", ratio: 0, level: "" };
        if (bits < 35) return { label: "Weak", ratio: Math.min(bits / 128, 1), level: "weak" };
        if (bits < 60) return { label: "Fair", ratio: Math.min(bits / 128, 1), level: "fair" };
        if (bits < 80) return { label: "Good", ratio: Math.min(bits / 128, 1), level: "good" };
        if (bits < 128) return { label: "Strong", ratio: Math.min(bits / 128, 1), level: "strong" };
        return { label: "Very strong", ratio: 1, level: "very-strong" };
    }

    /* ---------------------------------------------------------------
     * DOM refs (populated on init)
     * ------------------------------------------------------------- */
    var el = {};

    function cacheDom() {
        el.outputChars = document.getElementById("output-chars");
        el.outputPlaceholder = document.getElementById("output-placeholder");
        el.copyBtn = document.getElementById("copy-btn");
        el.regenBtn = document.getElementById("regen-btn");
        el.generateBtn = document.getElementById("generate-btn");
        el.strengthFill = document.getElementById("strength-fill");
        el.strengthLabel = document.getElementById("strength-label");
        el.entropyLabel = document.getElementById("entropy-label");

        el.modeBtns = document.querySelectorAll(".st-mode-btn");
        el.settingsCharacters = document.getElementById("settings-characters");
        el.settingsPassphrase = document.getElementById("settings-passphrase");

        el.lengthRange = document.getElementById("length-range");
        el.lengthValue = document.getElementById("length-value");
        el.optUpper = document.getElementById("opt-upper");
        el.optLower = document.getElementById("opt-lower");
        el.optNumbers = document.getElementById("opt-numbers");
        el.optSymbols = document.getElementById("opt-symbols");
        el.optAmbiguous = document.getElementById("opt-ambiguous");

        el.wordsRange = document.getElementById("words-range");
        el.wordsValue = document.getElementById("words-value");
        el.separatorSelect = document.getElementById("separator-select");
        el.optCapitalize = document.getElementById("opt-capitalize");
        el.optAppendNumber = document.getElementById("opt-append-number");

        el.historyList = document.getElementById("history-list");
        el.historyEmpty = document.getElementById("history-empty");
        el.clearHistoryBtn = document.getElementById("clear-history-btn");
    }

    /* ---------------------------------------------------------------
     * Reading current settings from the form
     * ------------------------------------------------------------- */
    function readCharacterOptions() {
        return {
            length: parseInt(el.lengthRange.value, 10),
            upper: el.optUpper.checked,
            lower: el.optLower.checked,
            numbers: el.optNumbers.checked,
            symbols: el.optSymbols.checked,
            excludeAmbiguous: el.optAmbiguous.checked
        };
    }

    function readPassphraseOptions() {
        return {
            wordCount: parseInt(el.wordsRange.value, 10),
            separator: el.separatorSelect.value,
            capitalize: el.optCapitalize.checked,
            appendNumber: el.optAppendNumber.checked
        };
    }

    /* ---------------------------------------------------------------
     * Rendering
     * ------------------------------------------------------------- */
    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function renderPasswordInstant(password) {
        el.outputChars.innerHTML = "";
        var frag = document.createDocumentFragment();
        for (var i = 0; i < password.length; i++) {
            var span = document.createElement("span");
            span.className = "st-char";
            span.textContent = password[i];
            frag.appendChild(span);
        }
        el.outputChars.appendChild(frag);
    }

    function renderPasswordScramble(password) {
        el.outputChars.innerHTML = "";
        var spans = [];
        for (var i = 0; i < password.length; i++) {
            var span = document.createElement("span");
            span.className = "st-char st-char-scrambling";
            span.textContent = pickRandom(SCRAMBLE_GLYPHS);
            el.outputChars.appendChild(span);
            spans.push(span);
        }

        var FRAME_MS = 35;
        var FRAMES_PER_CHAR = 6;

        spans.forEach(function (span, index) {
            var delayFrames = index * 2; // stagger
            var totalFrames = delayFrames + FRAMES_PER_CHAR;
            var frame = 0;

            var timer = setInterval(function () {
                frame++;
                if (frame < delayFrames) {
                    return;
                }
                if (frame >= totalFrames) {
                    span.textContent = password[index];
                    span.classList.remove("st-char-scrambling");
                    span.classList.add("st-char-settled");
                    clearInterval(timer);
                    return;
                }
                span.textContent = pickRandom(SCRAMBLE_GLYPHS);
            }, FRAME_MS);
        });
    }

    function renderStrength(bits) {
        var s = strengthFromEntropy(bits);
        el.strengthFill.style.width = (s.ratio * 100) + "%";
        el.strengthFill.className = "st-strength-fill" + (s.level ? " st-strength-" + s.level : "");
        el.strengthLabel.textContent = s.label;
        el.entropyLabel.textContent = bits > 0 ? ("~" + Math.round(bits) + " bits of entropy") : "— bits of entropy";
    }

    function renderHistory() {
        el.historyList.innerHTML = "";
        if (state.history.length === 0) {
            var empty = document.createElement("li");
            empty.className = "st-history-empty";
            empty.textContent = "Nothing generated yet.";
            el.historyList.appendChild(empty);
            return;
        }
        state.history.forEach(function (entry) {
            var li = document.createElement("li");
            li.className = "st-history-item";

            var code = document.createElement("code");
            code.className = "st-history-value";
            code.textContent = entry.password;

            var meta = document.createElement("span");
            meta.className = "st-history-meta st-muted";
            meta.textContent = "~" + Math.round(entry.entropyBits) + " bits";

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn st-btn-icon st-btn-icon-sm";
            btn.setAttribute("aria-label", "Copy this password");
            btn.innerHTML = '<i class="bi bi-clipboard"></i>';
            btn.addEventListener("click", function () {
                copyToClipboard(entry.password, btn);
            });

            li.appendChild(code);
            li.appendChild(meta);
            li.appendChild(btn);
            el.historyList.appendChild(li);
        });
    }

    /* ---------------------------------------------------------------
     * Clipboard
     * ------------------------------------------------------------- */
    function copyToClipboard(text, buttonEl) {
        if (!text) return;
        var button = buttonEl || el.copyBtn;
        var originalHtml = button.innerHTML;

        function showCopied() {
            button.innerHTML = '<i class="bi bi-check2"></i>';
            setTimeout(function () { button.innerHTML = originalHtml; }, 1200);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(showCopied).catch(function () {
                fallbackCopy(text);
                showCopied();
            });
        } else {
            fallbackCopy(text);
            showCopied();
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* no-op */ }
        document.body.removeChild(ta);
    }

    /* ---------------------------------------------------------------
     * Core generate action
     * ------------------------------------------------------------- */
    function generate() {
        var result;
        if (state.mode === "characters") {
            var opts = readCharacterOptions();
            if (!opts.upper && !opts.lower && !opts.numbers && !opts.symbols) {
                el.outputChars.innerHTML = "";
                el.outputPlaceholder.textContent = "Select at least one character type";
                el.outputPlaceholder.style.display = "block";
                renderStrength(0);
                return;
            }
            result = generateCharacterPassword(opts);
        } else {
            var pOpts = readPassphraseOptions();
            result = generatePassphrase(pOpts);
        }

        state.currentPassword = result.password;
        state.currentEntropyBits = result.entropyBits;

        el.outputPlaceholder.style.display = "none";

        if (prefersReducedMotion()) {
            renderPasswordInstant(result.password);
        } else {
            renderPasswordScramble(result.password);
        }

        renderStrength(result.entropyBits);

        state.history.unshift({ password: result.password, entropyBits: result.entropyBits });
        state.history = state.history.slice(0, 5);
        renderHistory();
    }

    /* ---------------------------------------------------------------
     * Wiring
     * ------------------------------------------------------------- */
    function setMode(mode) {
        state.mode = mode;
        el.modeBtns.forEach(function (btn) {
            var active = btn.dataset.mode === mode;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        el.settingsCharacters.classList.toggle("d-none", mode !== "characters");
        el.settingsPassphrase.classList.toggle("d-none", mode !== "passphrase");
        generate();
    }

    function bindEvents() {
        el.modeBtns.forEach(function (btn) {
            btn.addEventListener("click", function () { setMode(btn.dataset.mode); });
        });

        el.lengthRange.addEventListener("input", function () {
            el.lengthValue.textContent = el.lengthRange.value;
            generate();
        });
        [el.optUpper, el.optLower, el.optNumbers, el.optSymbols, el.optAmbiguous].forEach(function (input) {
            input.addEventListener("change", generate);
        });

        el.wordsRange.addEventListener("input", function () {
            el.wordsValue.textContent = el.wordsRange.value;
            generate();
        });
        [el.separatorSelect, el.optCapitalize, el.optAppendNumber].forEach(function (input) {
            input.addEventListener("change", generate);
        });

        el.generateBtn.addEventListener("click", generate);
        el.regenBtn.addEventListener("click", generate);
        el.copyBtn.addEventListener("click", function () { copyToClipboard(state.currentPassword); });

        el.clearHistoryBtn.addEventListener("click", function () {
            state.history = [];
            renderHistory();
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
            // Re-apply theme label now that footer markup exists
            var mq = window.matchMedia("(prefers-color-scheme: dark)");
            var indicator = document.getElementById("theme-indicator");
            if (indicator) {
                indicator.innerHTML = '<i class="bi bi-circle-half"></i> Following system theme (' +
                    (mq.matches ? "dark" : "light") + ")";
            }
        });

        cacheDom();
        bindEvents();
        generate();
    });
})();
