(function () {
    "use strict";

    /* ---------------------------------------------------------------
     * Color conversion + interpolation
     * Ported from birdflop/web's @birdflop/rgbirdflop package
     * (packages/rgbirdflop/src/util/Colors + ColorUtils), simplified
     * to plain functions instead of a class-per-color-space hierarchy.
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

    function rgbToHex(rgb) {
        return "#" + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    // RGB — linear interpolation in plain sRGB. Simple and predictable,
    // but can look muddy in the middle of a gradient between very
    // different hues (e.g. blue to red passes through gray-brown).
    function interpolateRgb(c1, c2, t) {
        return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
    }

    // HSL — interpolates hue around the color wheel via the shorter path,
    // so transitions stay vivid instead of desaturating in the middle.
    function rgbToHsl(rgb) {
        var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
        var h = 0, s = 0, l = (max + min) / 2;
        if (delta !== 0) {
            s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
            if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / delta + 2) / 6;
            else h = ((r - g) / delta + 4) / 6;
        }
        return [h * 360, s * 100, l * 100];
    }

    function hslToRgb(hsl) {
        var h = hsl[0] / 360, s = hsl[1] / 100, l = hsl[2] / 100;
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            var hue2rgb = function (p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [r * 255, g * 255, b * 255];
    }

    function interpolateHsl(hsl1, hsl2, t) {
        var s = lerp(hsl1[1], hsl2[1], t);
        var l = lerp(hsl1[2], hsl2[2], t);
        var h1 = hsl1[0], h2 = hsl2[0];
        var hDiff = h2 - h1;
        if (hDiff > 180) hDiff -= 360;
        else if (hDiff < -180) hDiff += 360;
        var h = h1 + hDiff * t;
        if (h < 0) h += 360;
        if (h >= 360) h -= 360;
        return [h, s, l];
    }

    // OKLab — perceptually uniform color space (Björn Ottosson,
    // https://bottosson.github.io/posts/oklab/). Equal steps in OKLab
    // look like equal steps to the human eye, so gradients stay smooth
    // and don't pass through unexpected muddy tones.
    function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function linearToSrgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

    function rgbToOklab(rgb) {
        var r = srgbToLinear(rgb[0] / 255), g = srgbToLinear(rgb[1] / 255), b = srgbToLinear(rgb[2] / 255);
        var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
        var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
        return [
            0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
        ];
    }

    function oklabToRgb(lab) {
        var l_ = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
        var m_ = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
        var s_ = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2];
        var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
        var r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        var g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        var b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
        return [
            Math.max(0, Math.min(255, linearToSrgb(r) * 255)),
            Math.max(0, Math.min(255, linearToSrgb(g) * 255)),
            Math.max(0, Math.min(255, linearToSrgb(b) * 255))
        ];
    }

    function interpolateOklab(l1, l2, t) {
        return [lerp(l1[0], l2[0], t), lerp(l1[1], l2[1], t), lerp(l1[2], l2[2], t)];
    }

    var MODES = {
        rgb: { toSpace: function (rgb) { return rgb; }, fromSpace: function (c) { return c; }, interpolate: interpolateRgb },
        hsl: { toSpace: rgbToHsl, fromSpace: hslToRgb, interpolate: interpolateHsl },
        oklab: { toSpace: rgbToOklab, fromSpace: oklabToRgb, interpolate: interpolateOklab }
    };

    // Any number of color stops, evenly distributed across the text.
    function buildGradientColors(length, hexColors, mode) {
        var colors = [];
        if (hexColors.length === 1) {
            for (var i = 0; i < length; i++) colors.push(hexColors[0]);
            return colors;
        }

        var space = MODES[mode] || MODES.rgb;
        var stops = hexColors.map(function (h) { return space.toSpace(hexToRgb(h)); });
        var segments = stops.length - 1;

        for (var idx = 0; idx < length; idx++) {
            var t = length === 1 ? 0 : idx / (length - 1);
            var segF = t * segments;
            var segIdx = Math.min(Math.floor(segF), segments - 1);
            var localT = segF - segIdx;
            var interpolated = space.interpolate(stops[segIdx], stops[segIdx + 1], localT);
            colors.push(rgbToHex(space.fromSpace(interpolated)));
        }
        return colors;
    }

    /* ---------------------------------------------------------------
     * Output formats
     * ------------------------------------------------------------- */
    // Legacy per-character hex color codes (Minecraft Java Edition 1.16+).
    // A color code resets bold/italic/etc, so format codes are reinserted
    // after every color code rather than once at the start. Spaces carry
    // no visible color and are left uncoded to keep the output shorter.
    function legacyOutput(text, colors, prefix, formatting) {
        var fmtCodes = "";
        if (formatting.bold) fmtCodes += prefix + "l";
        if (formatting.italic) fmtCodes += prefix + "o";
        if (formatting.underline) fmtCodes += prefix + "n";
        if (formatting.strikethrough) fmtCodes += prefix + "m";
        if (formatting.obfuscate) fmtCodes += prefix + "k";

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
            out += fmtCodes + ch;
        }
        return out;
    }

    var FORMAT_TAGS = {
        bold: "b", italic: "i", underline: "u", strikethrough: "st", obfuscate: "obf"
    };

    function wrapMiniMessageFormatting(inner, formatting) {
        var out = inner;
        ["obfuscate", "strikethrough", "underline", "italic", "bold"].forEach(function (key) {
            if (formatting[key]) {
                var tag = FORMAT_TAGS[key];
                out = "<" + tag + ">" + out + "</" + tag + ">";
            }
        });
        return out;
    }

    function miniMessageOutput(text, hexColors, colors, mode, formatting) {
        var inner;
        if (mode === "rgb") {
            // Adventure's native <gradient:...> tag interpolates in plain
            // RGB, matching this mode exactly — a compact tag is enough.
            inner = "<gradient:" + hexColors.join(":") + ">" + text + "</gradient>";
        } else {
            // HSL/OKLab have no MiniMessage-native equivalent, so emit the
            // computed color explicitly before each character instead.
            var out = "";
            for (var i = 0; i < text.length; i++) {
                var ch = text[i];
                out += ch === " " ? ch : "<" + colors[i] + ">" + ch;
            }
            inner = out;
        }
        return wrapMiniMessageFormatting(inner, formatting);
    }

    function jsonOutput(text, colors, formatting) {
        var extra = [];
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var obj = { text: ch };
            if (ch !== " ") obj.color = colors[i];
            if (formatting.bold) obj.bold = true;
            if (formatting.italic) obj.italic = true;
            if (formatting.underline) obj.underlined = true;
            if (formatting.strikethrough) obj.strikethrough = true;
            if (formatting.obfuscate) obj.obfuscated = true;
            extra.push(obj);
        }
        return JSON.stringify({ text: "", extra: extra }, null, 2);
    }

    var FORMAT_NOTES = {
        minimessage: "MiniMessage works directly in Paper/Adventure-based plugin configs. RGB mode emits a compact <gradient> tag; HSL/OKLab emit an explicit color before each character, since Adventure's own gradient tag only interpolates in RGB.",
        section: "Legacy format using § (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this for raw text components and resource packs.",
        amp: "Legacy format using & (Minecraft Java Edition 1.16+): a hex color code is inserted before every character. Use this wherever a plugin auto-translates ampersand codes — most Bukkit/Spigot configs.",
        json: "Raw Minecraft text component JSON, as used in /tellraw, books, and signs that accept JSON text."
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
        if (format === "json") return jsonOutput(text, colors, formatting);
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
