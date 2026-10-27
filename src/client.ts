import type {
  LookupResponse,
  PersonResponse,
  PersonWork,
  PersonWithdrawnResponse,
  SongwritersResponse,
  VersionResponse,
  WritersResponse,
} from "./schema.js";
import { VERSION } from "./version.js";

/** The most IPI name numbers `/v1/writers` accepts in one call. */
export const WRITERS_MAX = 50;
/** The most ISRCs `/v1/songwriters` accepts in one call, equal to {@link WRITERS_MAX}: one limit covers both lists. */
export const SONGWRITERS_MAX = 50;
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
  /**
   * How many times a request is retried after a 429, a 503 or a network failure. The default is 2; 0 turns retrying
   * off. An answer asking for a wait longer than a minute is not retried: it is thrown at once.
   */
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
 * requests per 5 minutes from one address, across every endpoint, and 20 from VPNs, proxies and hosting providers
 * (which includes most cloud servers). When the API asks for a wait of a minute or less, the client waits and retries
 * by itself and throws this only when its retries run out; a longer wait is thrown at once, with
 * {@link RateLimitedError.retryAfterSeconds | retryAfterSeconds} the most you need to wait.
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
 * The characters Python's `\s` matches, which the API uses to read an IPI name number. JavaScript's own `\s` differs
 * at the edges: it matches U+FEFF (which Python keeps) and misses U+0085 and 0x1c-0x1f (which Python strips).
 */
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

function trimPy(text: string): string {
  return text.replace(new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "g"), "");
}

/**
 * Writes an IPI name number the way {@link Songlinks.writers}' answers do, so the answers can be matched to the
 * numbers you sent. Spaces and dashes (including the typographic dashes a spreadsheet substitutes) are dropped, and a
 * run of 1 to 11 digits is padded with leading zeros to 11: `338980326` and `003-389-803 26` both become
 * `00338980326`. Anything else is not an IPI name number, and is returned trimmed (to 32 characters), as the API
 * echoes it with status `invalid`. A dot is not a separator: `15036818.0` is what a spreadsheet makes of a number read
 * as a float, and dropping the dot would turn it into somebody else's number.
 *
 * @param ipiNameNumber - An IPI name number as you have it, such as `338980326` or `003-389-803-26`.
 * @returns The number as 11 digits, such as `00338980326`, or the trimmed input when it is not one.
 */
export function normalizeIpi(ipiNameNumber: string): string {
  // The same reading as the API's own (writer/service.py ipi_key).
  const digits = ipiNameNumber.replace(new RegExp(`[${PY_SPACE}\\-\\u2010-\\u2015\\u2212]`, "g"), "");
  if (/^[0-9]{1,11}$/.test(digits)) return digits.padStart(11, "0");
  return Array.from(trimPy(ipiNameNumber)).slice(0, 32).join("");
}

/**
 * Writes an ISRC the way {@link Songlinks.songwriters}' answers do, so the answers can be matched to the codes you
 * sent. Spaces and hyphens are dropped and letters are upper-cased: `us-mc1-99-59123` and `USMC1 99 59123` both become
 * `USMC19959123`. An ISRC is then 12 characters: two letters, three letters or digits, and seven digits. Anything else
 * is not an ISRC, and is returned trimmed (to 32 characters), as the API echoes it with status `invalid`. Only the
 * plain hyphen is dropped: a code written with a typographic dash (`US–MC1–99–59123`, as some spreadsheets and word
 * processors substitute) is `invalid` to the API, so replace those dashes before you send it.
 *
 * @param isrc - An ISRC as you have it, such as `USMC19959123` or `US-MC1-99-59123`.
 * @returns The ISRC as 12 characters, such as `USMC19959123`, or the trimmed input when it is not one.
 */
export function normalizeIsrc(isrc: string): string {
  // The same reading as the API's own (writer/work_pages.py isrc_key). It differs from normalizeIpi's because the
  // API's does: only the ASCII hyphen is dropped, not the typographic dashes, so "US\u2013MC1..." (an en dash) is
  // `invalid` there, and so it must be here too or the echo would not match.
  // \p{Nd} because the API's pattern uses Python's \d, which matches any script's digits, not only 0-9; anything
  // narrower would answer `invalid` for a code the API reads as an ISRC, and the two would no longer match up.
  const code = isrc.replace(new RegExp(`[${PY_SPACE}\\-]`, "g"), "").toUpperCase();
  if (/^[A-Z]{2}[A-Z0-9]{3}\p{Nd}{7}$/u.test(code)) return code;
  return Array.from(trimPy(isrc)).slice(0, 32).join("");
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
   * @throws RangeError, as a rejected promise, when the name is empty.
   * @throws {@link SonglinksError} when the API answers with an error, such as `invalid_request` for a threshold out
   *   of range.
   */
  // async, so a refused argument is a rejected promise like any other failure: `Promise.allSettled(names.map(...))`
  // then records one rejection instead of the whole map throwing on the first blank name.
  async lookup(name: string, options: LookupOptions = {}): Promise<LookupResponse> {
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
  async person(personId: string, options: PersonOptions = {}): Promise<PersonResponse> {
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
   * @throws RangeError, as a rejected promise, when the list is empty, holds more than 50 numbers, or has an entry
   *   holding a comma, semicolon, line break or the text `%2C` (which the API would read as several numbers).
   * @throws {@link SonglinksError} when the API answers with an error.
   */
  async writers(ipiNameNumbers: string[]): Promise<WritersResponse> {
    if (ipiNameNumbers.length === 0) throw new RangeError("writers() needs at least one IPI name number");
    if (ipiNameNumbers.length > WRITERS_MAX) {
      throw new RangeError(`writers() takes at most ${WRITERS_MAX} IPI name numbers per call`);
    }
    for (const n of ipiNameNumbers) {
      // The API splits its list on these, and on the text %2C, so one entry holding one would be read as several. The
      // edges are trimmed first, as the API trims them, so a line read from a Windows file (ending "\r") passes.
      if (/%2c|[,;\r\n]/i.test(trimPy(n))) {
        throw new RangeError(`writers() takes one IPI name number per entry, got "${n}"`);
      }
    }
    return this.get<WritersResponse>("/v1/writers", { ipi: ipiNameNumbers.join(",") });
  }

  /**
   * Finds who wrote up to 50 recordings at once, by ISRC. For each recording, the answer gives the works (songs as
   * compositions) it is registered to, the writers registered on each work, and the Songlinks person behind each
   * writer where there is one. The API refuses a longer list rather than shortening it, and so does this method: for
   * more, call it once for each batch of {@link SONGWRITERS_MAX}.
   *
   * The answer has one entry per distinct ISRC, in the order each was first sent, written as 12 characters in upper
   * case. Two spellings of one code (`US-MC1-99-59123` and `usmc19959123`) and repeats come back as one entry, so
   * match answers to your list by ISRC, not by position: {@link normalizeIsrc} turns your input into the form the
   * answer uses.
   *
   * Each entry's `status` is `registered` (registered to at least one work, listed in `works`), `unregistered`
   * (registered to no work in this data; an ordinary answer, not an error) or `invalid` (not an ISRC; the entry is
   * echoed as sent, and the rest of the list is still answered). A writer's `persistent_id` is null when their record
   * is not part of a stored person, which is common for writers registered without an IPI name number.
   *
   * @param isrcs - The ISRCs to check, such as `["USMC19959123"]`. Spaces and hyphens inside a code are ignored, and
   *   case does not matter.
   * @returns For each distinct ISRC, a status and the works and writers it is registered to.
   * @throws RangeError, as a rejected promise, when the list is empty, holds more than 50 ISRCs, or has an entry
   *   holding a comma, semicolon, line break or the text `%2C` (which the API would read as several ISRCs).
   * @throws {@link SonglinksError} when the API answers with an error.
   *
   * @example
   * ```ts
   * const { recordings } = await songlinks.songwriters(["USMC19959123"]);
   * for (const work of recordings[0].works ?? []) {
   *   console.log(work.title, work.writers.map((w) => w.name));
   * }
   * // ALL THE SMALL THINGS [ 'MARK HOPPUS', 'TRAVIS L BARKER', 'THOMAS DELONGE' ]
   * ```
   */
  async songwriters(isrcs: string[]): Promise<SongwritersResponse> {
    if (isrcs.length === 0) throw new RangeError("songwriters() needs at least one ISRC");
    // The list's length, not its distinct codes: the API counts after folding repeats, so a list of 51 with a repeat
    // would pass there. Refusing it here keeps the rule one a caller can check without normalising first, as
    // writers() does.
    if (isrcs.length > SONGWRITERS_MAX) {
      throw new RangeError(`songwriters() takes at most ${SONGWRITERS_MAX} ISRCs per call`);
    }
    for (const code of isrcs) {
      // The API splits its list on the same characters as writers(), so the same check applies, edges trimmed first
      // so a line read from a Windows file (ending "\r") passes. A space or hyphen is not a separator for ISRCs
      // either: it is dropped inside the code.
      if (/%2c|[,;\r\n]/i.test(trimPy(code))) {
        throw new RangeError(`songwriters() takes one ISRC per entry, got "${code}"`);
      }
    }
    return this.get<SongwritersResponse>("/v1/songwriters", { isrc: isrcs.join(",") });
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
