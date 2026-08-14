/**
 * App — sidebar (known/random dropdowns + live generator) and a stage that
 * Explores algorithms or Animates DSATUR. Live graphs are solved in a Web
 * Worker so heavy solvers never freeze the UI; results stream in and a timeout
 * kills anything that runs too long.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoData, GraphEntry } from "./lib/types.ts";
import DsaturPlayer from "./components/DsaturPlayer.tsx";
import ExploreView from "./components/ExploreView.tsx";
import GeneratorControls from "./components/GeneratorControls.tsx";

const EXACT_CAP = 18;
const SOLVE_TIMEOUT_MS = 8000;

export default function App() {
  const [data, setData] = useState<DemoData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveEntry, setLiveEntry] = useState<GraphEntry | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genN, setGenN] = useState(12);
  const [genP, setGenP] = useState(0.4);

  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);
  const buildingRef = useRef<GraphEntry | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}demo_data.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: DemoData) => { setData(d); setSelectedId(d.graphs[0]?.id ?? null); })
      .catch((e) => setError(String(e)));
  }, []);

  // cleanup any running worker on unmount
  useEffect(() => () => {
    if (workerRef.current) workerRef.current.terminate();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const known = useMemo(() => data?.graphs.filter((g) => g.category === "known") ?? [], [data]);
  const random = useMemo(() => data?.graphs.filter((g) => g.category === "random") ?? [], [data]);

  const cleanupWorker = () => {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const handleGenerate = () => {
    cleanupWorker();
    const seed = Math.floor(Math.random() * 1e9);
    buildingRef.current = null;
    setComputing(true);

    const worker = new Worker(new URL("./lib/solveWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === "ready") {
        buildingRef.current = msg.entry as GraphEntry;
        setLiveEntry({ ...msg.entry });
        setSelectedId(msg.entry.id);
      } else if (msg.type === "result") {
        const b = buildingRef.current;
        if (!b) return;
        b.results = { ...b.results, [msg.name]: msg.result };
        if (msg.name === "DSATUR Branch & Bound") b.knownChi = msg.result.colors;
        setLiveEntry({ ...b });
      } else if (msg.type === "done") {
        setComputing(false);
        cleanupWorker();
      }
    };
    worker.onerror = () => { setComputing(false); cleanupWorker(); };

    worker.postMessage({ n: genN, p: genP, seed, exactCap: EXACT_CAP });

    // hard stop: kill any solver still running after the budget, keep partials
    timerRef.current = window.setTimeout(() => {
      setComputing(false);
      cleanupWorker();
    }, SOLVE_TIMEOUT_MS);
  };

  if (error) return <div style={{ padding: 24 }}>Failed to load demo data: {error}</div>;
  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;

  const current: GraphEntry | undefined =
    liveEntry && selectedId === liveEntry.id
      ? liveEntry
      : data.graphs.find((g) => g.id === selectedId);

  const knownValue = current && current.category === "known" ? current.id : "";
  const randomValue = current && current.category === "random" && current.id.indexOf("live-") !== 0 ? current.id : "";

  const pickGallery = (id: string) => { cleanupWorker(); setComputing(false); setSelectedId(id); };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="brand">Graph Coloring</h1>
        <p className="tagline">heuristic vs. exact — an interactive study</p>

        <div className="field">
          <label htmlFor="known-select">Known instances</label>
          <select id="known-select" value={knownValue} onChange={(e) => pickGallery(e.target.value)}>
            <option value="" disabled>Choose a known-χ graph…</option>
            {known.map((g) => <option key={g.id} value={g.id}>{g.name} — n={g.n}, χ={g.knownChi}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="random-select">Random graphs (provided)</label>
          <select id="random-select" value={randomValue} onChange={(e) => pickGallery(e.target.value)}>
            <option value="" disabled>Choose a random graph…</option>
            {random.map((g) => <option key={g.id} value={g.id}>{g.name} — χ={g.knownChi}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Generate your own</label>
          <GeneratorControls n={genN} p={genP} exactCap={EXACT_CAP} onN={setGenN} onP={setGenP} onGenerate={handleGenerate} />
        </div>
        {computing && <p className="live-note">⏳ Solving in the background… results stream in.</p>}
      </aside>

      <main className="stage">
        {current ? <GraphView entry={current} computing={computing} /> : <p>Pick a graph.</p>}
      </main>
    </div>
  );
}

function GraphView({ entry, computing }: { entry: GraphEntry; computing: boolean }) {
  const [mode, setMode] = useState<"explore" | "animate">("explore");
  const dsaturResult = entry.results["DSATUR"];
  const isLive = entry.id.indexOf("live-") === 0;

  return (
    <div className="graph-view">
      <header className="info-card">
        <div>
          <h2>{entry.name}</h2>
          <p className="info-meta">
            {isLive ? "generated" : entry.category === "known" ? "known instance" : "random graph"} · {entry.n} vertices · {entry.m} edges
            {computing && isLive ? " · solving…" : ""}
          </p>
        </div>
        <div className="info-stats">
          <Stat label="χ (optimal)" value={entry.knownChi ?? "—"} />
          <Stat label="DSATUR colors" value={dsaturResult?.colors ?? "—"} />
        </div>
      </header>

      <div className="mode-toggle">
        <button className={mode === "explore" ? "mode active" : "mode"} onClick={() => setMode("explore")}>Explore algorithms</button>
        <button className={mode === "animate" ? "mode active" : "mode"} onClick={() => setMode("animate")}>Animate DSATUR</button>
      </div>

      {mode === "explore"
        ? <ExploreView entry={entry} />
        : <DsaturPlayer n={entry.n} edges={entry.edges} layout={entry.layout} steps={entry.dsaturSteps} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
