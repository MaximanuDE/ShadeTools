(function () {
    "use strict";

    /* ---------------------------------------------------------------
     * Fixed local word list for passphrases (256 words -> exactly
     * 8 bits of entropy per word, nothing fetched from the network).
     * ------------------------------------------------------------- */
    var WORDLIST = [
        "acorn", "adobe", "agile", "alert", "alloy", "amber", "anchor", "angle",
        "apple", "arbor", "arena", "armor", "arrow", "ashen", "aspen", "atlas",
        "aurora", "autumn", "avenue", "azure", "badge", "bakery", "balsa", "bamboo",
        "banjo", "barley", "basil", "basket", "beacon", "beetle", "bellow", "berry",
        "birch", "bison", "blanket", "blaze", "bloom", "blossom", "bluff", "bolt",
        "bonfire", "boulder", "breeze", "bridge", "bright", "bristle", "bronze", "brook",
        "bucket", "bugle", "cabin", "cable", "cactus", "camp", "candle", "canoe",
        "canyon", "cargo", "carrot", "cascade", "castle", "cedar", "cellar", "cement",
        "chalk", "chapel", "cherry", "chestnut", "chime", "cinder", "circuit", "clay",
        "cliff", "cloak", "clover", "coast", "cobalt", "cocoa", "comet", "compass",
        "copper", "coral", "corner", "cotton", "cove", "coyote", "crane", "crater",
        "crest", "cricket", "crimson", "crystal", "cub", "current", "cypress", "dagger",
        "daisy", "dawn", "delta", "denim", "desert", "dewdrop", "diamond", "dock",
        "dolphin", "domino", "dove", "dragon", "drift", "drum", "dune", "dusk",
        "eagle", "ebony", "echo", "eclipse", "ember", "emerald", "engine", "estate",
        "falcon", "feather", "fennel", "ferry", "fiber", "field", "finch", "fjord",
        "flame", "flare", "flint", "forest", "forge", "fossil", "fountain", "fox",
        "frost", "galaxy", "garden", "garnet", "gazebo", "geyser", "ginger", "glacier",
        "glade", "glider", "goblet", "granite", "grape", "gravel", "grove", "gull",
        "hamlet", "harbor", "harvest", "hazel", "heather", "hemlock", "heron", "hickory",
        "hollow", "honey", "horizon", "hornbeam", "hummus", "hyacinth", "iceberg", "indigo",
        "inlet", "iris", "island", "ivory", "jasper", "jasmine", "jetty", "jewel",
        "juniper", "jute", "kelp", "kestrel", "kettle", "knoll", "lagoon", "lantern",
        "laurel", "lentil", "lichen", "lilac", "lily", "linden", "lodge", "loft",
        "lotus", "lumber", "lunar", "lupine", "magma", "magnet", "mango", "manor",
        "maple", "marble", "marsh", "meadow", "mesa", "meteor", "millet", "mimosa",
        "mineral", "mint", "mirage", "mist", "moraine", "mosaic", "moss", "mountain",
        "myrtle", "nebula", "needle", "nest", "nickel", "nomad", "nutmeg", "oasis",
        "oatmeal", "obsidian", "ocean", "olive", "opal", "orbit", "orchard", "orchid",
        "osprey", "otter", "outpost", "paddle", "palm", "pantry", "papaya", "parsley",
        "pasture", "peak", "pearl", "pebble", "pecan", "pepper", "petal", "pewter",
        "pigeon", "pillar", "pine", "pinnacle", "plaza", "plum", "pond", "poppy"
    ];

    /* ---------------------------------------------------------------
     * Crypto-secure random helpers
     * ------------------------------------------------------------- */
    function randomInt(maxExclusive) {
        var range = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
        var buf = new Uint32Array(1);
        var value;
        do {
            crypto.getRandomValues(buf);
            value = buf[0];
        } while (value >= range);
        return value % maxExclusive;
    }

    function randomItem(list) {
        return list[randomInt(list.length)];
    }

    /* ---------------------------------------------------------------
     * Character pools
     * ------------------------------------------------------------- */
    var POOLS = {
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        lower: "abcdefghijklmnopqrstuvwxyz",
        numbers: "0123456789",
        symbols: "!@#$%^&*()-_=+[]{};:,.?"
    };
    var AMBIGUOUS = "l1IO0";

    function stripAmbiguous(str) {
        var out = "";
        for (var i = 0; i < str.length; i++) {
            if (AMBIGUOUS.indexOf(str[i]) === -1) out += str[i];
        }
        return out;
    }

    /* ---------------------------------------------------------------
     * State
     * ------------------------------------------------------------- */
    var state = { mode: "characters" };
    var history = [];

    /* ---------------------------------------------------------------
     * Character-mode generation
     * ------------------------------------------------------------- */
    function generateCharacters() {
        var length = parseInt(document.getElementById("length-range").value, 10);
        var useUpper = document.getElementById("opt-upper").checked;
        var useLower = document.getElementById("opt-lower").checked;
        var useNumbers = document.getElementById("opt-numbers").checked;
        var useSymbols = document.getElementById("opt-symbols").checked;
        var excludeAmbiguous = document.getElementById("opt-ambiguous").checked;

        var pool = "";
        if (useUpper) pool += POOLS.upper;
        if (useLower) pool += POOLS.lower;
        if (useNumbers) pool += POOLS.numbers;
        if (useSymbols) pool += POOLS.symbols;
        if (excludeAmbiguous) pool = stripAmbiguous(pool);

        if (!pool.length) {
            return { text: "", entropy: 0 };
        }

        var chars = [];
        for (var i = 0; i < length; i++) {
            chars.push(pool[randomInt(pool.length)]);
        }

        var entropy = length * Math.log2(pool.length);
        return { text: chars.join(""), entropy: entropy };
    }

    /* ---------------------------------------------------------------
     * Passphrase-mode generation
     * ------------------------------------------------------------- */
    function generatePassphrase() {
        var wordCount = parseInt(document.getElementById("words-range").value, 10);
        var separator = document.getElementById("separator-select").value;
        var capitalize = document.getElementById("opt-capitalize").checked;
        var appendNumber = document.getElementById("opt-append-number").checked;

        var words = [];
        for (var i = 0; i < wordCount; i++) {
            var word = randomItem(WORDLIST);
            if (capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
            words.push(word);
        }

        var text = words.join(separator);
        if (appendNumber) {
            text += String(randomInt(100)).padStart(2, "0");
        }

        // Only the genuinely random word choices count toward entropy;
        // separator, capitalization and the appended number are fixed
        // presentation choices, not randomized selections.
        var entropy = wordCount * Math.log2(WORDLIST.length);
        return { text: text, entropy: entropy };
    }

    /* ---------------------------------------------------------------
     * Strength classification
     * ------------------------------------------------------------- */
    function classifyStrength(bits) {
        if (bits < 40) return { label: "Weak", css: "st-strength-weak", pct: Math.max(6, (bits / 40) * 25) };
        if (bits < 60) return { label: "Fair", css: "st-strength-fair", pct: 25 + ((bits - 40) / 20) * 25 };
        if (bits < 80) return { label: "Good", css: "st-strength-good", pct: 50 + ((bits - 60) / 20) * 25 };
        return { label: "Strong", css: "st-strength-strong", pct: Math.min(100, 75 + ((bits - 80) / 40) * 25) };
    }

    /* ---------------------------------------------------------------
     * Rendering
     * ------------------------------------------------------------- */
    function renderStrength(bits) {
        var fill = document.getElementById("strength-fill");
        var label = document.getElementById("strength-label");
        var entropyLabel = document.getElementById("entropy-label");

        fill.className = "st-strength-fill";
        if (!bits) {
            fill.style.width = "0%";
            label.textContent = "—";
            entropyLabel.textContent = "— bits of entropy";
            return;
        }

        var result = classifyStrength(bits);
        fill.classList.add(result.css);
        fill.style.width = result.pct + "%";
        label.textContent = result.label;
        entropyLabel.textContent = "~" + Math.round(bits) + " bits of entropy";
    }

    function renderHistory() {
        var list = document.getElementById("history-list");
        list.innerHTML = "";

        if (!history.length) {
            var empty = document.createElement("li");
            empty.className = "st-history-empty";
            empty.id = "history-empty";
            empty.textContent = "Nothing generated yet.";
            list.appendChild(empty);
            return;
        }

        history.forEach(function (entry) {
            var item = document.createElement("li");
            item.className = "st-history-item";

            var value = document.createElement("span");
            value.className = "st-history-value";
            value.textContent = entry;

            var copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "st-history-copy";
            copyBtn.setAttribute("aria-label", "Copy this password");
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
            copyBtn.addEventListener("click", function () {
                window.ShadeTools.copyToClipboard(entry, copyBtn);
            });

            item.appendChild(value);
            item.appendChild(copyBtn);
            list.appendChild(item);
        });
    }

    /* ---------------------------------------------------------------
     * Generate action
     * ------------------------------------------------------------- */
    var currentText = "";

    function generate() {
        var result = state.mode === "characters" ? generateCharacters() : generatePassphrase();
        currentText = result.text;
        window.ShadeTools.renderOutput(result.text);
        renderStrength(result.entropy);

        if (result.text) {
            history.unshift(result.text);
            if (history.length > 8) history.length = 8;
            renderHistory();
        }
    }

    /* ---------------------------------------------------------------
     * Wiring
     * ------------------------------------------------------------- */
    function initModeSwitch() {
        var buttons = document.querySelectorAll(".st-mode-btn");
        buttons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var mode = btn.dataset.mode;
                if (mode === state.mode) return;
                state.mode = mode;

                buttons.forEach(function (b) {
                    b.classList.toggle("active", b === btn);
                    b.setAttribute("aria-selected", b === btn ? "true" : "false");
                });

                document.getElementById("settings-characters").classList.toggle("d-none", mode !== "characters");
                document.getElementById("settings-passphrase").classList.toggle("d-none", mode !== "passphrase");
            });
        });
    }

    function initRanges() {
        var lengthRange = document.getElementById("length-range");
        var lengthValue = document.getElementById("length-value");
        lengthRange.addEventListener("input", function () {
            lengthValue.textContent = lengthRange.value;
        });

        var wordsRange = document.getElementById("words-range");
        var wordsValue = document.getElementById("words-value");
        wordsRange.addEventListener("input", function () {
            wordsValue.textContent = wordsRange.value;
        });
    }

    function initControls() {
        document.getElementById("generate-btn").addEventListener("click", generate);

        document.getElementById("copy-btn").addEventListener("click", function () {
            window.ShadeTools.copyToClipboard(currentText, document.getElementById("copy-btn"));
        });

        document.getElementById("clear-history-btn").addEventListener("click", function () {
            history = [];
            renderHistory();
        });
    }

    /* ---------------------------------------------------------------
     * Init
     * ------------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        initModeSwitch();
        initRanges();
        initControls();
    });
})();
