export const TICK_MS = 100;
export const MAX_TICKS = 600;

export interface SimParams {
  clients: number;
  servers: number;
  arrivals: number;
  capacity: number;
  hotShare: number;
}

export const DEFAULT_PARAMS: SimParams = {
  clients: 12,
  servers: 4,
  arrivals: 12,
  capacity: 4,
  hotShare: 60,
};

export interface Pool {
  queues: number[];
  completed: number;
  served: number[];
}

export interface Sample {
  tick: number;
  sticky: number;
  roundRobin: number;
}

export interface SimState {
  seed: number;
  params: SimParams;
  tick: number;
  arrivals: number;
  sticky: Pool;
  roundRobin: Pool;
  history: Sample[];
}

function validate(params: SimParams) {
  for (const [key, min, max] of [
    ["clients", 2, 100],
    ["servers", 1, 8],
    ["arrivals", 0, 40],
    ["capacity", 1, 10],
    ["hotShare", 0, 100],
  ] as const) {
    const value = params[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${key} must be an integer from ${min} to ${max}`);
    }
  }
}

export function createSimulation(seed: number, params: SimParams): SimState {
  validate(params);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("seed must be an unsigned 32-bit integer");
  }
  const pool = (): Pool => ({
    queues: Array<number>(params.servers).fill(0),
    completed: 0,
    served: Array<number>(params.servers).fill(0),
  });
  return {
    seed,
    params: { ...params },
    tick: 0,
    arrivals: 0,
    sticky: pool(),
    roundRobin: pool(),
    history: [],
  };
}

function random(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}

function serve(pool: Pool, incoming: number[], capacity: number): Pool {
  const available = pool.queues.map((queued, server) => queued + incoming[server]!);
  const served = available.map((queued) => Math.min(queued, capacity));
  return {
    queues: available.map((queued, server) => queued - served[server]!),
    served,
    completed: pool.completed + served.reduce((sum, count) => sum + count, 0),
  };
}

/** One immutable 100 ms step, with identical arrivals and service costs for both pools. */
export function stepSimulation(state: SimState): SimState {
  if (state.tick >= MAX_TICKS) return state;
  const { params, seed } = state;
  const stickyIncoming = Array<number>(params.servers).fill(0);
  const roundRobinIncoming = Array<number>(params.servers).fill(0);
  for (let request = 0; request < params.arrivals; request++) {
    const id = state.arrivals + request;
    const client =
      random(seed, id * 2) < params.hotShare / 100
        ? 0
        : 1 + Math.floor(random(seed, id * 2 + 1) * (params.clients - 1));
    const stickyServer = client % params.servers;
    const roundRobinServer = id % params.servers;
    stickyIncoming[stickyServer] = stickyIncoming[stickyServer]! + 1;
    roundRobinIncoming[roundRobinServer] = roundRobinIncoming[roundRobinServer]! + 1;
  }
  const sticky = serve(state.sticky, stickyIncoming, params.capacity);
  const roundRobin = serve(state.roundRobin, roundRobinIncoming, params.capacity);
  const tick = state.tick + 1;
  return {
    ...state,
    tick,
    arrivals: state.arrivals + params.arrivals,
    sticky,
    roundRobin,
    history: [
      ...state.history,
      {
        tick,
        sticky: ((sticky.completed - state.sticky.completed) * 1000) / TICK_MS,
        roundRobin: ((roundRobin.completed - state.roundRobin.completed) * 1000) / TICK_MS,
      },
    ],
  };
}

/** Random-access replay for renderers that supply a frame/tick instead of a clock. */
export function simulate(seed: number, params: SimParams, tick: number): SimState {
  if (!Number.isInteger(tick) || tick < 0 || tick > MAX_TICKS) {
    throw new RangeError(`tick must be an integer from 0 to ${MAX_TICKS}`);
  }
  let state = createSimulation(seed, params);
  while (state.tick < tick) state = stepSimulation(state);
  return state;
}
