/**
 * DsaturPlayer — replays a precomputed DSATUR step sequence with play / step /
 * reset controls, a progress bar, a running colors-used counter, a status line,
 * and a live saturation inspector (hover any vertex).
 *
 * Reads dsaturSteps (from demo_data.json or dsaturSteps() for live graphs); it
 * does not run the algorithm itself, so what you see matches the report exactly.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { DsaturStep, Graph } from "../lib/types.ts";
import { buildAdj } from "../lib/coloring.ts";
import GraphCanvas from "./GraphCanvas.tsx";
import { colorForClass } from "../theme.ts";

interface Props {
    n: number;
    edges: [number, number][];
    layout: [number, number][];
    steps: DsaturStep[];
}

const UNCOLORED = -1;
const STEP_MS = 800;

export default function DsaturPlayer({ n, edges, layout, steps }: Props) {
    const [applied, setApplied] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [hovered, setHovered] = useState<number | null>(null);

    const adj: Graph = useMemo(() => buildAdj(n, edges), [n, edges]);

    // partial coloring after `applied` steps
    const coloring = useMemo(() => {
        const c = new Array<number>(n).fill(UNCOLORED);
        for (let i = 0; i < applied; i++) c[steps[i].node] = steps[i].color;
        return c;
    }, [applied, n, steps]);

    // live saturation badge for each still-uncolored vertex
    const badges = useMemo(() => {
        return Array.from({ length: n }, (_, v) => {
            if (coloring[v] !== UNCOLORED) return null;
            const seen = new Set<number>();
            for (const u of adj[v]) if (coloring[u] !== UNCOLORED) seen.add(coloring[u]);
            return seen.size;
        });
    }, [coloring, adj, n]);

    const colorsUsedNow = useMemo(
        () => new Set(coloring.filter((c) => c !== UNCOLORED)).size,
        [coloring]
    );

    // advance while playing; stop at the end
    useEffect(() => {
        if (!playing) return;
        const id = setInterval(() => setApplied((a) => Math.min(a + 1, n)), STEP_MS);
        return () => clearInterval(id);
    }, [playing, n]);
    useEffect(() => { if (applied >= n) setPlaying(false); }, [applied, n]);
    // reset when the graph changes
    useEffect(() => { setApplied(0); setPlaying(false); setHovered(null); }, [steps]);

    const last = applied > 0 ? steps[applied - 1] : null;
    const highlight = last ? last.node : null;

    const togglePlay = () => {
        if (applied >= n) { setApplied(0); setPlaying(true); }
        else setPlaying((p) => !p);
    };
    const step = () => { setPlaying(false); setApplied((a) => Math.min(a + 1, n)); };
    const reset = () => { setPlaying(false); setApplied(0); };

    // saturation inspector text for the hovered vertex
    let inspector: ReactNode = <span className="dim">Hover a vertex to inspect its saturation.</span>;
    if (hovered !== null) {
        if (coloring[hovered] !== UNCOLORED) {
            inspector = <>Vertex <b>{hovered}</b> — colored <b>{coloring[hovered]}</b>.</>;
        } else {
            const seen = new Set<number>();
            for (const u of adj[hovered]) if (coloring[u] !== UNCOLORED) seen.add(coloring[u]);
            const list = [...seen].sort((a, b) => a - b);
            inspector = (
                <>
                    Vertex <b>{hovered}</b> — saturation <b>{seen.size}</b>
                    {list.length > 0 ? <> (neighbor colors {list.join(", ")})</> : <> (no colored neighbors yet)</>}
                </>
            );
        }
    }

    return (
        <div className="player">
            <div className="canvas-wrap">
                <GraphCanvas
                    n={n} edges={edges} layout={layout}
                    coloring={coloring} badges={badges}
                    highlightNode={highlight} onHoverNode={setHovered}
                />
            </div>

            <div className="progress-track">
                <div className="progress-fill" style={{ width: `${(applied / n) * 100}%` }} />
            </div>

            <div className="player-controls">
                <button className="player-btn primary" onClick={togglePlay}>
                    {playing ? "❚❚ Pause" : applied >= n ? "↻ Replay" : "▶ Play"}
                </button>
                <button className="player-btn" onClick={step} disabled={applied >= n}>Step ▸</button>
                <button className="player-btn" onClick={reset} disabled={applied === 0}>↺ Reset</button>
                <div className="counters">
                    <span><b>{applied}</b>/{n} colored</span>
                    <span><b>{colorsUsedNow}</b> color{colorsUsedNow === 1 ? "" : "s"}</span>
                </div>
            </div>

            <div className="status-line">
                {applied === 0 ? (
                    <>Ready. Badges show each uncolored vertex's <b>saturation degree</b> — DSATUR always colors the most saturated one next.</>
                ) : (
                    <>
                        Step {applied}/{n}: colored vertex <b>{last!.node}</b> (the most saturated, saturation {last!.saturation}) →{" "}
                        <span className="chip" style={{ background: colorForClass(last!.color) }}>color {last!.color}</span>.
                    </>
                )}
            </div>

            <div className="inspector">{inspector}</div>
        </div>
    );
}
