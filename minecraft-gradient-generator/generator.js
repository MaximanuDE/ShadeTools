(function () {
    "use strict";

    var MC = window.ShadeToolsMC;

    // Always the compact native <gradient:c1:c2:...> tag, using the
    // original color stops directly (no animation, so no shifting is
    // needed — unlike the animated tool). Adventure's own gradient tag
    // always interpolates the pixels between those stops in plain RGB,
    // so in HSL/OKLab mode the in-game look is a close approximation of
    // this tool's own preview rather than an exact match; every other
    // output format still emits an exact per-character color instead.
    function miniMessageOutput(text, hexColors, formatting) {
        var inner = MC.miniMessageGradientTag(hexColors, text);
        return MC.wrapMiniMessageFormatting(inner, formatting);
    }

    var FORMAT_NOTES = {
        minimessage: "MiniMessage works directly in Paper/Adventure-based plugin configs, as a single <gradient:c1:c2:...> tag. Adventure's own gradient always interpolates in plain RGB, so in HSL/OKLab mode the in-game look is a close approximation of the preview above rather than an exact match.",
        shorthex: "The <#rrggbb> shorthand tag before each character, standalone rather than wrapped in MiniMessage's own gradient tag — for plugins that accept this hex shorthand mixed with legacy & format codes.",
        section: "Legacy format using § (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this for raw text components and resource packs.",
        amp: "Legacy format using & (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this wherever a plugin auto-translates ampersand codes — most Bukkit/Spigot configs.",
        ampflat: "A flatter &#rrggbb color code before every character, without per-digit splitting — for Discord bots and non-Adventure plugins that accept this shorthand instead of the split &x&r&r&g&g&b&b form.",
        json: "Raw Minecraft text component JSON, as used in /tellraw, books, and signs that accept JSON text.",
        bbcode: "BBCode for forum signatures: [COLOR=#rrggbb] around every character, wrapped in whole-string [BOLD]/[ITALIC]/[UNDERLINE]/[STRIKETHROUGH] tags. BBCode has no obfuscated-text equivalent."
    };

    function buildOutput(format, text, hexColors, colors, mode, formatting) {
        if (format === "minimessage") return miniMessageOutput(text, hexColors, formatting);
        if (format === "shorthex") return MC.shortHexTagOutput(text, colors, formatting);
        if (format === "json") return MC.jsonOutput(text, colors, formatting);
        if (format === "ampflat") return MC.flatHexOutput(text, colors, formatting);
        if (format === "bbcode") return MC.bbcodeOutput(text, colors, formatting);
        var prefix = format === "section" ? "§" : "&";
        return MC.legacyOutput(text, colors, prefix, formatting);
    }

    var currentOutput = "";
    var obfuscateTimer = null;
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var colorList = null;

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
        if (window.ShadeTools.prefersReducedMotion()) return;
        obfuscateTimer = setInterval(function () {
            spans.forEach(function (span, i) {
                if (chars[i] === " ") return;
                span.textContent = SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
            });
        }, 60);
    }

    function update() {
        var text = document.getElementById("input-text").value;
        var mode = document.getElementById("mode-select").value;
        var format = document.getElementById("format-select").value;
        var formatting = MC.readFormatting();
        var hexColors = colorList.getColors();

        var colors = MC.buildGradientColors(text.length, hexColors, mode);
        renderPreview(text, colors, formatting);

        currentOutput = text ? buildOutput(format, text, hexColors, colors, mode, formatting) : "";
        window.ShadeTools.renderOutput(currentOutput);
        document.getElementById("format-note").textContent = FORMAT_NOTES[format];
    }

    /* ---------------------------------------------------------------
     * Init
     * ------------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        colorList = MC.createColorList({
            container: document.getElementById("color-list"),
            addButton: document.getElementById("add-color"),
            initialColors: ["#6339d9", "#16c2d1"],
            onChange: update
        });

        document.getElementById("input-text").addEventListener("input", update);
        document.getElementById("mode-select").addEventListener("change", update);
        document.getElementById("format-select").addEventListener("change", update);
        ["fmt-bold", "fmt-italic", "fmt-underline", "fmt-strikethrough", "fmt-obfuscate"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", update);
        });

        document.getElementById("copy-btn").addEventListener("click", function () {
            window.ShadeTools.copyToClipboard(currentOutput, this);
        });

        update();
    });
})();
