(function () {
    "use strict";

    /* ---------------------------------------------------------------
     * Color interpolation
     * ------------------------------------------------------------- */
    function hexToRgb(hex) {
        var clean = hex.replace("#", "");
        return [
            parseInt(clean.substring(0, 2), 16),
            parseInt(clean.substring(2, 4), 16),
            parseInt(clean.substring(4, 6), 16)
        ];
    }

    function componentToHex(n) {
        var hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }

    function rgbToHex(r, g, b) {
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function interpolate(startHex, endHex, t) {
        var start = hexToRgb(startHex);
        var end = hexToRgb(endHex);
        return rgbToHex(lerp(start[0], end[0], t), lerp(start[1], end[1], t), lerp(start[2], end[2], t));
    }

    function buildGradientColors(length, startHex, endHex) {
        var colors = [];
        for (var i = 0; i < length; i++) {
            var t = length === 1 ? 0 : i / (length - 1);
            colors.push(interpolate(startHex, endHex, t));
        }
        return colors;
    }

    /* ---------------------------------------------------------------
     * Output formats
     * ------------------------------------------------------------- */
    // Legacy per-character hex color codes (Minecraft Java Edition 1.16+).
    // Spaces carry no visible color, so they're left uncoded to keep the
    // output shorter without changing how it reads.
    function legacyOutput(text, colors, prefix) {
        var out = "";
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (ch === " ") {
                out += ch;
                continue;
            }
            var hex = colors[i].replace("#", "").toUpperCase();
            out += prefix + "x";
            for (var j = 0; j < 6; j++) out += prefix + hex[j];
            out += ch;
        }
        return out;
    }

    function miniMessageOutput(text, startHex, endHex) {
        return "<gradient:" + startHex + ":" + endHex + ">" + text + "</gradient>";
    }

    /* ---------------------------------------------------------------
     * Preview + wiring
     * ------------------------------------------------------------- */
    function renderPreview(text, colors) {
        var preview = document.getElementById("preview");
        preview.innerHTML = "";

        if (!text) {
            var placeholder = document.createElement("span");
            placeholder.className = "st-output-placeholder";
            placeholder.textContent = "Type something to preview the gradient";
            preview.appendChild(placeholder);
            return;
        }

        for (var i = 0; i < text.length; i++) {
            var span = document.createElement("span");
            span.textContent = text[i];
            span.style.color = colors[i];
            preview.appendChild(span);
        }
    }

    function update() {
        var text = document.getElementById("input-text").value;
        var startHex = document.getElementById("color-start").value;
        var endHex = document.getElementById("color-end").value;

        document.getElementById("color-start-hex").textContent = startHex.toUpperCase();
        document.getElementById("color-end-hex").textContent = endHex.toUpperCase();

        var colors = buildGradientColors(text.length, startHex, endHex);
        renderPreview(text, colors);

        document.getElementById("output-mini").textContent = text ? miniMessageOutput(text, startHex, endHex) : "";
        document.getElementById("output-section").textContent = text ? legacyOutput(text, colors, "§") : "";
        document.getElementById("output-amp").textContent = text ? legacyOutput(text, colors, "&") : "";
    }

    function wireCopyButton(buttonId, outputId) {
        document.getElementById(buttonId).addEventListener("click", function () {
            window.ShadeTools.copyToClipboard(document.getElementById(outputId).textContent, this);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.getElementById("input-text").addEventListener("input", update);
        document.getElementById("color-start").addEventListener("input", update);
        document.getElementById("color-end").addEventListener("input", update);

        wireCopyButton("copy-mini", "output-mini");
        wireCopyButton("copy-section", "output-section");
        wireCopyButton("copy-amp", "output-amp");

        update();
    });
})();
