import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createSimulation,
  DEFAULT_PARAMS,
  MAX_TICKS,
  simulate,
  stepSimulation,
  TICK_MS,
  type Pool,
  type SimParams,
  type SimState,
} from "../lib/simulation";
import "./sims.css";

export const Route = createFileRoute("/sims")({ component: Simulations });

const CONTROLS = [
  { key: "clients", label: "Clients", min: 2, max: 100 },
  { key: "servers", label: "Servers", min: 1, max: 8 },
  { key: "arrivals", label: "Requests per tick", min: 0, max: 40 },
  { key: "capacity", label: "Capacity per server / tick", min: 1, max: 10 },
  { key: "hotShare", label: "Traffic from client 1 (%)", min: 0, max: 100 },
] as const;

function Simulations() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [seed, setSeed] = useState(42);
  const [state, setState] = useState(() => createSimulation(42, DEFAULT_PARAMS));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    let frame: number;
    let previous: number | undefined;
    let remainder = 0;
    const resetClock = () => {
      previous = undefined;
      remainder = 0;
    };
    document.addEventListener("visibilitychange", resetClock);
    const animate = (now: number) => {
      if (previous !== undefined && !document.hidden) remainder += now - previous;
      previous = now;
      const ticks = Math.floor(remainder / TICK_MS);
      remainder -= ticks * TICK_MS;
      if (ticks > 0) {
        setState((current) => {
          let next = current;
          for (let i = 0; i < ticks && next.tick < MAX_TICKS; i++) next = stepSimulation(next);
          return next;
        });
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetClock);
    };
  }, [running]);

  useEffect(() => {
    if (state.tick === MAX_TICKS) setRunning(false);
  }, [state.tick]);

  function restart(nextParams = params, nextSeed = seed) {
    setRunning(false);
    setParams(nextParams);
    setSeed(nextSeed);
    setState(createSimulation(nextSeed, nextParams));
  }

  return (
    <main className="sims">
      <nav>
        <Link to="/">← mcpmap</Link>
        <Link to="/flows" search={{}}>
          Message flows →
        </Link>
      </nav>
      <header>
        <p className="sim-eyebrow">Concept lab · 01</p>
        <h1>Same traffic. Different queues.</h1>
        <p>
          Compare sticky sessions with stateless round-robin routing. Turn up one client’s traffic
          and watch where spare server capacity goes unused.
        </p>
      </header>

      <section className="sim-controls" aria-label="Simulation controls">
        {CONTROLS.map(({ key, label, min, max }) => (
          <label key={key} htmlFor={`sim-${key}`}>
            <span>
              {label}
              <output>{params[key]}</output>
            </span>
            <input
              id={`sim-${key}`}
              type="range"
              min={min}
              max={max}
              value={params[key]}
              onChange={(event) => restart({ ...params, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
        <label htmlFor="sim-seed">
          <span>Workload seed</span>
          <input
            id="sim-seed"
            type="number"
            min={0}
            max={4294967295}
            step={1}
            value={seed}
            onChange={(event) => {
              const next = event.target.valueAsNumber;
              if (Number.isInteger(next) && next >= 0 && next <= 4294967295) restart(params, next);
            }}
          />
        </label>
      </section>

      <div className="sim-transport">
        <button
          className="sim-primary"
          onClick={() => {
            if (state.tick === MAX_TICKS) setState(createSimulation(seed, params));
            setRunning(!running);
          }}
        >
          {running ? "Pause" : state.tick === MAX_TICKS ? "Replay" : "Play"}
        </button>
        <button
          disabled={running || state.tick === MAX_TICKS}
          onClick={() => setState(stepSimulation(state))}
        >
          Step 100 ms
        </button>
        <button onClick={() => restart()}>Reset</button>
        <span>
          {((state.tick * TICK_MS) / 1000).toFixed(1)} / 60.0 s · {state.arrivals.toLocaleString()}{" "}
          requests sent
        </span>
      </div>
      <label className="sim-seek" htmlFor="sim-timeline">
        Replay position
        <input
          id="sim-timeline"
          type="range"
          min={0}
          max={MAX_TICKS}
          value={state.tick}
          onChange={(event) => {
            setRunning(false);
            setState(simulate(seed, params, Number(event.target.value)));
          }}
        />
      </label>

      <div className="sim-pools">
        <ServerPool
          name="Sticky sessions"
          description="Each client stays on its assigned server."
          pool={state.sticky}
          params={params}
          color="#fbbf24"
        />
        <ServerPool
          name="Stateless round-robin"
          description="Each request goes to the next server in turn."
          pool={state.roundRobin}
          params={params}
          color="#38bdf8"
        />
      </div>
      <Throughput state={state} />

      <aside className="sim-notes">
        <h2>What this model assumes</h2>
        <p>
          Both pools receive the same requests, with identical processing costs and server capacity.
          A tick is 100 ms. Client 1 generates the selected share of traffic; the rest is
          distributed among other clients by the seed. Sticky assignments use client number modulo
          server count. Arrivals enter queues before servers process up to their capacity each tick.
        </p>
        <p>
          This illustrates load distribution, not measured MCP performance. Network latency,
          connection costs, shared storage, caching, failures, and session migration are omitted.
          Stateless routing assumes any server can handle any request. Queues are unbounded for this
          60-second run; neither strategy drops requests.
        </p>
        <p>
          Changing a parameter resets the run. The seed and parameters reproduce the same result at
          any replay position. Playback starts paused and pauses its clock in background tabs.
        </p>
      </aside>
    </main>
  );
}

function ServerPool({
  name,
  description,
  pool,
  params,
  color,
}: {
  name: string;
  description: string;
  pool: Pool;
  params: SimParams;
  color: string;
}) {
  const waiting = pool.queues.reduce((sum, count) => sum + count, 0);
  return (
    <section className="sim-pool" style={{ borderTopColor: color }}>
      <h2>{name}</h2>
      <p>{description}</p>
      <div className="sim-metrics">
        <span>
          <strong>{pool.completed.toLocaleString()}</strong> completed
        </span>
        <span>
          <strong>{waiting.toLocaleString()}</strong> queued
        </span>
      </div>
      {pool.queues.map((queued, server) => (
        <div className="sim-server" key={server}>
          <div>
            <span>Server {server + 1}</span>
            <span>
              {pool.served[server]} / {params.capacity} served · {queued} queued
            </span>
          </div>
          <div className="sim-meter" aria-hidden="true">
            <div
              style={{
                width: `${(pool.served[server]! / params.capacity) * 100}%`,
                background: color,
              }}
            />
          </div>
        </div>
      ))}
      <small>Bars show capacity used in the latest tick.</small>
    </section>
  );
}

function Throughput({ state }: { state: SimState }) {
  const maxRate = Math.max(1, (state.params.servers * state.params.capacity * 1000) / TICK_MS);
  const points = (kind: "sticky" | "roundRobin") =>
    state.history
      .map(
        (sample) =>
          `${48 + (sample.tick / MAX_TICKS) * 700},${180 - (sample[kind] / maxRate) * 150}`,
      )
      .join(" ");
  const latest = state.history.at(-1);
  return (
    <section className="sim-chart">
      <h2>
        Throughput <span>requests / second · sampled every 100 ms</span>
      </h2>
      <p>
        <span style={{ color: "#fbbf24" }}>Sticky: {latest?.sticky ?? 0} req/s</span>
        {" · "}
        <span style={{ color: "#38bdf8" }}>Round-robin: {latest?.roundRobin ?? 0} req/s</span>
      </p>
      <svg
        viewBox="0 0 780 215"
        role="img"
        aria-label="Throughput over the 60-second simulation. Current rates are listed above."
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={48}
              x2={748}
              y1={180 - fraction * 150}
              y2={180 - fraction * 150}
              stroke="#334155"
            />
            <text x={40} y={184 - fraction * 150} textAnchor="end">
              {Math.round(maxRate * fraction)}
            </text>
          </g>
        ))}
        {[0, 15, 30, 45, 60].map((seconds) => (
          <text key={seconds} x={48 + (seconds / 60) * 700} y={205} textAnchor="middle">
            {seconds}s
          </text>
        ))}
        <polyline points={points("roundRobin")} fill="none" stroke="#38bdf8" strokeWidth={2.5} />
        <polyline
          points={points("sticky")}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      </svg>
    </section>
  );
}
