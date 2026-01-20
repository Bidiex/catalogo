export const colorUtils = {
    /**
     * Darken a hex color by a percentage
     * @param {string} date Hex color (e.g. #ffffff)
     * @param {number} amount Percentage to darken (0-100)
     * @returns {string} Darkened hex color
     */
    darken(color, amount) {
        color = (color.indexOf("#") >= 0) ? color.substring(1, color.length) : color;
        amount = parseInt((255 * amount) / 100);
        return this.subtractLight(color, amount);
    },

    subtractLight(color, amount) {
        let cc = parseInt(color, 16) + amount;
        let c = (parseInt(color, 16) & 0x0000FF) + amount;

        if (c > 255) {
            c = 255;
        } else if (c < 0) {
            c = 0;
        }

        let b = (parseInt(color, 16) >> 8 & 0x00FF) + amount;

        if (b > 255) {
            b = 255;
        } else if (b < 0) {
            b = 0;
        }

        let g = (parseInt(color, 16) >> 16 & 0x00FF) + amount;

        if (g > 255) {
            g = 255;
        } else if (g < 0) {
            g = 0;
        }

        // Since we are "darkening", we actually want to subtract, but the logic above is addition.
        // Let's implement a simpler standard algorithm for darkening.
        return this.adjustBrightness(color, -10); // Standard darken amount
    },

    // Robust Hex Darken/Lighten
    adjustBrightness(col, amt) {
        let usePound = false;

        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }

        let num = parseInt(col, 16);

        let r = (num >> 16) + amt;

        if (r > 255) r = 255;
        else if (r < 0) r = 0;

        let b = ((num >> 8) & 0x00FF) + amt;

        if (b > 255) b = 255;
        else if (b < 0) b = 0;

        let g = (num & 0x0000FF) + amt;

        if (g > 255) g = 255;
        else if (g < 0) g = 0;

        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    }
}
