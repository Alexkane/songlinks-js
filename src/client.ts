import type { components } from "./schema.js";
import { VERSION } from "./version.js";

type Schemas = components["schemas"];
export type LookupResponse = Schemas["LookupResponse"];
export type PersonResponse = Schemas["PersonResponse"];
export type PersonWithdrawnResponse = Schemas["PersonWithdrawnResponse"];
export type PersonWork = Schemas["PersonWork"];
export type WritersResponse = Schemas["WritersResponse"];
export type VersionResponse = Schemas["VersionResponse"];
export type Cluster = Schemas["Cluster"];
export type Record = Schemas["Record"];
export type ApiError = Schemas["Error"];
export type RateLimited = Schemas["RateLimited"];

/** The most IPI name numbers `/v1/writers` accepts in one call. */
export const WRITERS_MAX = 50;
/** The most works one person read returns; `personWorks()` pages through the rest. */
export const WORKS_PAGE_MAX = 200;

export interface SonglinksOptions {
  /** Defaults to https://songlinks.io. */
  baseUrl?: string;
  /** A `fetch` implementation; defaults to the global one (Node 18+, browsers, Deno, Bun). */
  fetch?: typeof fetch;
  /** Abort a request after this long. Default 30 000 ms. */
  timeoutMs?: number;
  /** Retries for 429, 503 and network errors, honouring `Retry-After`. Default 2; 0 turns retrying off. */
  maxRetries?: number;
  /** Appended to the SDK's own User-Agent (where the runtime lets a request set one), e.g. "my-app/1.2". */
  userAgent?: string;
}

export interface LookupOptions {
  /** The title of a song this writer wrote: ranks the candidates by it. */
  song?: string;
  /** How sure the model must be to join two records, 0.5 to 0.99. The API's default when omitted. */
  threshold?: number;
  /** `["catalogue"]` (the API's default) fills `links`; `[]` skips it and the lookup is faster. */
  routes?: string[];
}

export interface PersonOptions {
  /** The position of the first work to return. */
  worksOffset?: number;
  /** How many works to return, 1 to 200. */
  worksLimit?: number;
}

/** Any answer the API gave that was not a success. `code` is the API's `error` field, the one to branch on. */
export class SonglinksError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;
  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = "SonglinksError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** 429: over a per-caller limit. Retried automatically up to `maxRetries`; thrown when retries run out. */
export class RateLimitedError extends SonglinksError {
  readonly retryAfterSeconds: number | null;
  constructor(status: number, message: string, body: unknown, retryAfterSeconds: number | null) {
    super(status, "rate_limited", message, body);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 410: the person ID was withdrawn. `body` says when and why, and is still a valid answer to keep. */
export class PersonWithdrawnError extends SonglinksError {
  declare readonly body: PersonWithdrawnResponse;
  constructor(body: PersonWithdrawnResponse) {
    super(410, "withdrawn", `Person ${body.person_id} was withdrawn`, body);
    this.name = "PersonWithdrawnError";
  }
}

const RETRYABLE = new Set([429, 503]);

export class Songlinks {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  constructor(options: SonglinksOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://songlinks.io").replace(/\/+$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error("No fetch available: pass `fetch` in the options (Node 18+ has one built in)");
    }
    // Bound, so a fetch that relies on `this` (a browser's window.fetch) still works when called as a property.
    this.fetchImpl = f.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.userAgent = `songlinks-js/${VERSION}` + (options.userAgent ? ` ${options.userAgent}` : "");
  }

  /** Look up a songwriter by name: the people the name could be, with the registrations behind each. */
  lookup(name: string, options: LookupOptions = {}): Promise<LookupResponse> {
    const query: { [k: string]: string } = { name };
    if (options.song) query.song = options.song;
    if (options.threshold !== undefined) query.threshold = String(options.threshold);
    if (options.routes !== undefined) query.routes = options.routes.length ? options.routes.join(",") : "none";
    return this.get<LookupResponse>("/v1/lookup", query);
  }

  /**
   * Read a person by ID (`SLP-XXXX-XXXX-C`). A merged ID is followed to the person it now points at, and the answer's
   * `redirected_from` says so. A withdrawn ID throws `PersonWithdrawnError`, whose `body` is the API's answer.
   */
  person(personId: string, options: PersonOptions = {}): Promise<PersonResponse> {
    const query: { [k: string]: string } = {};
    if (options.worksOffset !== undefined) query.works_offset = String(options.worksOffset);
    if (options.worksLimit !== undefined) query.works_limit = String(options.worksLimit);
    return this.get<PersonResponse>(`/v1/person/${encodeURIComponent(personId)}`, query);
  }

  /** Every work of a person, page by page, in the API's order. */
  async *personWorks(personId: string, pageSize: number = WORKS_PAGE_MAX): AsyncGenerator<PersonWork> {
    let offset: number | null | undefined = 0;
    while (offset !== null && offset !== undefined) {
      const page: PersonResponse = await this.person(personId, { worksOffset: offset, worksLimit: pageSize });
      for (const work of page.works_list.items) yield work;
      offset = page.works_list.next_offset;
    }
  }

  /**
   * Check up to 50 IPI name numbers: the stored person behind each, with a status. For more than 50, call it once per
   * batch of `WRITERS_MAX`: the API refuses a longer list rather than truncating it, and so does this method.
   */
  writers(ipiNameNumbers: string[]): Promise<WritersResponse> {
    if (ipiNameNumbers.length === 0) throw new RangeError("writers() needs at least one IPI name number");
    if (ipiNameNumbers.length > WRITERS_MAX) {
      throw new RangeError(`writers() takes at most ${WRITERS_MAX} IPI name numbers per call`);
    }
    return this.get<WritersResponse>("/v1/writers", { ipi: ipiNameNumbers.join(",") });
  }

  /** What is serving: the release, the model, the code, and the date of the registration data. */
  version(): Promise<VersionResponse> {
    return this.get<VersionResponse>("/v1/version", {});
  }

  private async get<T>(path: string, query: { [k: string]: string }): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { accept: "application/json", "user-agent": this.userAgent },
          redirect: "follow",
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // A network failure or timeout: retried like a 503, then rethrown as it was.
        if (attempt < this.maxRetries) {
          await sleep(backoff(attempt, null));
          continue;
        }
        throw err;
      }
      if (response.ok) return (await response.json()) as T;
      const body: unknown = await response.json().catch(() => null);
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      if (RETRYABLE.has(response.status) && attempt < this.maxRetries) {
        await sleep(backoff(attempt, retryAfter));
        continue;
      }
      throw toError(response.status, body, retryAfter);
    }
  }
}

function toError(status: number, body: unknown, retryAfter: number | null): SonglinksError {
  const b = (body ?? {}) as { error?: unknown; message?: unknown; detail?: unknown };
  const message = typeof b.message === "string" ? b.message : `HTTP ${status}`;
  if (status === 429) return new RateLimitedError(status, message, body, retryAfter);
  if (status === 410 && body && typeof body === "object" && "person_id" in body) {
    return new PersonWithdrawnError(body as PersonWithdrawnResponse);
  }
  // 422 is FastAPI's validation answer, with `detail` rather than `error`.
  const code = typeof b.error === "string" ? b.error : status === 422 ? "invalid_request" : `http_${status}`;
  return new SonglinksError(status, code, message, body);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Retry-After when the API gives one (capped at a minute), else 0.5 s, 1 s, 2 s ... with jitter. */
function backoff(attempt: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds !== null) return Math.min(retryAfterSeconds, 60) * 1000;
  return 500 * 2 ** attempt * (0.75 + Math.random() * 0.5);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
