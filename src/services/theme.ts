
export const ACCENT_COLOR_KEY = 'rovena-accent-color';
export const DEFAULT_ACCENT_COLOR = '#7c3aed';

export function hexToRgb(hex: string): string | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : null;
}

export function adjustColor(color: string, amount: number): string {
    const clamp = (val: number) => Math.min(Math.max(val, 0), 255);
    const fill = (str: string) => str.length === 1 ? '0' + str : str;

    let r = parseInt(color.substring(1, 3), 16);
    let g = parseInt(color.substring(3, 5), 16);
    let b = parseInt(color.substring(5, 7), 16);

    r = clamp(r + amount);
    g = clamp(g + amount);
    b = clamp(b + amount);

    return '#' + fill(r.toString(16)) + fill(g.toString(16)) + fill(b.toString(16));
}

export function getSecondaryColor(hex: string): string {
    // Convert hex to HSL to easily rotate hue
    let r = parseInt(hex.substring(1, 3), 16) / 255;
    let g = parseInt(hex.substring(3, 5), 16) / 255;
    let b = parseInt(hex.substring(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Rotate hue by 40 degrees for an analogous/secondary effect
    h = (h + 40 / 360) % 1;
    
    // Increase lightness for the secondary color
    l = Math.min(l + 0.1, 0.8);

    // Convert back to RGB
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);

    const toHex = (x: number) => {
        const hexVal = Math.round(x * 255).toString(16);
        return hexVal.length === 1 ? '0' + hexVal : hexVal;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function applyAccentColor(color: string) {
    const root = document.documentElement;
    const rgb = hexToRgb(color);
    const hoverColor = adjustColor(color, -20); // Darker for hover
    const secondaryColor = getSecondaryColor(color);

    root.style.setProperty('--accent-primary', color);
    root.style.setProperty('--accent-primary-hover', hoverColor);
    root.style.setProperty('--accent-secondary', secondaryColor);
    
    if (rgb) {
        root.style.setProperty('--accent-primary-rgb', rgb);
    }
    
    localStorage.setItem(ACCENT_COLOR_KEY, color);
}

export function loadAccentColor() {
    const savedColor = localStorage.getItem(ACCENT_COLOR_KEY) || DEFAULT_ACCENT_COLOR;
    applyAccentColor(savedColor);
    return savedColor;
}
