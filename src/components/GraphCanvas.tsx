/**
 * GraphCanvas — renders a graph as SVG: edges, then colored vertices with
 * labels. Optionally shows a small saturation badge per vertex and reports
 * hover, so the DSATUR animator can drive it. Pure presentational component.
 */
import { colorForClass, UNCOLORED_FILL, NODE_BORDER, EDGE_COLOR } from "../theme.ts";

export interface GraphCanvasProps {
    n: number;
    edges: [number, number][];
    layout: [number, number][];
    /** color[v] per vertex; -1 or missing = uncolored */
    coloring?: number[];
    /** small number badge per vertex (e.g. saturation); null = no badge */
    badges?: (number | null)[];
    /** vertex to emphasize (pulsing ring) */
    highlightNode?: number | null;
    /** hover reporting for the saturation inspector */
    onHoverNode?: (v: number | null) => void;
    /** viewBox side length in SVG units */
    size?: number;
}

export default function GraphCanvas({
    n, edges, layout, coloring, badges, highlightNode = null, onHoverNode, size = 600,
}: GraphCanvasProps) {
    const pad = 40;
    const span = size - 2 * pad;
    const px = (x: number) => pad + x * span;
    const py = (y: number) => pad + y * span;
    const r = Math.max(8, Math.min(20, 320 / Math.max(n, 1)));

    const colorOf = (v: number) => {
        const c = coloring?.[v];
        return c === undefined || c === null || c < 0 ? UNCOLORED_FILL : colorForClass(c);
    };

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label="graph"
        >
            <g>
                {edges.map(([a, b], i) => (
                    <line
                        key={`e${i}`}
                        x1={px(layout[a][0])} y1={py(layout[a][1])}
                        x2={px(layout[b][0])} y2={py(layout[b][1])}
                        stroke={EDGE_COLOR} strokeWidth={2}
                    />
                ))}
            </g>
            <g>
                {Array.from({ length: n }, (_, v) => {
                    const cx = px(layout[v][0]);
                    const cy = py(layout[v][1]);
                    const isHi = v === highlightNode;
                    const badge = badges?.[v];
                    return (
                        <g
                            key={`v${v}`}
                            onMouseEnter={onHoverNode ? () => onHoverNode(v) : undefined}
                            onMouseLeave={onHoverNode ? () => onHoverNode(null) : undefined}
                            style={onHoverNode ? { cursor: "pointer" } : undefined}
                        >
                            {isHi && (
                                <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="#f5a8c8" strokeWidth={4}>
                                    <animate attributeName="r" values={`${r + 4};${r + 9};${r + 4}`} dur="1.1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <circle cx={cx} cy={cy} r={r} fill={colorOf(v)} stroke={NODE_BORDER} strokeWidth={1.5} />
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                fontSize={Math.max(9, r * 0.8)} fontWeight={600} fill="#3a3450">{v}</text>
                            {badge !== null && badge !== undefined && (
                                <>
                                    <circle cx={cx + r * 0.85} cy={cy - r * 0.85} r={r * 0.55} fill="#E8E2F4" stroke="#d8cdec" strokeWidth={1} />
                                    <text x={cx + r * 0.85} y={cy - r * 0.85} textAnchor="middle" dominantBaseline="central"
                                        fontSize={Math.max(8, r * 0.6)} fontWeight={700} fill="#6A4C93">{badge}</text>
                                </>
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
