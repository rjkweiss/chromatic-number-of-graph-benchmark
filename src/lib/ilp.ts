/**
 * Integer Linear Program for graph coloring — the 6th solver for LIVE graphs.
 * Uses the assignment formulation from the report, solved by the pure-JS MILP
 * library `javascript-lp-solver`.
 *
 *   minimize   Σ_c y_c
 *   s.t.       Σ_c x_{v,c} = 1                for every vertex v
 *              x_{u,c} + x_{w,c} ≤ 1          for every edge {u,w}, every color c
 *              x_{v,c} ≤ y_c                  for every v, c
 *              x, y ∈ {0,1}
 *
 * The color pool size K is a valid upper bound (DSATUR's color count), which
 * keeps the model small while guaranteeing the optimum is reachable.
 *
 * NOTE: requires `npm install javascript-lp-solver`. Only used for small live
 * graphs; gallery graphs get their ILP result from the Python export.
 */
import solver from "javascript-lp-solver";
import type { Graph, Coloring } from "./types.ts";
import { dsatur, colorsUsed } from "./coloring.ts";

export function integerLinearProgram(adj: Graph): Coloring {
  const n = adj.length;
  if (n === 0) return [];
  const K = Math.max(1, colorsUsed(dsatur(adj))); // valid upper bound on χ

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model: any = { optimize: "numColors", opType: "min", constraints: {}, variables: {}, binaries: {} };

  for (let v = 0; v < n; v++) model.constraints[`assign_${v}`] = { equal: 1 };
  for (let v = 0; v < n; v++) for (let c = 0; c < K; c++) model.constraints[`link_${v}_${c}`] = { max: 0 };

  const seen = new Set<string>();
  for (let u = 0; u < n; u++) {
    for (const w of adj[u]) {
      const a = Math.min(u, w), b = Math.max(u, w);
      const key = `${a}_${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (let c = 0; c < K; c++) model.constraints[`edge_${a}_${b}_${c}`] = { max: 1 };
    }
  }

  for (let v = 0; v < n; v++) {
    for (let c = 0; c < K; c++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const varObj: any = { [`assign_${v}`]: 1, [`link_${v}_${c}`]: 1 };
      for (const w of adj[v]) {
        const a = Math.min(v, w), b = Math.max(v, w);
        varObj[`edge_${a}_${b}_${c}`] = 1;
      }
      model.variables[`x_${v}_${c}`] = varObj;
      model.binaries[`x_${v}_${c}`] = 1;
    }
  }
  for (let c = 0; c < K; c++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const varObj: any = { numColors: 1 };
    for (let v = 0; v < n; v++) varObj[`link_${v}_${c}`] = -1;
    model.variables[`y_${c}`] = varObj;
    model.binaries[`y_${c}`] = 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = solver.Solve(model);
  if (!res || !res.feasible) throw new Error("ILP: no feasible solution");

  const coloring: Coloring = new Array(n).fill(-1);
  for (let v = 0; v < n; v++) {
    for (let c = 0; c < K; c++) {
      if (Math.round(res[`x_${v}_${c}`] || 0) === 1) { coloring[v] = c; break; }
    }
  }
  // safety: if the solver left any vertex unassigned, fall back is caught by caller
  if (coloring.some((c) => c < 0)) throw new Error("ILP: incomplete assignment");
  return coloring;
}
