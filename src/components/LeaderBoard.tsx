/**
 * Leaderboard — every algorithm's colors, gap vs χ, and runtime for the current
 * graph, ranked by colors then time. Rows matching χ are highlighted.
 */
import type { GraphEntry } from "../lib/types.ts";

interface Props {
    entry: GraphEntry;
    order: string[];
    exactSet: Set<string>;
}

function fmtMs(seconds: number): string {
    const ms = seconds * 1000;
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 1000) return `${ms.toFixed(1)} ms`;
    return `${seconds.toFixed(2)} s`;
}

export default function Leaderboard({ entry, order, exactSet }: Props) {
    const chi = entry.knownChi;
    const rows = order
        .filter((name) => entry.results[name] && entry.results[name].colors !== undefined)
        .map((name) => {
            const r = entry.results[name];
            return { name, colors: r.colors, gap: chi === null ? null : r.colors - chi, seconds: r.seconds, exact: exactSet.has(name) };
        })
        .sort((a, b) => (a.colors - b.colors) || (a.seconds - b.seconds));

    return (
        <div className="leaderboard">
            <h3>Comparison for this graph</h3>
            <table>
                <thead>
                    <tr>
                        <th>Algorithm</th><th>Type</th><th>Colors</th><th>Gap vs χ</th><th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.name} className={r.gap === 0 ? "optimal-row" : ""}>
                            <td>{r.name}</td>
                            <td className="dim">{r.exact ? "exact" : "heuristic"}</td>
                            <td><b>{r.colors}</b></td>
                            <td>{r.gap === null ? "—" : r.gap === 0 ? "✓ optimal" : `+${r.gap}`}</td>
                            <td className="dim">{fmtMs(r.seconds)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {chi !== null && <p className="lb-note">χ (optimal) = {chi}. Rows at the optimal are highlighted.</p>}
        </div>
    );
}
