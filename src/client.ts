import type {
  LookupResponse,
  PersonResponse,
  PersonWork,
  PersonWithdrawnResponse,
  VersionResponse,
  WritersResponse,
} from "./schema.js";
import { VERSION } from "./version.js";

/** The most IPI name numbers `/v1/writers` accepts in one call. */
export const WRITERS_MAX = 50;
/** The most works one person read returns; {@link Songlinks.personWorks} pages through the rest. */
export const WORKS_PAGE_MAX = 200;

/** Options for a {@link Songlinks} client. Every option has a default. */
export interface SonglinksOptions {
  /** The API's address. The default is https://songlinks.io. */
  baseUrl?: string;
  /** A `fetch` implementation. The default is the global one, built into Node 18+, browsers, Deno and Bun. */
  fetch?: typeof fetch;
  /** How long one request may take before it is abandoned, in milliseconds. The default is 30,000. */
  timeoutMs?: number;
  /** How many times a request is retried after a 429, a 503 or a network failure. The default is 2; 0 turns retrying off. */
  maxRetries?: number;
  /** Your app's name and version, such as `my-app/1.2`, added to each request's User-Agent after the SDK's own. */
  userAgent?: string;
}

/** Options for {@link Songlinks.lookup}. Any option left out is decided by the API. */
export interface LookupOptions {
  /** The title of a song the writer wrote. When given, the answer says which candidates hold a work with that title. */
  song?: string;
  /**
   * How sure Songlinks must be before it joins two records into one person, from 0.5 to 0.99. Higher joins fewer
   * records and keeps more apart. The API's default is in {@link Songlinks.version}'s `threshold` (0.85 today).
   */
  threshold?: number;
  /**
   * Extra searches to run beside the name match. The one there is, `"catalogue"`, also finds records registered
   * under another name that share the writer's catalogue, such as a stage name, and returns them in `links`. It runs
   * by default; `[]` skips it, and the lookup is faster.
   */
  routes?: string[];
}

/** Options for {@link Songlinks.person}: which page of the person's works to return. */
export interface PersonOptions {
  /** The position of the first work to return, from 0. */
  worksOffset?: number;
  /** How many works to return, from 1 to 200. */
  worksLimit?: number;
}

/**
 * Thrown when the API answers with an error. Branch on {@link SonglinksError.code | code}, the API's own error code;
 * the message is a sentence meant for people, and its wording may change.
 */
export class SonglinksError extends Error {
  /** The HTTP status of the answer, such as 404 or 503. */
  readonly status: number;
  /** The API's error code, such as `not_found`, `busy` or `too_many`. */
  readonly code: string;
  /** The answer's body as parsed JSON, or `null` when it had none. */
  readonly body: unknown;

  /**
   * Creates the error for one error answer.
   *
   * @param status - The HTTP status.
   * @param code - The API's error code.
   * @param message - The API's message, or a description of the failure when it sent none.
   * @param body - The answer's body, or `null`.
   */
  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = "SonglinksError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * Thrown when the API refuses a request because the caller is over a limit (HTTP 429). The public API allows about 100
 * requests per 5 minutes from one address, across every endpoint. When the API asks for a wait of a minute or less,
 * the client waits and retries by itself and throws this only when its retries run out; a longer wait is thrown at
 * once, with {@link RateLimitedError.retryAfterSeconds | retryAfterSeconds} saying when to try again.
 */
export class RateLimitedError extends SonglinksError {
  /** How long the API asked the caller to wait, in seconds, or `null` when it did not say. */
  readonly retryAfterSeconds: number | null;

  /**
   * Creates the error for a 429 answer.
   *
   * @param status - The HTTP status, 429.
   * @param message - The API's message.
   * @param body - The answer's body, or `null`.
   * @param retryAfterSeconds - How long the API asked the caller to wait, or `null`.
   */
  constructor(status: number, message: string, body: unknown, retryAfterSeconds: number | null) {
    super(status, "rate_limited", message, body);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Thrown when a person ID has been withdrawn (HTTP 410). The API still answers in full: {@link PersonWithdrawnError.body | body}
 * says when the ID was issued and withdrawn, and gives its history. It is a valid answer to keep.
 */
export class PersonWithdrawnError extends SonglinksError {
  /** The API's answer about the withdrawn ID. */
  declare readonly body: PersonWithdrawnResponse;

  /**
   * Creates the error for a 410 answer.
   *
   * @param body - The API's answer about the withdrawn ID.
   */
  constructor(body: PersonWithdrawnResponse) {
    super(410, "withdrawn", `Person ${body.person_id} was withdrawn`, body);
    this.name = "PersonWithdrawnError";
  }
}

const RETRYABLE = new Set([429, 503]);
/** The longest wait the client sleeps through before retrying; a longer one is returned to the caller at once. */
const MAX_WAIT_SECONDS = 60;

/**
 * Writes an IPI name number the way the API's answers do: digits only, padded with leading zeros to 11. Use it to
 * match {@link Songlinks.writers}' answers to the numbers you sent.
 *
 * @param ipiNameNumber - An IPI name number as you have it, such as `338980326` or `003-389-803-26`.
 * @returns The number as 11 digits, such as `00338980326`.
 */
export function normalizeIpi(ipiNameNumber: string): string {
  return ipiNameNumber.replace(/[\s-]/g, "").padStart(11, "0");
}

/**
 * The Songlinks API client. Create one and reuse it.
 *
 * @example
 * ```ts
 * const songlinks = new Songlinks({ userAgent: "my-app/1.0" });
 * const answer = await songlinks.lookup("mark hoppus");
 * ```
 */
export class Songlinks {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  /**
   * Creates a client.
   *
   * @param options - The address, `fetch`, timeout, retries and User-Agent to use; each has a default.
   * @throws Error when no `fetch` is available and none was given.
   */
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

  /**
   * Looks up a songwriter by name.
   *
   * @param name - A songwriter's full name, such as `mark hoppus`. A single word, such as `madonna`, is answered
   *   with `answer: "rejected"` (code `single-token`), since one word matches too many people to group.
   * @param options - A song the writer wrote, a threshold or routes; any left out are decided by the API.
   * @returns The people the name could be, each with the registrations behind them.
   * @throws RangeError when the name is empty.
   * @throws {@link SonglinksError} when the API answers with an error, such as `invalid_request` for a threshold out
   *   of range.
   */
  lookup(name: string, options: LookupOptions = {}): Promise<LookupResponse> {
    if (!name.trim()) throw new RangeError("lookup() needs a name");
    const query: { [k: string]: string } = { name };
    if (options.song) query.song = options.song;
    if (options.threshold !== undefined) query.threshold = String(options.threshold);
    if (options.routes !== undefined) query.routes = options.routes.length ? options.routes.join(",") : "none";
    return this.get<LookupResponse>("/v1/lookup", query);
  }

  /**
   * Reads a person by ID, with one page of their works. A merged ID is followed to the person it now points at, and
   * the answer's `redirected_from` names the ID you asked for.
   *
   * @param personId - A person ID, such as `SLP-ZYM7-GD3E-S`.
   * @param options - Which page of works to return; the first page when left out.
   * @returns The stored person: their registrations, names, IPI name numbers and a page of works.
   * @throws {@link PersonWithdrawnError} when the ID has been withdrawn.
   * @throws {@link SonglinksError} when the API answers with any other error, such as `not_found`.
   */
  person(personId: string, options: PersonOptions = {}): Promise<PersonResponse> {
    // An empty ID would ask for /v1/person/, which is a different route and answers a bare 404.
    if (!personId.trim()) throw new RangeError("person() needs a person ID");
    const query: { [k: string]: string } = {};
    if (options.worksOffset !== undefined) query.works_offset = String(options.worksOffset);
    if (options.worksLimit !== undefined) query.works_limit = String(options.worksLimit);
    return this.get<PersonResponse>(`/v1/person/${encodeURIComponent(personId)}`, query);
  }

  /**
   * Reads every work of a person, in the API's order. Pages are requested only as the loop asks for more, so
   * stopping early stops the requests.
   *
   * @param personId - A person ID, such as `SLP-ZYM7-GD3E-S`.
   * @param pageSize - How many works to request at a time, from 1 to 200. The default is 200.
   * @returns An async iterator over the person's works.
   * @throws {@link SonglinksError} when the API answers with an error while the works are read.
   */
  async *personWorks(personId: string, pageSize: number = WORKS_PAGE_MAX): AsyncGenerator<PersonWork, void, undefined> {
    let offset: number | null | undefined = 0;
    while (offset !== null && offset !== undefined) {
      const page: PersonResponse = await this.person(personId, { worksOffset: offset, worksLimit: pageSize });
      for (const work of page.works_list.items) yield work;
      offset = page.works_list.next_offset;
    }
  }

  /**
   * Checks up to 50 IPI name numbers at once. The API refuses a longer list rather than shortening it, and so does
   * this method: for more, call it once for each batch of {@link WRITERS_MAX}.
   *
   * The answer has one entry per distinct number, in the order each was first sent, written as 11 digits. Two forms of
   * one number (`338980326` and `00338980326`) and repeats come back as one entry, so match answers to your list by
   * number, not by position: {@link normalizeIpi} turns your input into the form the answer uses.
   *
   * @param ipiNameNumbers - The numbers to check. Leading zeros may be left off, and spaces and dashes are ignored.
   * @returns For each distinct number, the person who holds it and a status, with totals in `summary`.
   * @throws RangeError when the list is empty or holds more than 50 numbers.
   * @throws {@link SonglinksError} when the API answers with an error.
   */
  writers(ipiNameNumbers: string[]): Promise<WritersResponse> {
    if (ipiNameNumbers.length === 0) throw new RangeError("writers() needs at least one IPI name number");
    if (ipiNameNumbers.length > WRITERS_MAX) {
      throw new RangeError(`writers() takes at most ${WRITERS_MAX} IPI name numbers per call`);
    }
    return this.get<WritersResponse>("/v1/writers", { ipi: ipiNameNumbers.join(",") });
  }

  /**
   * Asks what is serving.
   *
   * @returns The API's release, the model and code in use, and the date of the registration data.
   * @throws {@link SonglinksError} when the API answers with an error.
   */
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
      const retryAfter = retryAfterOf(response.headers.get("retry-after"), body);
      // A wait longer than a minute (the edge's rate limit asks for up to five) is the caller's to schedule, not
      // something to block on inside one call, so it is returned at once.
      const waitable = retryAfter === null || retryAfter <= MAX_WAIT_SECONDS;
      if (RETRYABLE.has(response.status) && attempt < this.maxRetries && waitable) {
        await sleep(backoff(attempt, retryAfter));
        continue;
      }
      throw toError(response.status, body, retryAfter);
    }
  }
}

function toError(status: number, body: unknown, retryAfter: number | null): SonglinksError {
  const b = (body ?? {}) as { error?: unknown; message?: unknown; detail?: unknown };
  let message = typeof b.message === "string" ? b.message : `HTTP ${status}`;
  // 422 is FastAPI's validation answer: no `error` or `message`, but a `detail` list saying which parameter was wrong
  // and why. Its first entry becomes the message, so `threshold: 2` reads "threshold: Input should be less than or
  // equal to 0.99" rather than "HTTP 422".
  if (status === 422 && Array.isArray(b.detail) && b.detail.length) {
    const d = b.detail[0] as { loc?: unknown; msg?: unknown };
    const where = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : undefined;
    if (typeof d.msg === "string") message = where ? `${where}: ${d.msg}` : d.msg;
  }
  if (status === 429) return new RateLimitedError(status, message, body, retryAfter);
  if (status === 410 && body && typeof body === "object" && "person_id" in body) {
    return new PersonWithdrawnError(body as PersonWithdrawnResponse);
  }
  const code = typeof b.error === "string" ? b.error : status === 422 ? "invalid_request" : `http_${status}`;
  return new SonglinksError(status, code, message, body);
}

/**
 * The wait the API asked for, in seconds: the Retry-After header, or else the body's `retry_after_seconds`. The edge's
 * rate limit answers with the body only (its 429 carries no header), so reading the header alone would retry a
 * five-minute limit after half a second.
 */
function retryAfterOf(header: string | null, body: unknown): number | null {
  const fromHeader = header ? Number(header) : NaN;
  if (Number.isFinite(fromHeader) && fromHeader >= 0) return fromHeader;
  const fromBody = (body as { retry_after_seconds?: unknown } | null)?.retry_after_seconds;
  return typeof fromBody === "number" && fromBody >= 0 ? fromBody : null;
}

/** The API's requested wait when it gives one, else 0.5 s, 1 s, 2 s ... with jitter. */
function backoff(attempt: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds !== null) return retryAfterSeconds * 1000;
  return 500 * 2 ** attempt * (0.75 + Math.random() * 0.5);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
