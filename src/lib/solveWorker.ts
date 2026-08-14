/**
 * solveWorker — runs the coloring solvers off the main thread.
 *
 * Key ordering: we post "ready" with ONLY the fast heuristics so the graph
 * renders instantly at any size. The exact solvers (B&B, ILP, brute-force) then
 * stream in as separate "result" messages and may be cut off by the main
 * thread's timeout without ever blocking the graph's display.
 *
 * Protocol (worker → main):
 *   { type: "ready",  entry }            // graph + Welsh-Powell, DSATUR, SA
 *   { type: "result", name, result }     // an exact solver finished (B&B carries χ)
 *   { type: "done" }
 */
import type { Graph, Coloring, SolverResult, GraphEntry } from "./types.ts";
import { randomGraph, springLayout, edgeList } from "./graphs.ts";
import {
    welshPowell, dsatur, simulatedAnnealing, bruteForceDfs, dsaturBranchAndBound,
    dsaturSteps, colorsUsed, isProperColoring,
} from "./coloring.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = self;

// brute-force DFS is unpruned; only attempt it where it's known to be quick
const BRUTE_CAP = 14;

ctx.onmessage = async (e: MessageEvent) => {
    const { n, p, seed, exactCap } = e.data as { n: number; p: number; seed: number; exactCap: number };

    const adj: Graph = randomGraph(n, p, seed);
    const edges = edgeList(adj);
    const layout = springLayout(adj, seed);
    const { steps } = dsaturSteps(adj);

    const timed = (fn: (a: Graph) => Coloring): SolverResult => {
        const t = performance.now();
        const coloring = fn(adj);
        const seconds = (performance.now() - t) / 1000;
        return { colors: colorsUsed(coloring), coloring, valid: isProperColoring(adj, coloring), seconds: +seconds.toFixed(6) };
    };

    // --- fast heuristics only → post "ready" so the graph shows immediately ---
    const results: Record<string, SolverResult> = {
        "Welsh-Powell": timed(welshPowell),
        "DSATUR": timed(dsatur),
        "Simulated Annealing": timed((a) => simulatedAnnealing(a, { seed: 0 })),
    };
    const entry: GraphEntry = {
        id: `live-${seed}`, name: `Your graph (n=${n}, p=${p})`, category: "random",
        n, m: edges.length, knownChi: null, edges, layout, results, dsaturSteps: steps,
    };
    ctx.postMessage({ type: "ready", entry });

    // --- exact solvers stream in afterwards ---
    if (n <= exactCap) {
        ctx.postMessage({ type: "result", name: "DSATUR Branch & Bound", result: timed(dsaturBranchAndBound) });
        try {
            const { integerLinearProgram } = await import("./ilp.ts");
            ctx.postMessage({ type: "result", name: "Integer Linear Program", result: timed(integerLinearProgram) });
        } catch { /* ILP unavailable — skip */ }
    }
    if (n <= BRUTE_CAP) {
        try { ctx.postMessage({ type: "result", name: "Brute-Force DFS", result: timed(bruteForceDfs) }); }
        catch { /* skip */ }
    }

    ctx.postMessage({ type: "done" });
};
