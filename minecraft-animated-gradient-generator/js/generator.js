(function () {
    "use strict";

    var MC = window.ShadeToolsMC;
    var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    /* ---------------------------------------------------------------
     * Per-frame output builders — reuse the shared per-character
     * builders by first expanding each frame's per-segment colors into
     * a per-character array (buildAnimationFrames groups characters
     * into color bands when "color band size" > 1).
     * ------------------------------------------------------------- */
    function frameLine(format, text, segments, frameColors, formatting) {
        var perChar = MC.expandSegmentColors(segments, frameColors);
        if (format === "minimessage") return MC.wrapMiniMessageFormatting(MC.miniMessagePerChar(text, perChar), formatting);
        if (format === "shorthex") return MC.shortHexTagOutput(text, perChar, formatting);
        if (format === "json") return MC.jsonOutputCompact(text, perChar, formatting);
        if (format === "ampflat") return MC.flatHexOutput(text, perChar, formatting);
        if (format === "bbcode") return MC.bbcodeOutput(text, perChar, formatting);
        var prefix = format === "section" ? "§" : "&";
        return MC.legacyOutput(text, perChar, prefix, formatting);
    }

    // TAB plugin animations.yml block: `<name>:\n  change-interval: <n>\n  texts:\n  - "<frame>"...`
    function tabYamlOutput(name, speed, frameLines) {
        var lines = frameLines.map(function (line) {
            return '  - "' + line.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        });
        return (name || "gradient") + ":\n  change-interval: " + speed + "\n  texts:\n" + lines.join("\n");
    }

    var FORMAT_NOTES = {
        minimessage: "MiniMessage works directly in Paper/Adventure-based plugin configs, including TAB when its MiniMessage support is enabled. Every animated frame uses an explicit color before each character, since Adventure's compact <gradient> tag can't express a scanning animation.",
        shorthex: "The <#rrggbb> shorthand tag before each character in every frame, standalone rather than wrapped in a MiniMessage gradient tag.",
        section: "Legacy format using § (Minecraft Java Edition 1.16+). Works with TAB out of the box; a hex color code is inserted before every character in each frame.",
        amp: "Legacy format using & (Minecraft Java Edition 1.16+). Use this wherever a plugin auto-translates ampersand codes; a hex color code is inserted before every character in each frame.",
        ampflat: "A flatter &#rrggbb color code before every character in each frame, without per-digit splitting.",
        json: "Raw Minecraft text component JSON per frame. Most TAB versions expect a plain formatted string per line, not JSON — check your TAB version supports JSON animation frames before using this.",
        bbcode: "BBCode for forum signatures: [COLOR=#rrggbb] around every character in each frame, wrapped in whole-string [BOLD]/[ITALIC]/[UNDERLINE]/[STRIKETHROUGH] tags. Not a TAB format — for pasting an animated-looking frame elsewhere."
    };

    /* ---------------------------------------------------------------
     * State
     * ------------------------------------------------------------- */
    var state = {
        colors: ["#6339d9", "#16c2d1"]
    };

    var currentOutput = "";
    var scrambleTimer = null;
    var frameTimer = null;
    var currentFrames = null;
    var currentSegments = null;
    var currentFrameIndex = 0;

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
     * Preview
     * ------------------------------------------------------------- */
    function stopTimers() {
        if (scrambleTimer) { clearInterval(scrambleTimer); scrambleTimer = null; }
        if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
    }

    function renderPreviewFrame(text, formatting) {
        var preview = document.getElementById("preview");
        if (!currentFrames || !currentFrames.length) return;

        var frameColors = currentFrames[currentFrameIndex % currentFrames.length];
        var perChar = MC.expandSegmentColors(currentSegments, frameColors);

        preview.innerHTML = "";
        var chars = text.split("");
        chars.forEach(function (ch, i) {
            var span = document.createElement("span");
            span.textContent = formatting.obfuscate && ch !== " " && !prefersReducedMotion()
                ? SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)]
                : ch;
            span.style.color = perChar[i] || "inherit";
            preview.appendChild(span);
        });
    }

    function startPreview(text, formatting, speedTicks) {
        stopTimers();
        applyPreviewClasses(formatting);

        renderPreviewFrame(text, formatting);
        if (prefersReducedMotion()) return;

        var ms = Math.max(50, speedTicks * 50);
        frameTimer = setInterval(function () {
            currentFrameIndex = (currentFrameIndex + 1) % currentFrames.length;
            renderPreviewFrame(text, formatting);
        }, ms);
    }

    function applyPreviewClasses(formatting) {
        var preview = document.getElementById("preview");
        preview.classList.toggle("st-fmt-bold", formatting.bold);
        preview.classList.toggle("st-fmt-italic", formatting.italic);
        preview.classList.toggle("st-fmt-underline", formatting.underline);
        preview.classList.toggle("st-fmt-strikethrough", formatting.strikethrough);
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

    /* ---------------------------------------------------------------
     * Main update
     * ------------------------------------------------------------- */
    function update() {
        var text = document.getElementById("input-text").value;
        var mode = document.getElementById("mode-select").value;
        var style = Number(document.getElementById("style-select").value);
        var band = Math.max(1, Math.min(10, Number(document.getElementById("band-input").value) || 1));
        var speed = Math.max(1, Math.min(1000, Number(document.getElementById("speed-input").value) || 1));
        var name = document.getElementById("name-input").value.trim() || "gradient";
        var format = document.getElementById("format-select").value;
        var formatting = getFormatting();

        var preview = document.getElementById("preview");

        if (!text) {
            stopTimers();
            currentFrames = null;
            currentSegments = null;
            preview.innerHTML = '<span class="st-output-placeholder">Type something to preview the animation</span>';
            currentOutput = "";
            renderOutput("");
            document.getElementById("frame-note").textContent = "";
            return;
        }

        var built = MC.buildAnimationFrames(text, state.colors, mode, band, style);
        currentSegments = built.segments;
        currentFrames = built.frames;
        currentFrameIndex = 0;

        startPreview(text, formatting, speed);

        var frameLines = currentFrames.map(function (frameColors) {
            return frameLine(format, text, currentSegments, frameColors, formatting);
        });
        currentOutput = tabYamlOutput(name, speed, frameLines);
        renderOutput(currentOutput);

        var noteEl = document.getElementById("frame-note");
        noteEl.textContent = currentFrames.length + " frame" + (currentFrames.length === 1 ? "" : "s") + " generated. " + (FORMAT_NOTES[format] || "");
    }

    /* ---------------------------------------------------------------
     * Init
     * ------------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        renderColorList();

        ["input-text", "mode-select", "style-select", "band-input", "speed-input", "name-input", "format-select"].forEach(function (id) {
            var el = document.getElementById(id);
            el.addEventListener("input", update);
            el.addEventListener("change", update);
        });
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
