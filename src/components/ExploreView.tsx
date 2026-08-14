/**
 * ExploreView — pick any algorithm to color the graph, see its colors/time/gap,
 * reveal the optimal coloring for a heuristic-vs-optimal comparison, and read
 * the full leaderboard. All from precomputed results in the GraphEntry.
 */
import { useEffect, useState } from "react";
import type { GraphEntry } from "../lib/types.ts";
import GraphCanvas from "./GraphCanvas.tsx";
import AlgorithmPicker from "./AlgorithmPicker.tsx";
import Leaderboard from "./LeaderBoard.tsx";

const ORDER = [
    "Welsh-Powell", "DSATUR", "Simulated Annealing",
    "Brute-Force DFS", "DSATUR Branch & Bound", "Integer Linear Program",
];
const EXACT = new Set(["Brute-Force DFS", "DSATUR Branch & Bound", "Integer Linear Program"]);

function fmtMs(seconds: number): string {
    const ms = seconds * 1000;
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 1000) return `${ms.toFixed(1)} ms`;
    return `${seconds.toFixed(2)} s`;
}

export default function ExploreView({ entry }: { entry: GraphEntry }) {
    const present = ORDER.filter((n) => entry.results[n]);
    const [algo, setAlgo] = useState(present.includes("DSATUR") ? "DSATUR" : present[0]);
    const [showOptimal, setShowOptimal] = useState(false);

    useEffect(() => {
        setAlgo(entry.results["DSATUR"] ? "DSATUR" : ORDER.filter((n) => entry.results[n])[0]);
        setShowOptimal(false);
    }, [entry.id]);
    useEffect(() => { setShowOptimal(false); }, [algo]);

    const res = entry.results[algo];
    const optimal = entry.results["DSATUR Branch & Bound"] ?? entry.results["Brute-Force DFS"];
    const chi = entry.knownChi;
    const isHeuristic = !EXACT.has(algo);
    const canReveal = isHeuristic && !!optimal;

    if (!res) {
        return (
            <div className="explore">
                <AlgorithmPicker names={present} exactSet={EXACT} selected={algo} onSelect={setAlgo} />
                <p className="caption">Computing…</p>
            </div>
        );
    }

    const coloring = showOptimal && optimal ? optimal.coloring : res.coloring;
    const shownColors = showOptimal && optimal ? optimal.colors : res.colors;
    const gap = chi === null ? null : res.colors - chi;

    return (
        <div className="explore">
            <AlgorithmPicker names={present} exactSet={EXACT} selected={algo} onSelect={setAlgo} />

            <div className="algo-stats">
                <span className="chip-stat"><b>{shownColors}</b> colors</span>
                {gap !== null && (
                    <span className={`chip-stat ${gap === 0 ? "good" : "over"}`}>
                        {gap === 0 ? "✓ matches optimal" : `+${gap} vs χ=${chi}`}
                    </span>
                )}
                <span className="chip-stat dim">{fmtMs(res.seconds)}</span>
                {!res.valid && <span className="chip-stat over">invalid!</span>}
                {canReveal && (
                    <button className="reveal-btn" onClick={() => setShowOptimal((s) => !s)}>
                        {showOptimal ? "↩ Back to " + algo : "✨ Reveal optimal (χ)"}
                    </button>
                )}
            </div>

            <div className="canvas-wrap">
                <GraphCanvas n={entry.n} edges={entry.edges} layout={entry.layout} coloring={coloring} />
            </div>

            <p className="caption">
                {showOptimal
                    ? <>Optimal coloring — <b>{optimal!.colors}</b> colors (χ). {gap && gap > 0
                        ? <>{algo} used {res.colors}, so it wasted <b>{gap}</b> color{gap === 1 ? "" : "s"}.</>
                        : <>{algo} already matched this.</>}</>
                    : <>Colored by <b>{algo}</b> using <b>{res.colors}</b> colors.</>}
            </p>

            <Leaderboard entry={entry} order={ORDER} exactSet={EXACT} />
        </div>
    );
}
