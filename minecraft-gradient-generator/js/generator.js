(function () {
    "use strict";

    var MC = window.ShadeToolsMC;

    function buildGradientColors(length, hexColors, mode) {
        return MC.buildGradientColors(length, hexColors, mode);
    }

    function miniMessageOutput(text, hexColors, colors, mode, formatting) {
        var inner = mode === "rgb"
            // Adventure's native <gradient:...> tag interpolates in plain
            // RGB, matching this mode exactly — a compact tag is enough.
            ? MC.miniMessageGradientTag(hexColors, text)
            // HSL/OKLab have no MiniMessage-native equivalent, so emit the
            // computed color explicitly before each character instead.
            : MC.miniMessagePerChar(text, colors);
        return MC.wrapMiniMessageFormatting(inner, formatting);
    }

    function jsonOutput(text, colors, formatting) {
        return MC.jsonOutput(text, colors, formatting);
    }

    function legacyOutput(text, colors, prefix, formatting) {
        return MC.legacyOutput(text, colors, prefix, formatting);
    }

    var FORMAT_NOTES = {
        minimessage: "MiniMessage works directly in Paper/Adventure-based plugin configs. RGB mode emits a compact <gradient> tag; HSL/OKLab emit an explicit color before each character, since Adventure's own gradient tag only interpolates in RGB.",
        shorthex: "The <#rrggbb> shorthand tag before each character, standalone rather than wrapped in MiniMessage's own gradient tag — for plugins that accept this hex shorthand mixed with legacy & format codes.",
        section: "Legacy format using § (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this for raw text components and resource packs.",
        amp: "Legacy format using & (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this wherever a plugin auto-translates ampersand codes — most Bukkit/Spigot configs.",
        ampflat: "A flatter &#rrggbb color code before every character, without per-digit splitting — for Discord bots and non-Adventure plugins that accept this shorthand instead of the split &x&r&r&g&g&b&b form.",
        json: "Raw Minecraft text component JSON, as used in /tellraw, books, and signs that accept JSON text.",
        bbcode: "BBCode for forum signatures: [COLOR=#rrggbb] around every character, wrapped in whole-string [BOLD]/[ITALIC]/[UNDERLINE]/[STRIKETHROUGH] tags. BBCode has no obfuscated-text equivalent."
    };

    /* ---------------------------------------------------------------
     * State
     * ------------------------------------------------------------- */
    var state = {
        colors: ["#6339d9", "#16c2d1"]
    };

    var currentOutput = "";
    var obfuscateTimer = null;
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function getFormatting() {
        return {
            bold: document.getElementById("fmt-bold").checked,
            italic: document.getElementById("fmt-italic").checked,
            underline: document.getElementById("fmt-underline").checked,
            strikethrough: document.getElementById("fmt-strikethrough").checked,
            obfuscate: document.getElementById("fmt-obfuscate").checked
        };
    }

    /* ---------------------------------------------------------------
     * Color list UI
     * ------------------------------------------------------------- */
    function renderColorList() {
        var list = document.getElementById("color-list");
        list.innerHTML = "";

        state.colors.forEach(function (hex, i) {
            var row = document.createElement("div");
            row.className = "st-color-row-item";

            var swatch = document.createElement("input");
            swatch.type = "color";
            swatch.className = "st-color-swatch";
            swatch.value = hex;
            swatch.setAttribute("aria-label", "Color " + (i + 1));
            swatch.addEventListener("input", function () {
                state.colors[i] = swatch.value;
                hexLabel.textContent = swatch.value.toUpperCase();
                update();
            });

            var hexLabel = document.createElement("span");
            hexLabel.className = "st-color-hex";
            hexLabel.textContent = hex.toUpperCase();

            row.appendChild(swatch);
            row.appendChild(hexLabel);

            if (state.colors.length > 2) {
                var removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "st-color-remove";
                removeBtn.setAttribute("aria-label", "Remove color " + (i + 1));
                removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
                removeBtn.addEventListener("click", function () {
                    state.colors.splice(i, 1);
                    renderColorList();
                    update();
                });
                row.appendChild(removeBtn);
            }

            list.appendChild(row);
        });

        document.getElementById("add-color").disabled = state.colors.length >= 8;
    }

    /* ---------------------------------------------------------------
     * Preview + output
     * ------------------------------------------------------------- */
    function renderPreview(text, colors, formatting) {
        var preview = document.getElementById("preview");
        preview.innerHTML = "";
        preview.classList.toggle("st-fmt-bold", formatting.bold);
        preview.classList.toggle("st-fmt-italic", formatting.italic);
        preview.classList.toggle("st-fmt-underline", formatting.underline);
        preview.classList.toggle("st-fmt-strikethrough", formatting.strikethrough);

        if (!text) {
            var placeholder = document.createElement("span");
            placeholder.className = "st-output-placeholder";
            placeholder.textContent = "Type something to preview the gradient";
            preview.appendChild(placeholder);
            stopObfuscateAnimation();
            return;
        }

        var spans = [];
        var chars = text.split("");
        chars.forEach(function (ch, i) {
            var span = document.createElement("span");
            span.textContent = ch;
            span.style.color = colors[i];
            preview.appendChild(span);
            spans.push(span);
        });

        if (formatting.obfuscate) {
            startObfuscateAnimation(spans, chars);
        } else {
            stopObfuscateAnimation();
        }
    }

    function stopObfuscateAnimation() {
        if (obfuscateTimer) {
            clearInterval(obfuscateTimer);
            obfuscateTimer = null;
        }
    }

    function startObfuscateAnimation(spans, chars) {
        stopObfuscateAnimation();
        if (prefersReducedMotion()) return;
        obfuscateTimer = setInterval(function () {
            spans.forEach(function (span, i) {
                if (chars[i] === " ") return;
                span.textContent = SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
            });
        }, 60);
    }

    function renderOutput(code) {
        var placeholder = document.getElementById("output-placeholder");
        var chars = document.getElementById("output-chars");
        if (!code) {
            placeholder.style.display = "";
            chars.textContent = "";
            return;
        }
        placeholder.style.display = "none";
        chars.textContent = code;
    }

    function buildOutput(format, text, hexColors, colors, mode, formatting) {
        if (format === "minimessage") return miniMessageOutput(text, hexColors, colors, mode, formatting);
        if (format === "shorthex") return MC.shortHexTagOutput(text, colors, formatting);
        if (format === "json") return jsonOutput(text, colors, formatting);
        if (format === "ampflat") return MC.flatHexOutput(text, colors, formatting);
        if (format === "bbcode") return MC.bbcodeOutput(text, colors, formatting);
        var prefix = format === "section" ? "§" : "&";
        return legacyOutput(text, colors, prefix, formatting);
    }

    function update() {
        var text = document.getElementById("input-text").value;
        var mode = document.getElementById("mode-select").value;
        var format = document.getElementById("format-select").value;
        var formatting = getFormatting();

        var colors = buildGradientColors(text.length, state.colors, mode);
        renderPreview(text, colors, formatting);

        currentOutput = text ? buildOutput(format, text, state.colors, colors, mode, formatting) : "";
        renderOutput(currentOutput);
        document.getElementById("format-note").textContent = FORMAT_NOTES[format];
    }

    /* ---------------------------------------------------------------
     * Init
     * ------------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        renderColorList();

        document.getElementById("input-text").addEventListener("input", update);
        document.getElementById("mode-select").addEventListener("change", update);
        document.getElementById("format-select").addEventListener("change", update);
        ["fmt-bold", "fmt-italic", "fmt-underline", "fmt-strikethrough", "fmt-obfuscate"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", update);
        });

        document.getElementById("add-color").addEventListener("click", function () {
            if (state.colors.length >= 8) return;
            state.colors.push("#ffffff");
            renderColorList();
            update();
        });

        document.getElementById("copy-btn").addEventListener("click", function () {
            window.ShadeTools.copyToClipboard(currentOutput, this);
        });

        update();
    });
})();
