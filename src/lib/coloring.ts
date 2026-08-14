/**
 * Graph-coloring algorithms (ported from Python's implementation into ts)
 *
 * Conventions
 *      graph: Graph = number[][], adj[v] = neighbors of v, nodes 0...n-1
 *      result: Coloring = number[], color[v] = color of vertex v
 *
 * "Uncolored" is represented internally by the sentinel UNCOLORED (-1) rather
 * than undefined, so working arrays stay typed as number[].
 *
 * ILP is added separately (src/lib/ilp.ts) since it needs a MILP library; the
 * five methods here are dependency-free and match the Python outputs
 */

import type { Graph, Coloring } from "./types.ts";
import type { DsaturStep } from "./types.ts";

const UNCOLORED = -1;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
/** Build an adjacency list from a vertex count and edge list */
export const buildAdj = (n: number, edges: [number, number][]): Graph => {
    const adj: Graph = Array.from({ length: n }, () => []);

    for (const [a, b] of edges) {
        adj[a].push(b);
        adj[b].push(a);
    }

    return adj;
};

/** Number of distinct colors used (ignores any uncolored sentinels) */
export const colorsUsed = (color: Coloring): number => {
    const color_set = new Set<number>();
    for (const curr_color of color) if (curr_color !== UNCOLORED) color_set.add(curr_color);
    return color_set.size;
};

/** True iff every vertex is colored and no edge joins two equal colors */
export const isProperColoring = (adj: Graph, color: Coloring): boolean => {
    if (color.length !== adj.length) return false;

    for (let v = 0; v < adj.length; v++) {
        if (color[v] === UNCOLORED) return false;
        for (const neigh of adj[v]) if (color[neigh] === color[v]) return false;
    }

    return true;
};

/** Smallest color in {0, 1, 2, ...} not present in usedSet */
const smallestAvailableColor = (usedSet: Set<number>): number => {
    let col = 0;
    while (usedSet.has(col)) col++;

    return col;
};

/** Deterministic seeded PRNG (mulberry32) -> floats in [0, 1) */
export const makeRng = (seed: number): () => number => {
    let a = seed >>> 0;
    return function (): number {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 42949667296;
    }
};

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/** Welsh–Powell: color greedily in fixed descending-degree order. */
export const welshPowell = (adj: Graph): Coloring => {
    const n = adj.length;
    const order = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length);
    const color: Coloring = new Array(n).fill(UNCOLORED);
    let current = 0;
    let colored = 0;
    while (colored < n) {
        for (const v of order) {
            if (color[v] !== UNCOLORED) continue;
            if (!adj[v].some((u) => color[u] === current)) {
                color[v] = current;
                colored++;
            }
        }
        current++;
    }

    return color;
};

/**
 * DSATUR: repeatedly color the uncolored vertex of highest saturation degree
 * (distinct neighbor colors), ties broken by degree then lowest index.
 */
export const dsatur = (adj: Graph): Coloring => {
    const n = adj.length;
    const color: Coloring = new Array(n).fill(UNCOLORED);
    let colored = 0;
    while (colored < n) {
        let best = -1, bestSat = -1, bestDeg = -1;
        for (let v = 0; v < n; v++) {
            if (color[v] !== UNCOLORED) continue;
            const seen = new Set<number>();
            for (const u of adj[v]) if (color[u] !== UNCOLORED) seen.add(color[u]);
            const sat = seen.size, deg = adj[v].length;
            if (sat > bestSat || (sat === bestSat && deg > bestDeg)) {
                best = v; bestSat = sat; bestDeg = deg;
            }
        }
        const used = new Set<number>();
        for (const u of adj[best]) if (color[u] !== UNCOLORED) used.add(color[u]);
        color[best] = smallestAvailableColor(used);
        colored++;
    }

    return color;
}

/** Count neighbors of `node` sharing its color (SA local delta). */
const nodeConflicts = (adj: Graph, color: Coloring, node: number): number => {
    let conflicts = 0;
    for (const u of adj[node]) if (color[u] === color[node]) conflicts++;
    return conflicts;
}

/** Total monochromatic edges. */
const totalConflicts = (adj: Graph, color: Coloring): number => {
    let conflicts = 0;
    for (let v = 0; v < adj.length; v++) for (const u of adj[v]) if (color[u] === color[v]) conflicts++;
    return conflicts / 2;
}

export interface SaOptions {
    seed?: number;
    initialTemperature?: number;
    coolingRate?: number;
    itersPerTemp?: number;
}

/**
 * Simulated annealing — port of simulated_annealing(). Fix a color budget k,
 * anneal to drive conflicts to zero, then lower k. Stochastic (seeded); output
 * is always a proper coloring.
 */
export const simulatedAnnealing = (adj: Graph, opts: SaOptions = {}): Coloring => {
    const { seed = 0, initialTemperature = 10.0, coolingRate = 0.995, itersPerTemp = 100 } = opts;
    const n = adj.length;
    if (n === 0) return [];
    const rng = makeRng(seed);
    let best: Coloring = [...Array(n).keys()]; // trivial: unique color per node

    const attempt = (k: number): Coloring | null => {
        const color: Coloring = Array.from({ length: n }, () => Math.floor(rng() * k));
        let conflicts = totalConflicts(adj, color);
        let temp = initialTemperature;
        for (let step = 0; step < 200; step++) {
            if (conflicts === 0) return color.slice();
            for (let it = 0; it < itersPerTemp; it++) {
                const node = Math.floor(rng() * n);
                const oldC = color[node];
                const newC = Math.floor(rng() * k);
                if (newC === oldC) continue;
                const before = nodeConflicts(adj, color, node);
                color[node] = newC;
                const after = nodeConflicts(adj, color, node);
                const delta = after - before;
                if (delta <= 0 || rng() < Math.exp(-delta / Math.max(temp, 1e-9))) {
                    conflicts += delta;
                    if (conflicts === 0) return color.slice();
                } else {
                    color[node] = oldC;
                }
            }
            temp *= coolingRate;
        }

        return conflicts === 0 ? color.slice() : null;
    };

    let k = n - 1;
    while (k >= 1) {
        const candidate = attempt(k);
        if (candidate === null) break;
        best = candidate;
        k--;
    }

    return best;
}

// ---------------------------------------------------------------------------
// Exact methods
// ---------------------------------------------------------------------------

/** Brute-force DFS: smallest k with a valid k-coloring, via backtracking. */
export const bruteForceDfs = (adj: Graph): Coloring => {
    const n = adj.length;
    if (n === 0) return [];
    const color: Coloring = new Array(n).fill(UNCOLORED);
    const safe = (v: number, c: number) => !adj[v].some((u) => color[u] === c);
    const backtrack = (i: number, k: number): boolean => {
        if (i === n) return true;
        for (let c = 0; c < k; c++) {
            if (safe(i, c)) {
                color[i] = c;
                if (backtrack(i + 1, k)) return true;
                color[i] = UNCOLORED;
            }
        }
        return false;
    };

    for (let k = 1; k <= n; k++) {
        color.fill(UNCOLORED);
        if (backtrack(0, k)) return color.slice();
    }

    return color;
}

/** DSATUR-ordered branch and bound: exact chromatic number with pruning. */
export const dsaturBranchAndBound = (adj: Graph): Coloring => {
    const n = adj.length;
    if (n === 0) return [];
    let bestChi = n + 1;
    let bestColor: Coloring = [];
    const color: Coloring = new Array(n).fill(UNCOLORED);
    let coloredCount = 0;

    const nextNode = (): number => {
        let best = -1, bestSat = -1, bestDeg = -1;
        for (let v = 0; v < n; v++) {
            if (color[v] !== UNCOLORED) continue;
            const seen = new Set<number>();
            for (const u of adj[v]) if (color[u] !== UNCOLORED) seen.add(color[u]);
            const sat = seen.size, deg = adj[v].length;
            if (sat > bestSat || (sat === bestSat && deg > bestDeg)) {
                best = v; bestSat = sat; bestDeg = deg;
            }
        }
        return best;
    };

    const distinctUsed = (): number => {
        const s = new Set<number>();
        for (const c of color) if (c !== UNCOLORED) s.add(c);
        return s.size;
    };

    const backtrack = (): void => {
        if (coloredCount === n) {
            const used = distinctUsed();
            if (used < bestChi) { bestChi = used; bestColor = color.slice(); }
            return;
        }
        if (coloredCount > 0 && distinctUsed() >= bestChi) return; // bound
        const v = nextNode();
        if (v === -1) return;
        const disallowed = new Set<number>();
        for (const u of adj[v]) if (color[u] !== UNCOLORED) disallowed.add(color[u]);
        for (let c = 0; c < bestChi - 1; c++) {
            if (!disallowed.has(c)) {
                color[v] = c; coloredCount++;
                backtrack();
                color[v] = UNCOLORED; coloredCount--;
            }
        }
    };

    backtrack();

    return bestColor;
}

// ---------------------------------------------------------------------------
// DSATUR with recorded steps (for the UI animation)
// ---------------------------------------------------------------------------


export const dsaturSteps = (adj: Graph): { color: Coloring; steps: DsaturStep[] } => {
    const n = adj.length;
    const color: Coloring = new Array(n).fill(UNCOLORED);
    const steps: DsaturStep[] = [];
    let colored = 0;
    while (colored < n) {
        let best = -1, bestSat = -1, bestDeg = -1;
        for (let v = 0; v < n; v++) {
            if (color[v] !== UNCOLORED) continue;
            const seen = new Set<number>();
            for (const u of adj[v]) if (color[u] !== UNCOLORED) seen.add(color[u]);
            const sat = seen.size, deg = adj[v].length;
            if (sat > bestSat || (sat === bestSat && deg > bestDeg)) {
                best = v; bestSat = sat; bestDeg = deg;
            }
        }
        const used = new Set<number>();
        for (const u of adj[best]) if (color[u] !== UNCOLORED) used.add(color[u]);
        const c = smallestAvailableColor(used);
        color[best] = c;
        steps.push({
            node: best, color: c, saturation: bestSat,
            neighborColorsSeen: [...used].sort((a, b) => a - b),
        });
        colored++;
    }

    return { color, steps };
}

// ---------------------------------------------------------------------------
// Registry (ILP added later in ilp.ts)
// ---------------------------------------------------------------------------
import type { ColoringAlgorithm } from "./types.ts";

export const HEURISTICS: Record<string, ColoringAlgorithm> = {
    "Welsh-Powell": welshPowell,
    "DSATUR": dsatur,
    "Simulated Annealing": (adj: Graph) => simulatedAnnealing(adj, { seed: 0 }),
};

export const EXACT: Record<string, ColoringAlgorithm> = {
    "Brute-Force DFS": bruteForceDfs,
    "DSATUR Branch & Bound": dsaturBranchAndBound,
};

export { UNCOLORED };
