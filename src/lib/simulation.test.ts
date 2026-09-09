import { expect, it } from "vite-plus/test";
import {
  createSimulation,
  DEFAULT_PARAMS,
  MAX_TICKS,
  simulate,
  stepSimulation,
} from "./simulation";

it("replays the same workload independently of rendering cadence", () => {
  let state = createSimulation(42, DEFAULT_PARAMS);
  const initial = structuredClone(state);
  for (let tick = 0; tick < 120; tick++) state = stepSimulation(state);
  expect(state).toEqual(simulate(42, DEFAULT_PARAMS, 120));
  expect(createSimulation(42, DEFAULT_PARAMS)).toEqual(initial);
  expect(simulate(43, DEFAULT_PARAMS, 120)).not.toEqual(state);
});

it("conserves requests and respects each server's capacity on every tick", () => {
  let state = createSimulation(7, DEFAULT_PARAMS);
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const previous = structuredClone(state);
    const next = stepSimulation(state);
    expect(state).toEqual(previous);
    state = next;
    for (const pool of [state.sticky, state.roundRobin]) {
      expect(pool.completed + pool.queues.reduce((a, b) => a + b, 0)).toBe(state.arrivals);
      expect(pool.served.every((count) => count >= 0 && count <= DEFAULT_PARAMS.capacity)).toBe(
        true,
      );
      expect(pool.queues.every((count) => count >= 0)).toBe(true);
    }
  }
  expect(stepSimulation(state)).toBe(state);
});

it("shows a hot client's sticky bottleneck despite spare total capacity", () => {
  const state = simulate(1, { ...DEFAULT_PARAMS, hotShare: 100 }, 10);
  expect(state.sticky.completed).toBe(40);
  expect(state.sticky.queues).toEqual([80, 0, 0, 0]);
  expect(state.roundRobin.completed).toBe(120);
  expect(state.roundRobin.queues).toEqual([0, 0, 0, 0]);
});

it("produces equal results with one server and no traffic with zero arrivals", () => {
  const one = simulate(1, { ...DEFAULT_PARAMS, servers: 1 }, 50);
  expect(one.sticky).toEqual(one.roundRobin);
  const idle = simulate(1, { ...DEFAULT_PARAMS, arrivals: 0 }, 50);
  expect(idle.sticky.completed).toBe(0);
  expect(idle.roundRobin.completed).toBe(0);
});

it("rejects invalid parameters and out-of-range replay ticks", () => {
  expect(() => simulate(1, { ...DEFAULT_PARAMS, servers: 0 }, 0)).toThrow(RangeError);
  expect(() => simulate(1, DEFAULT_PARAMS, MAX_TICKS + 1)).toThrow(RangeError);
  expect(() => createSimulation(NaN, DEFAULT_PARAMS)).toThrow(RangeError);
});
