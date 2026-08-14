/**
 * GeneratorControls — sliders for n and edge-probability p, plus a Generate
 * button that builds a fresh random graph (new seed each click). Exact solvers
 * are skipped above `exactCap`, so we warn when the sliders cross that line.
 */
interface Props {
  n: number;
  p: number;
  exactCap: number;
  onN: (n: number) => void;
  onP: (p: number) => void;
  onGenerate: () => void;
}

export default function GeneratorControls({ n, p, exactCap, onN, onP, onGenerate }: Props) {
  return (
    <div className="generator">
      <div className="gen-row">
        <label>vertices <b>{n}</b></label>
        <input type="range" min={4} max={24} step={1} value={n} onChange={(e) => onN(Number(e.target.value))} />
      </div>
      <div className="gen-row">
        <label>density p <b>{p.toFixed(2)}</b></label>
        <input type="range" min={0.05} max={0.9} step={0.05} value={p} onChange={(e) => onP(Number(e.target.value))} />
      </div>
      <button className="generate-btn" onClick={onGenerate}>✦ Generate random graph</button>
      {n > exactCap && (
        <p className="gen-warn">n &gt; {exactCap}: exact solvers (and χ) are skipped to stay responsive — heuristics only.</p>
      )}
    </div>
  );
}
