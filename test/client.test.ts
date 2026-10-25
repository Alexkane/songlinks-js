import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  PersonWithdrawnError,
  RateLimitedError,
  Songlinks,
  SonglinksError,
  VERSION,
  WRITERS_MAX,
  normalizeIpi,
} from "../src/index.js";

type Reply = { status: number; body?: unknown; headers?: { [k: string]: string } };

/** A fetch that answers from a script and records every request it was sent. */
function scripted(...replies: Reply[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift();
    if (!r) throw new Error("no scripted reply left");
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const fast = { maxRetries: 2, timeoutMs: 1000 };

describe("requests", () => {
  it("lookup sends the name and options as the API's query parameters", async () => {
    const f = scripted({ status: 200, body: { answer: "candidates", candidates: [] } });
    const sl = new Songlinks({ fetch: f.fetch });
    await sl.lookup("mark hoppus", { song: "all the small things", threshold: 0.9, routes: [] });
    const u = f.calls[0].url;
    expect(u.origin + u.pathname).toBe("https://songlinks.io/v1/lookup");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      name: "mark hoppus",
      song: "all the small things",
      threshold: "0.9",
      routes: "none",
    });
  });

  it("omits options that were not given, so the API's defaults apply", async () => {
    const f = scripted({ status: 200, body: {} });
    await new Songlinks({ fetch: f.fetch }).lookup("amy allen");
    expect([...f.calls[0].url.searchParams.keys()]).toEqual(["name"]);
  });

  it("person encodes the ID and maps the works paging options", async () => {
    const f = scripted({ status: 200, body: {} });
    await new Songlinks({ fetch: f.fetch }).person("SLP-ZYM7-GD3E-S", { worksOffset: 100, worksLimit: 50 });
    expect(f.calls[0].url.pathname).toBe("/v1/person/SLP-ZYM7-GD3E-S");
    expect(f.calls[0].url.searchParams.get("works_offset")).toBe("100");
    expect(f.calls[0].url.searchParams.get("works_limit")).toBe("50");
  });

  it("writers joins the numbers with commas and refuses more than the API takes", async () => {
    const f = scripted({ status: 200, body: { writers: [] } });
    const sl = new Songlinks({ fetch: f.fetch });
    await sl.writers(["00338980326", "00340247397"]);
    expect(f.calls[0].url.searchParams.get("ipi")).toBe("00338980326,00340247397");
    await expect(sl.writers(Array(WRITERS_MAX + 1).fill("1"))).rejects.toThrow(RangeError);
    await expect(sl.writers([])).rejects.toThrow(RangeError);
    for (const bad of ["338980326,00340247397", "338980326;1", "338980326\n1", "338980326%2C1"]) {
      await expect(sl.writers([bad])).rejects.toThrow(RangeError);
    }
  });

  it("identifies itself, with the caller's own tag appended", async () => {
    const f = scripted({ status: 200, body: {} });
    await new Songlinks({ fetch: f.fetch, userAgent: "my-app/1.2" }).version();
    const headers = f.calls[0].init.headers as { [k: string]: string };
    expect(headers["user-agent"]).toBe(`songlinks-js/${VERSION} my-app/1.2`);
    expect(headers.accept).toBe("application/json");
  });

  it("a custom base URL loses its trailing slash", async () => {
    const f = scripted({ status: 200, body: {} });
    await new Songlinks({ fetch: f.fetch, baseUrl: "http://localhost:8000/" }).version();
    expect(f.calls[0].url.href).toBe("http://localhost:8000/v1/version");
  });
});

describe("paging", () => {
  it("personWorks follows next_offset until the last page", async () => {
    const page = (items: string[], next: number | null) => ({
      status: 200,
      body: { works_list: { items: items.map((t) => ({ title: t })), next_offset: next } },
    });
    const f = scripted(page(["A", "B"], 2), page(["C"], null));
    const titles: string[] = [];
    for await (const w of new Songlinks({ fetch: f.fetch }).personWorks("SLP-ZYM7-GD3E-S", 2)) {
      titles.push((w as { title: string }).title);
    }
    expect(titles).toEqual(["A", "B", "C"]);
    expect(f.calls.map((c) => c.url.searchParams.get("works_offset"))).toEqual(["0", "2"]);
  });
});

describe("errors and retries", () => {
  it("an API error carries the status, the API's code and its message", async () => {
    const f = scripted({ status: 404, body: { error: "not_found", message: "No person has this ID" } });
    const err = await new Songlinks({ fetch: f.fetch, ...fast }).person("SLP-0000-0000-0").catch((e) => e);
    expect(err).toBeInstanceOf(SonglinksError);
    expect([err.status, err.code, err.message]).toEqual([404, "not_found", "No person has this ID"]);
  });

  it("a withdrawn person throws PersonWithdrawnError with the API's answer", async () => {
    const body = { person_id: "SLP-AAAA-BBBB-C", state: "withdrawn" };
    const f = scripted({ status: 410, body });
    const err = await new Songlinks({ fetch: f.fetch, ...fast }).person("SLP-AAAA-BBBB-C").catch((e) => e);
    expect(err).toBeInstanceOf(PersonWithdrawnError);
    expect(err.body).toEqual(body);
  });

  it("a 503 is retried, and the answer that follows is returned", async () => {
    vi.useFakeTimers();
    try {
      const f = scripted({ status: 503, body: { error: "busy", message: "busy" } }, { status: 200, body: { ok: 1 } });
      const pending = new Songlinks({ fetch: f.fetch, ...fast }).version();
      await vi.runAllTimersAsync();
      expect(await pending).toEqual({ ok: 1 });
      expect(f.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 429 waits Retry-After, and throws RateLimitedError when the retries run out", async () => {
    vi.useFakeTimers();
    try {
      const limited = { status: 429, body: { message: "That's 10 lookups" }, headers: { "retry-after": "7" } };
      const f = scripted(limited, limited, limited);
      const pending = new Songlinks({ fetch: f.fetch, ...fast }).lookup("x y").catch((e) => e);
      await vi.advanceTimersByTimeAsync(6_999);
      expect(f.calls).toHaveLength(1);
      await vi.runAllTimersAsync();
      const err = await pending;
      expect(err).toBeInstanceOf(RateLimitedError);
      expect(err.retryAfterSeconds).toBe(7);
      expect(f.calls).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 429 with the wait only in its body (the edge's limit) is thrown at once when the wait is long", async () => {
    const f = scripted({ status: 429, body: { error: "rate_limited", message: "Too many", retry_after_seconds: 300 } });
    const err = await new Songlinks({ fetch: f.fetch, ...fast }).lookup("x y").catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.retryAfterSeconds).toBe(300);
    expect(f.calls).toHaveLength(1);
  });

  it("a 429 with a short wait in its body is waited out and retried", async () => {
    vi.useFakeTimers();
    try {
      const f = scripted({ status: 429, body: { retry_after_seconds: 5 } }, { status: 200, body: { answer: "candidates" } });
      const pending = new Songlinks({ fetch: f.fetch, ...fast }).lookup("x y");
      await vi.advanceTimersByTimeAsync(4_999);
      expect(f.calls).toHaveLength(1);
      await vi.runAllTimersAsync();
      expect((await pending).answer).toBe("candidates");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 422 says which parameter was wrong and why", async () => {
    const detail = [{ loc: ["query", "threshold"], msg: "Input should be less than or equal to 0.99" }];
    const f = scripted({ status: 422, body: { detail } });
    const err = await new Songlinks({ fetch: f.fetch }).lookup("x y", { threshold: 2 }).catch((e) => e);
    expect([err.code, err.message]).toEqual(["invalid_request", "threshold: Input should be less than or equal to 0.99"]);
  });

  it("an empty name or person ID is refused before any request", async () => {
    const f = scripted();
    const sl = new Songlinks({ fetch: f.fetch });
    await expect(sl.lookup(" ")).rejects.toThrow(RangeError);
    await expect(sl.person("")).rejects.toThrow(RangeError);
    await expect(sl.writers([])).rejects.toThrow(RangeError);
    expect(f.calls).toHaveLength(0);
  });

  it("normalizeIpi writes a number the way the writers answer does", () => {
    expect(normalizeIpi("338980326")).toBe("00338980326");
    expect(normalizeIpi("003-389-803 26")).toBe("00338980326");
    expect(normalizeIpi("\t003\u2013389803 26")).toBe("00338980326"); // a tab and an en dash
    expect(normalizeIpi(" abc ")).toBe("abc"); // invalid: echoed trimmed, as the API does
    expect(normalizeIpi("003\u00a0389\u00a0803\u00a026")).toBe("00338980326"); // non-breaking spaces
    expect(normalizeIpi("338980326\u3000")).toBe("00338980326"); // an ideographic space
    expect(normalizeIpi("\ufeff338980326")).toBe("\ufeff338980326"); // a byte-order mark is not a space to the API
    expect(normalizeIpi("15036818.0")).toBe("15036818.0");
    expect(normalizeIpi("123456789012")).toBe("123456789012");
  });

  it("a Retry-After header wins over the body's wait", async () => {
    vi.useFakeTimers();
    try {
      const f = scripted({ status: 503, body: { retry_after_seconds: 300 }, headers: { "retry-after": "2" } }, { status: 200, body: {} });
      const pending = new Songlinks({ fetch: f.fetch, ...fast }).version();
      await vi.advanceTimersByTimeAsync(2_000);
      await pending;
      expect(f.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 503 asking for more than a minute is thrown at once", async () => {
    const f = scripted({ status: 503, body: { error: "busy", message: "Busy." }, headers: { "retry-after": "120" } });
    const err = await new Songlinks({ fetch: f.fetch, ...fast }).version().catch((e) => e);
    expect([err.status, err.code, f.calls.length]).toEqual([503, "busy", 1]);
  });

  it("writers accepts a line read from a Windows file", async () => {
    const f = scripted({ status: 200, body: { writers: [] } });
    await new Songlinks({ fetch: f.fetch }).writers(["338980326\r"]);
    expect(f.calls).toHaveLength(1);
  });

  it("a 4xx other than 429 is never retried", async () => {
    const f = scripted({ status: 400, body: { error: "too_many", message: "at most 50" } });
    await new Songlinks({ fetch: f.fetch, ...fast }).writers(["1"]).catch(() => null);
    expect(f.calls).toHaveLength(1);
  });

  it("maxRetries 0 turns retrying off", async () => {
    const f = scripted({ status: 503, body: { error: "busy", message: "busy" } });
    const err = await new Songlinks({ fetch: f.fetch, maxRetries: 0 }).version().catch((e) => e);
    expect(err.code).toBe("busy");
    expect(f.calls).toHaveLength(1);
  });
});

describe("package", () => {
  it("VERSION matches package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });
});
