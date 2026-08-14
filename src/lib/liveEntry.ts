/**
 * buildLiveEntry — assemble a GraphEntry for a freshly generated random graph
 * by running the ported solvers.
 *
 * IMPORTANT (responsiveness): this runs synchronously, so on LIVE graphs we run
 * only fast solvers — the three heuristics plus DSATUR branch & bound (pruned,
 * fast). We deliberately OMIT unpruned brute-force DFS and the MILP-based ILP
 * here, since both can hang the UI at even modest sizes. Gallery graphs still
 * show all six solvers (precomputed by the Python export). Exact runs only up to
 * `exactCap` vertices, above which we show heuristics only (χ unknown).
 */
import type { Graph, Coloring, GraphEntry, SolverResult } from "./types.ts";
import { randomGraph, springLayout, edgeList } from "./graphs.ts";
import {
  welshPowell, dsatur, simulatedAnnealing, dsaturBranchAndBound,
  dsaturSteps, colorsUsed, isProperColoring,
} from "./coloring.ts";

export interface BuildOptions {
  /** largest n for which the exact solver runs; default 18 */
  exactCap?: number;
}

export function buildLiveEntry(n: number, p: number, seed: number, opts: BuildOptions = {}): GraphEntry {
  const exactCap = opts.exactCap ?? 18;
  const adj: Graph = randomGraph(n, p, seed);
  const edges = edgeList(adj);
  const layout = springLayout(adj, seed);

  const timed = (fn: (a: Graph) => Coloring): SolverResult => {
    const t = performance.now();
    const coloring = fn(adj);
    const seconds = (performance.now() - t) / 1000;
    return { colors: colorsUsed(coloring), coloring, valid: isProperColoring(adj, coloring), seconds: +seconds.toFixed(6) };
  };

  const results: Record<string, SolverResult> = {
    "Welsh-Powell": timed(welshPowell),
    "DSATUR": timed(dsatur),
    "Simulated Annealing": timed((a) => simulatedAnnealing(a, { seed: 0 })),
  };

  let knownChi: number | null = null;
  if (n <= exactCap) {
    results["DSATUR Branch & Bound"] = timed(dsaturBranchAndBound);
    knownChi = results["DSATUR Branch & Bound"].colors;
  }

  const { steps } = dsaturSteps(adj);
  return {
    id: `live-${seed}`,
    name: `Your graph (n=${n}, p=${p})`,
    category: "random",
    n, m: edges.length, knownChi, edges, layout, results, dsaturSteps: steps,
  };
}
