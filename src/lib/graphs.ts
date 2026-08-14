/**
 * Graph construction — TypeScript port of dimacs_instances.py's known-graph
 * builders, the Erdős–Rényi generator (generate_random_graph), and the
 * Fruchterman–Reingold spring layout from export_demo_data.py.
 *
 * The demo_data.json gallery graphs already carry their structure, χ, and
 * layout, so these builders exist mainly for the LIVE path: generating a fresh
 * random graph (and laying it out) entirely client-side.
 */
import type { Graph } from "./types.ts";
import { makeRng } from "./coloring.ts";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const emptyGraph = (n: number): Graph => {
    return Array.from({ length: n }, () => []);
}

const addEdge = (adj: Graph, a: number, b: number): void => {
    adj[a].push(b);
    adj[b].push(a);
}

/** Canonical, de-duplicated edge list [min, max] for a graph. */
export const edgeList = (adj: Graph): [number, number][] => {
    const seen = new Set<string>();
    const edges: [number, number][] = [];
    for (let a = 0; a < adj.length; a++) {
        for (const b of adj[a]) {
            const lo = Math.min(a, b), hi = Math.max(a, b);
            const key = `${lo}-${hi}`;
            if (!seen.has(key)) { seen.add(key); edges.push([lo, hi]); }
        }
    }
    return edges;
}

// ---------------------------------------------------------------------------
// Known-graph families (with theoretical chromatic numbers)
// ---------------------------------------------------------------------------

/** K_n: every pair adjacent. χ = n. */
export const completeGraph = (n: number): Graph => {
    const adj = emptyGraph(n);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) addEdge(adj, a, b);
    return adj;
}

/** C_n: a single ring. χ = 2 if n even, 3 if n odd (n ≥ 3). */
export const cycleGraph = (n: number): Graph => {
    const adj = emptyGraph(n);
    for (let v = 0; v < n; v++) addEdge(adj, v, (v + 1) % n);
    return adj;
}

/** K_{a,b}: complete bipartite. χ = 2. */
export const completeBipartite = (sizeA: number, sizeB: number): Graph => {
    const adj = emptyGraph(sizeA + sizeB);
    for (let a = 0; a < sizeA; a++) for (let b = sizeA; b < sizeA + sizeB; b++) addEdge(adj, a, b);
    return adj;
}

/** W_n: an n-cycle plus a hub joined to all. χ = 4 if n odd, 3 if n even (n ≥ 3). */
export const wheelGraph = (numOuter: number): Graph => {
    const adj = cycleGraph(numOuter);
    const hub = numOuter;
    adj.push([]);
    for (let v = 0; v < numOuter; v++) addEdge(adj, hub, v);
    return adj;
}

/** Petersen graph: 10 nodes, 15 edges, χ = 3. */
export const petersenGraph = (): Graph => {
    const adj = emptyGraph(10);
    for (let i = 0; i < 5; i++) {
        addEdge(adj, i, (i + 1) % 5);            // outer 5-cycle
        addEdge(adj, 5 + i, 5 + ((i + 2) % 5));  // inner pentagram
        addEdge(adj, i, 5 + i);                  // spokes
    }
    return adj;
}

/**
 * One Mycielski step: G on n nodes → M(G) on 2n+1 nodes. Keeps G's edges; adds
 * a shadow n+i for each i joined to i's neighbors; adds an apex 2n joined to
 * every shadow. Triangle-free-preserving, raises χ by exactly 1.
 */
export const mycielskian = (graph: Graph): Graph => {
    const n = graph.length;
    const out: Graph = emptyGraph(2 * n + 1);
    // copy original edges
    for (let a = 0; a < n; a++) for (const b of graph[a]) if (a < b) addEdge(out, a, b);
    const apex = 2 * n;
    for (let i = 0; i < n; i++) {
        for (const nb of graph[i]) addEdge(out, n + i, nb); // shadow copies i's edges
        addEdge(out, apex, n + i);                          // apex joins every shadow
    }

    return out;
}

/** Apply Mycielski's step `steps` times from K_2 (χ = 2). χ = 2 + steps. */
export const mycielskianChain = (steps: number): Graph => {
    let g = completeGraph(2);
    for (let i = 0; i < steps; i++) g = mycielskian(g);
    return g;
}

// ---------------------------------------------------------------------------
// Erdős–Rényi random graph
// ---------------------------------------------------------------------------

/** G(n, p): each of the C(n,2) possible edges present independently w.p. p. Seeded. */
export const randomGraph = (n: number, p: number, seed: number): Graph => {
    const rng = makeRng(seed);
    const adj = emptyGraph(n);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (rng() < p) addEdge(adj, a, b);
    return adj;
}

// ---------------------------------------------------------------------------
// Spring layout (Fruchterman–Reingold), deterministic given seed
// ---------------------------------------------------------------------------

/** Return [x, y] per vertex, normalized to [0.05, 0.95]. Matches export_demo_data.py. */
export const springLayout = (adj: Graph, seed = 7, iterations = 250): [number, number][] => {
    const n = adj.length;
    if (n === 0) return [];
    if (n === 1) return [[0.5, 0.5]];
    const rng = makeRng(seed);
    const pos: [number, number][] = Array.from({ length: n }, () => [rng(), rng()]);
    const k = Math.sqrt(1 / n);
    let temp = 0.1;

    for (let iter = 0; iter < iterations; iter++) {
        const disp: [number, number][] = Array.from({ length: n }, () => [0, 0]);
        // repulsion between all pairs
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
                const dist = Math.hypot(dx, dy) || 1e-4;
                const force = (k * k) / dist;
                const ux = dx / dist, uy = dy / dist;
                disp[i][0] += ux * force; disp[i][1] += uy * force;
                disp[j][0] -= ux * force; disp[j][1] -= uy * force;
            }
        }
        // attraction along edges
        const seen = new Set<string>();
        for (let a = 0; a < n; a++) {
            for (const b of adj[a]) {
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                if (seen.has(key)) continue;
                seen.add(key);
                let dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
                const dist = Math.hypot(dx, dy) || 1e-4;
                const force = (dist * dist) / k;
                const ux = dx / dist, uy = dy / dist;
                disp[a][0] -= ux * force; disp[a][1] -= uy * force;
                disp[b][0] += ux * force; disp[b][1] += uy * force;
            }
        }
        // apply with cooling
        for (let v = 0; v < n; v++) {
            const d = Math.hypot(disp[v][0], disp[v][1]) || 1e-4;
            pos[v][0] += (disp[v][0] / d) * Math.min(d, temp);
            pos[v][1] += (disp[v][1] / d) * Math.min(d, temp);
        }
        temp *= 0.985;
    }

    // normalize to [0.05, 0.95]
    const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const sx = maxx - minx || 1, sy = maxy - miny || 1;
    return pos.map((p) => [
        +(0.05 + 0.9 * (p[0] - minx) / sx).toFixed(4),
        +(0.05 + 0.9 * (p[1] - miny) / sy).toFixed(4),
    ]);
}

// ---------------------------------------------------------------------------
// Known-instance registry (mirrors build_known_instances in Python)
// ---------------------------------------------------------------------------

export interface KnownInstance {
    id: string;
    name: string;
    build: () => Graph;
    chi: number;
}

export const KNOWN_INSTANCES: KnownInstance[] = [
    { id: "k4", name: "K4 (complete)", build: () => completeGraph(4), chi: 4 },
    { id: "k6", name: "K6 (complete)", build: () => completeGraph(6), chi: 6 },
    { id: "c5", name: "C5 (odd cycle)", build: () => cycleGraph(5), chi: 3 },
    { id: "c8", name: "C8 (even cycle)", build: () => cycleGraph(8), chi: 2 },
    { id: "c9", name: "C9 (odd cycle)", build: () => cycleGraph(9), chi: 3 },
    { id: "k34", name: "K_{3,4} (bipartite)", build: () => completeBipartite(3, 4), chi: 2 },
    { id: "w6", name: "W6 (even wheel)", build: () => wheelGraph(6), chi: 3 },
    { id: "w7", name: "W7 (odd wheel)", build: () => wheelGraph(7), chi: 4 },
    { id: "petersen", name: "Petersen", build: petersenGraph, chi: 3 },
    { id: "mycielski-3", name: "Mycielski-3 (triangle-free)", build: () => mycielskianChain(1), chi: 3 },
    { id: "grotzsch", name: "Grotzsch (Mycielski-4)", build: () => mycielskianChain(2), chi: 4 },
];
