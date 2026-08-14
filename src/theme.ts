/**
 * Shared design tokens for the demo — the pastel palette from the LaTeX report,
 * plus the per-color-class palette used to paint vertices.
 */

/** UI chrome colors (backgrounds, text, borders, accents). */
export const UI = {
    bg: "#fbfaff",
    card: "#ffffff",
    line: "#e7e2f2",
    ink: "#3a3450",
    inkSoft: "#6a6280",
    lavenderDeep: "#6A4C93",
    lavenderSoft: "#E8E2F4",
    mint: "#C8F2E0",
    teal: "#2A9D8F",
    pink: "#f5a8c8",
    peach: "#F5C99B",
} as const;

/** Colors used to paint vertex color-classes (0, 1, 2, ...). */
export const NODE_PALETTE = [
    "#F7B7C8", // pink
    "#C9B7E8", // lavender
    "#B7E8CE", // mint
    "#A9D3F0", // baby blue
    "#F5C99B", // peach
    "#F5E6A8", // soft yellow
    "#E0B7E8", // orchid
    "#B7DCE8", // sky
    "#F5B7B7", // rose
    "#C8E6A0", // lime
] as const;

/** Color for class k; generates an HSL pastel beyond the fixed palette. */
export function colorForClass(k: number): string {
    if (k < 0) return "#f0edf7"; // uncolored
    return k < NODE_PALETTE.length ? NODE_PALETTE[k] : `hsl(${(k * 57) % 360}, 60%, 80%)`;
}

export const UNCOLORED_FILL = "#f0edf7";
export const NODE_BORDER = "#b9aed6";
export const EDGE_COLOR = "#d9d3ea";
