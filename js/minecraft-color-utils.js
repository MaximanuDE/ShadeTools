/* ---------------------------------------------------------------
 * Shared Minecraft gradient color math + output-format builders,
 * used by both /minecraft-gradient-generator/ and
 * /minecraft-animated-gradient-generator/. Ported from birdflop/web's
 * @birdflop/rgbirdflop package (packages/rgbirdflop/src/util/Colors +
 * ColorUtils + RGBUtils + AnimTABUtils), simplified from a
 * class-per-color-space hierarchy into plain functions. Also holds the
 * two small UI bits that were otherwise duplicated between both pages'
 * own scripts: the color-stop-list widget and the formatting-checkbox
 * reader. Exposed on window since each page's own script is its own
 * closure.
 * ------------------------------------------------------------- */
window.ShadeToolsMC = (function () {
    "use strict";

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

    // Multi-stop color stops pre-converted into a color space, ready for
    // repeated colorAtT() lookups without reconverting on every call.
    function prepareStops(hexColors, mode) {
        var space = MODES[mode] || MODES.rgb;
        return hexColors.map(function (h) { return space.toSpace(hexToRgb(h)); });
    }

    // Color at normalized position t (0-1) along a multi-stop gradient.
    function colorAtT(t, stops, mode) {
        var space = MODES[mode] || MODES.rgb;
        var segments = stops.length - 1;
        if (segments <= 0) return rgbToHex(space.fromSpace(stops[0]));
        var segF = t * segments;
        var segIdx = Math.min(Math.floor(segF), segments - 1);
        var localT = segF - segIdx;
        var interpolated = space.interpolate(stops[segIdx], stops[segIdx + 1], localT);
        return rgbToHex(space.fromSpace(interpolated));
    }

    // Any number of color stops, evenly distributed across `length`
    // positions (one static, non-animated gradient).
    function buildGradientColors(length, hexColors, mode) {
        var colors = [];
        if (hexColors.length === 1) {
            for (var i = 0; i < length; i++) colors.push(hexColors[0]);
            return colors;
        }
        var stops = prepareStops(hexColors, mode);
        for (var idx = 0; idx < length; idx++) {
            var t = length === 1 ? 0 : idx / (length - 1);
            colors.push(colorAtT(t, stops, mode));
        }
        return colors;
    }

    // Reflects a step count that may exceed `steps` back into [0, steps]
    // via a triangle wave (asin(sin(x)) trick), so an ever-increasing
    // animation frame offset produces a smooth back-and-forth scan
    // instead of jumping or clamping at the gradient's ends. For step
    // values already inside [0, steps] this is the identity function.
    function easedStep(step, steps) {
        if (steps < 1) return 0;
        return Math.round(Math.abs((2 * Math.asin(Math.sin(step * (Math.PI / (2 * steps)))) / Math.PI) * steps));
    }

    /* ---------------------------------------------------------------
     * Output formats
     * ------------------------------------------------------------- */
    // Shared per-character color-code builder: emits colorToken(hex) then
    // any format codes (reinserted after every color token, since a color
    // code resets bold/italic/etc in legacy-style text) then the character
    // itself. Spaces carry no visible color and are left uncoded.
    function colorCodeOutput(text, colors, formatting, prefix, colorToken) {
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
            out += colorToken(hex) + fmtCodes + ch;
        }
        return out;
    }

    // Legacy per-character hex color codes (Minecraft Java Edition 1.16+),
    // one digit at a time: §x§R§R§G§G§B§B / &x&R&R&G&G&B&B.
    function legacyOutput(text, colors, prefix, formatting) {
        return colorCodeOutput(text, colors, formatting, prefix, function (hex) {
            var token = prefix + "x";
            for (var j = 0; j < 6; j++) token += prefix + hex[j];
            return token;
        });
    }

    // Flat &#RRGGBB per character — no per-digit splitting. Used by some
    // Discord bots and non-Adventure plugins that accept this shorthand.
    function flatHexOutput(text, colors, formatting) {
        return colorCodeOutput(text, colors, formatting, "&", function (hex) {
            return "&#" + hex;
        });
    }

    // <#RRGGBB> shorthand tag per character, standalone (not wrapped in a
    // MiniMessage <gradient> or per-char color tag body) — some plugins
    // accept this hex shorthand mixed with legacy & format codes.
    function shortHexTagOutput(text, colors, formatting) {
        return colorCodeOutput(text, colors, formatting, "&", function (hex) {
            return "<#" + hex + ">";
        });
    }

    // BBCode, for forum signatures: [COLOR=#RRGGBB]char[/COLOR] per
    // character, wrapped in whole-string [BOLD]/[ITALIC]/[UNDERLINE]/
    // [STRIKETHROUGH] tags. BBCode has no obfuscated-text equivalent.
    function bbcodeOutput(text, colors, formatting) {
        var inner = "";
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            inner += ch === " " ? ch : "[COLOR=#" + colors[i].replace("#", "").toUpperCase() + "]" + ch + "[/COLOR]";
        }
        var out = inner;
        if (formatting.underline) out = "[UNDERLINE]" + out + "[/UNDERLINE]";
        if (formatting.strikethrough) out = "[STRIKETHROUGH]" + out + "[/STRIKETHROUGH]";
        if (formatting.italic) out = "[ITALIC]" + out + "[/ITALIC]";
        if (formatting.bold) out = "[BOLD]" + out + "[/BOLD]";
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

    // Compact native <gradient:c1:c2:...> tag — Adventure interpolates
    // this in plain RGB, so it only matches when mode === "rgb".
    function miniMessageGradientTag(hexColors, text) {
        return "<gradient:" + hexColors.join(":") + ">" + text + "</gradient>";
    }

    // Explicit per-character color, for modes Adventure's own gradient
    // tag can't express (HSL/OKLab), and as a fallback for animated
    // frames with custom (non-evenly-spaced) color-stop positions.
    function miniMessagePerChar(text, colors) {
        var out = "";
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            out += ch === " " ? ch : "<" + colors[i] + ">" + ch;
        }
        return out;
    }

    // Single flat color for the whole string — used for FULL_TEXT_CYCLE
    // animation frames, where every character already shares one color.
    function miniMessageColorTag(text, hex) {
        return "<color:" + hex + ">" + text + "</color>";
    }

    // One shifted color per original color stop for animation frame `n`,
    // so Adventure's native <gradient:...> tag can render the same
    // scanning effect itself instead of needing an explicit color before
    // every character. Ported from birdflop/web's AnimTABUtils.
    // formatFrames: each original stop gets its own copy of the gradient,
    // offset by a fraction of the total steps proportional to its index,
    // so the N stops sweep past each other in sync with the frame scan.
    // Note Adventure's <gradient> tag itself always interpolates the
    // pixels *between* these stops in plain RGB, so in HSL/OKLab modes
    // the in-game look is a close approximation rather than an exact
    // match to the tool's own preview.
    function shiftedGradientStops(n, hexColors, mode, totalSteps) {
        var stops = prepareStops(hexColors, mode);
        var numColors = hexColors.length;
        var out = [];
        for (var i = 0; i < numColors; i++) {
            var offset = totalSteps <= 0 ? 0 : (n + i * (totalSteps / numColors)) % totalSteps;
            var step = easedStep(offset, totalSteps);
            var t = totalSteps <= 0 ? 0 : step / totalSteps;
            out.push(colorAtT(t, stops, mode));
        }
        if (out.length < 2) out.push(out[0]);
        return out;
    }

    /* ---------------------------------------------------------------
     * Animated (TAB plugin) frame generation
     * ------------------------------------------------------------- */
    var ANIMATION_STYLES = {
        LEFT_TO_RIGHT: 1,
        RIGHT_TO_LEFT: 2,
        BOUNCING: 3,
        FULL_TEXT_CYCLE: 4
    };

    // Groups text into chunks of `colorLength` characters that share one
    // color per frame — a colorLength above 1 makes the animation read as
    // wider color bands sweeping across the text instead of a per-letter
    // shimmer, useful for longer strings.
    function segmentText(text, colorLength) {
        if (colorLength <= 1) return text.split("");
        var segments = [];
        for (var i = 0; i < text.length; i += colorLength) {
            segments.push(text.substring(i, i + colorLength));
        }
        return segments;
    }

    // Builds one color-per-segment frame for every animation tick.
    // Ported/simplified from birdflop/web's AnimTABUtils.generateAnimTABFrames:
    // each frame samples the gradient at a step offset by the frame index
    // plus the segment's position, reflected through easedStep() so the
    // scan direction reverses smoothly at the ends instead of jumping.
    // Whole-string rich per-selection formatting and custom (non-evenly-
    // spaced) color-stop positions from the original are not ported —
    // this generator always spaces stops evenly, matching the static
    // gradient generator.
    function buildAnimationFrames(text, hexColors, mode, colorLength, style) {
        var segments = segmentText(text, colorLength);
        var numSegments = segments.length;
        var stops = prepareStops(hexColors, mode);
        var totalSteps = Math.max(numSegments - 1, 1);
        var loopAmount = style === ANIMATION_STYLES.BOUNCING ? numSegments : numSegments * 2 - 2;
        if (loopAmount < 1) loopAmount = 1;

        var frames = [];
        var steps = [];
        for (var n = 0; n < loopAmount; n++) {
            steps.push(n);
            if (style === ANIMATION_STYLES.FULL_TEXT_CYCLE) {
                var soloStep = easedStep(n, totalSteps);
                var soloT = totalSteps <= 0 ? 0 : soloStep / totalSteps;
                var soloColor = colorAtT(soloT, stops, mode);
                frames.push(segments.map(function () { return soloColor; }));
                continue;
            }
            var frameColors = [];
            for (var i = 0; i < numSegments; i++) {
                if (/^\s+$/.test(segments[i])) {
                    frameColors.push(null);
                    continue;
                }
                var step = easedStep(n + i, totalSteps);
                var t = totalSteps <= 0 ? 0 : step / totalSteps;
                frameColors.push(colorAtT(t, stops, mode));
            }
            frames.push(frameColors);
        }

        // `steps` tracks each frame's original generation index (n) so
        // that shiftedGradientStops() can be called with the right n for
        // a given output frame even after this reordering — the frame
        // at output position k is not generally frame n=k any more.
        if (style === ANIMATION_STYLES.LEFT_TO_RIGHT) {
            frames.reverse();
            steps.reverse();
        } else if (style === ANIMATION_STYLES.BOUNCING) {
            frames = frames.slice().reverse().concat(frames.slice());
            steps = steps.slice().reverse().concat(steps.slice());
        }

        return { segments: segments, frames: frames, steps: steps, totalSteps: totalSteps };
    }

    // Expands one frame's per-segment colors into a per-character array,
    // so the existing per-character output builders (legacyOutput,
    // miniMessagePerChar, jsonOutput) can be reused unchanged.
    function expandSegmentColors(segments, frameColors) {
        var out = [];
        segments.forEach(function (seg, i) {
            var c = frameColors[i];
            for (var j = 0; j < seg.length; j++) out.push(c);
        });
        return out;
    }

    function jsonComponent(text, colors, formatting) {
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
        return { text: "", extra: extra };
    }

    // Pretty-printed, for a single standalone code block.
    function jsonOutput(text, colors, formatting) {
        return JSON.stringify(jsonComponent(text, colors, formatting), null, 2);
    }

    // Single-line, for embedding as one frame inside a YAML `- "..."` list
    // item — a pretty-printed component's raw newlines would otherwise
    // break the line structure.
    function jsonOutputCompact(text, colors, formatting) {
        return JSON.stringify(jsonComponent(text, colors, formatting));
    }

    /* ---------------------------------------------------------------
     * Shared UI bits
     * ------------------------------------------------------------- */
    // The row of bold/italic/underline/strikethrough/obfuscate checkboxes
    // is identical markup (same IDs) on both Minecraft tool pages.
    function readFormatting() {
        return {
            bold: document.getElementById("fmt-bold").checked,
            italic: document.getElementById("fmt-italic").checked,
            underline: document.getElementById("fmt-underline").checked,
            strikethrough: document.getElementById("fmt-strikethrough").checked,
            obfuscate: document.getElementById("fmt-obfuscate").checked
        };
    }

    // The "list of hex color stops" widget (swatch + hex label + remove
    // button per row, plus an "add color" button) was duplicated
    // verbatim between both tools' scripts — this owns the color array,
    // renders it into `container`, and calls `onChange` with a copy of
    // the current colors after every edit. `getColors()` reads the
    // state back out on demand (e.g. right before building output).
    function createColorList(options) {
        var container = options.container;
        var addButton = options.addButton;
        var maxColors = options.maxColors || 8;
        var onChange = options.onChange || function () {};
        var colors = (options.initialColors || []).slice();

        function render() {
            container.innerHTML = "";

            colors.forEach(function (hex, i) {
                var row = document.createElement("div");
                row.className = "st-color-row-item";

                var swatch = document.createElement("input");
                swatch.type = "color";
                swatch.className = "st-color-swatch";
                swatch.value = hex;
                swatch.setAttribute("aria-label", "Color " + (i + 1));
                swatch.addEventListener("input", function () {
                    colors[i] = swatch.value;
                    hexLabel.textContent = swatch.value.toUpperCase();
                    onChange(colors.slice());
                });

                var hexLabel = document.createElement("span");
                hexLabel.className = "st-color-hex";
                hexLabel.textContent = hex.toUpperCase();

                row.appendChild(swatch);
                row.appendChild(hexLabel);

                if (colors.length > 2) {
                    var removeBtn = document.createElement("button");
                    removeBtn.type = "button";
                    removeBtn.className = "st-color-remove";
                    removeBtn.setAttribute("aria-label", "Remove color " + (i + 1));
                    removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
                    removeBtn.addEventListener("click", function () {
                        colors.splice(i, 1);
                        render();
                        onChange(colors.slice());
                    });
                    row.appendChild(removeBtn);
                }

                container.appendChild(row);
            });

            if (addButton) addButton.disabled = colors.length >= maxColors;
        }

        if (addButton) {
            addButton.addEventListener("click", function () {
                if (colors.length >= maxColors) return;
                colors.push("#ffffff");
                render();
                onChange(colors.slice());
            });
        }

        render();

        return {
            getColors: function () { return colors.slice(); }
        };
    }

    return {
        hexToRgb: hexToRgb,
        rgbToHex: rgbToHex,
        prepareStops: prepareStops,
        colorAtT: colorAtT,
        buildGradientColors: buildGradientColors,
        easedStep: easedStep,
        legacyOutput: legacyOutput,
        flatHexOutput: flatHexOutput,
        shortHexTagOutput: shortHexTagOutput,
        bbcodeOutput: bbcodeOutput,
        wrapMiniMessageFormatting: wrapMiniMessageFormatting,
        miniMessageGradientTag: miniMessageGradientTag,
        miniMessagePerChar: miniMessagePerChar,
        miniMessageColorTag: miniMessageColorTag,
        shiftedGradientStops: shiftedGradientStops,
        jsonOutput: jsonOutput,
        jsonOutputCompact: jsonOutputCompact,
        ANIMATION_STYLES: ANIMATION_STYLES,
        segmentText: segmentText,
        buildAnimationFrames: buildAnimationFrames,
        expandSegmentColors: expandSegmentColors,
        readFormatting: readFormatting,
        createColorList: createColorList
    };
})();
