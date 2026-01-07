
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

export function applyAccentColor(color: string) {
    const root = document.documentElement;
    const rgb = hexToRgb(color);
    const hoverColor = adjustColor(color, -20); // Darker for hover

    root.style.setProperty('--accent-primary', color);
    root.style.setProperty('--accent-primary-hover', hoverColor);
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
