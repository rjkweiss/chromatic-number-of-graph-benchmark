/**
 * Shred data contract for the graph coloring demo
 *
 * These types describe both the in-memory graph representation used by the
 * algorithms (Graph, Coloring) and the shape of public/demo_data.json
 *
 */


/** Adjacency as an array of arrays: adj[v] -> list of v's neighbors */
export type Graph = number[][];

/** A coloring: color[v] = the integer color assigned */
export type Coloring = number[];

/** One recorded DSATUR decision, used to animate the heuristic. */
export interface DsaturStep {
    /** vertex chosen this step */
    node: number;
    /** color assigned to it */
    color: number;
    /** its saturation degree at the moment of selection */
    saturation: number;
    /** distinct colors already present on its neighbors (sorted) */
    neighborColorsSeen: number[];
}

/** A single solver's result on one graph. */
export interface SolverResult {
    /** number of distinct colors used */
    colors: number;
    /** color[v] for every vertex */
    coloring: number[];
    /** whether the coloring is proper */
    valid: boolean;
    /** wall-clock seconds the solver took (from the Python export) */
    seconds: number;
    /** present instead of the above if a solver errored during export */
    error?: string;
}

/** Category of a gallery graph. */
export type GraphCategory = "known" | "random";

/** One graph in the gallery, as stored in demo_data.json. */
export interface GraphEntry {
    id: string;
    name: string;
    category: GraphCategory;
    n: number;
    m: number;
    /** known chromatic number (theory-backed or exact); null if unknown */
    knownChi: number | null;
    edges: [number, number][];
    /** normalized [x, y] in [0, 1] per vertex; may be empty for live graphs */
    layout: [number, number][];
    /** keyed by solver display name */
    results: Record<string, SolverResult>;
    dsaturSteps: DsaturStep[];
}

/** Top-level shape of demo_data.json. */
export interface DemoData {
    generatedBy: string;
    /** canonical display order of solver names */
    solverOrder: string[];
    graphs: GraphEntry[];
}

/** Signature every coloring algorithm satisfies. */
export type ColoringAlgorithm = (adj: Graph) => Coloring;
