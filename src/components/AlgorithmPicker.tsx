/**
 * AlgorithmPicker — pills to choose which algorithm colors the graph.
 * Exact methods are marked so the user can tell them from heuristics.
 */
interface Props {
    names: string[];
    exactSet: Set<string>;
    selected: string;
    onSelect: (name: string) => void;
}

export default function AlgorithmPicker({ names, exactSet, selected, onSelect }: Props) {
    return (
        <div className="algo-picker">
            {names.map((name) => (
                <button
                    key={name}
                    className={name === selected ? "algo-pill active" : "algo-pill"}
                    onClick={() => onSelect(name)}
                >
                    {name}
                    <span className="algo-tag">{exactSet.has(name) ? "exact" : "heuristic"}</span>
                </button>
            ))}
        </div>
    );
}
