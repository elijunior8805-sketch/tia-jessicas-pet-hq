import { vi } from "vitest";

/**
 * Minimal chainable Supabase client stub.
 *
 * Every builder method returns the chain itself so callers can freely
 * `.select().eq().order()`. Terminal awaits resolve to whatever the current
 * table stub is configured to return via `setTableResponse` / `setUpdateResponse`.
 */

type Response = { data: unknown; error: unknown };

type TableConfig = {
  select: Response;
  update: Response;
  insert: Response;
  delete: Response;
};

const defaultResponse: Response = { data: null, error: null };

const tables: Record<string, TableConfig> = {};

function ensure(table: string): TableConfig {
  if (!tables[table]) {
    tables[table] = {
      select: { ...defaultResponse },
      update: { ...defaultResponse },
      insert: { ...defaultResponse },
      delete: { ...defaultResponse },
    };
  }
  return tables[table];
}

export function setTableResponse(table: string, op: keyof TableConfig, response: Response) {
  ensure(table)[op] = response;
}

export function resetSupabaseMock() {
  for (const key of Object.keys(tables)) delete tables[key];
}

function makeChain(table: string, op: keyof TableConfig) {
  const chain: any = {};
  const passthrough = () => chain;
  for (const m of [
    "select", "eq", "neq", "in", "gt", "gte", "lt", "lte", "like", "ilike",
    "is", "not", "or", "filter", "match", "order", "limit", "range", "returns",
    "abortSignal", "csv", "explain", "throwOnError", "geojson", "single",
  ]) {
    chain[m] = vi.fn(passthrough);
  }
  // Terminal awaits
  const terminal = () => Promise.resolve(ensure(table)[op]);
  chain.maybeSingle = vi.fn(terminal);
  chain.then = (resolve: any, reject: any) => terminal().then(resolve, reject);
  return chain;
}

export const supabase = {
  from: vi.fn((table: string) => ({
    select: vi.fn(() => makeChain(table, "select")),
    update: vi.fn(() => makeChain(table, "update")),
    insert: vi.fn(() => makeChain(table, "insert")),
    delete: vi.fn(() => makeChain(table, "delete")),
    upsert: vi.fn(() => makeChain(table, "update")),
  })),
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "blob:mock" }, error: null })),
      upload: vi.fn(async () => ({ data: { path: "mock" }, error: null })),
      remove: vi.fn(async () => ({ data: null, error: null })),
    })),
  },
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
};
