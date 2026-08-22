(function () {
    "use strict";

    /* ---------------------------------------------------------------
     * Small-capital Unicode look-alikes (Latin Extended-B/C/D and IPA
     * Extensions blocks). "q" and "s" use the dedicated small-capital
     * letters from Latin Extended-D; "x" has no such glyph and is left
     * as a regular lowercase x, which already reads reasonably small.
     * ------------------------------------------------------------- */
    var SMALL_CAPS_MAP = {
        a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ",
        f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ",
        k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ",
        p: "ᴘ", q: "ꞯ", r: "ʀ", s: "ꜱ", t: "ᴛ",
        u: "ᴜ", v: "ᴠ", w: "ᴡ", y: "ʏ", z: "ᴢ"
    };

    function toSmallCaps(text) {
        var out = "";
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var lower = ch.toLowerCase();
            out += Object.prototype.hasOwnProperty.call(SMALL_CAPS_MAP, lower) ? SMALL_CAPS_MAP[lower] : ch;
        }
        return out;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var input = document.getElementById("input-text");
        var currentOutput = "";

        input.addEventListener("input", function () {
            currentOutput = toSmallCaps(input.value);
            window.ShadeTools.renderOutput(currentOutput);
        });

        document.getElementById("copy-btn").addEventListener("click", function () {
            window.ShadeTools.copyToClipboard(currentOutput, document.getElementById("copy-btn"));
        });
    });
})();
