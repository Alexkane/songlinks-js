# Changelog

## 0.2.0

- `songwriters(isrcs)`: who wrote up to 50 recordings at once, by ISRC (`GET /v1/songwriters`). For each recording,
  the works it is registered to, the writers on each work with their role and IPI name number, and the Songlinks
  person behind each writer where there is one. Each entry is `registered`, `unregistered` or `invalid`; an
  unregistered or invalid entry is an answer, not an error.
- `normalizeIsrc()` writes an ISRC the way a songwriters answer does (12 characters, upper case, no spaces or
  hyphens), to match answers to your list.
- `SONGWRITERS_MAX` (50), and the new response types `SongwritersResponse`, `RecordingAnswer`, `RecordingWork` and
  `RecordingWriter`.
- `songwriters()` refuses an empty list, more than 50 entries, or an entry the API would read as several codes, before
  calling the API, as `writers()` does.
- A `who-wrote-these.ts` example: a list of ISRCs in, CSV out.
- The README explains what an ISRC is, what each status means, and why a writer's person ID can be null.

## 0.1.2

- Field documentation regenerated from the API's current description of itself: "IPI name number" throughout, what
  a person's member records are, why a lookup candidate can count more works than its person, and the edge's rate
  limit.

## 0.1.1

- Runnable examples for the common jobs, linked from the README.
- Response types documented as named interfaces, fields in the API's order.
- The package description says what the SDK looks up: names and IPI name numbers.
- A 429's wait is read from its body when it has no Retry-After header (the edge's rate limit sends none), and a
  wait longer than a minute is thrown at once instead of being retried early.
- A 422 says which parameter was wrong and why, instead of "HTTP 422".
- `lookup()`, `person()` and `writers()` reject an empty argument before calling the API, as a rejected promise.
- `normalizeIpi()` writes a number the way a writers answer does, to match answers to your list.
- `writers()` refuses an entry holding a comma, semicolon, line break or the text `%2C`, which the API would read as
  several numbers.
- The README walks a beginner through a first program, with what to expect, and explains the programming and
  music-publishing words it uses.

## 0.1.0

The first release, against Songlinks API 0.11.0.

- `lookup`, `person`, `personWorks`, `writers` and `version`, typed from the API's OpenAPI document.
- Typed errors: `SonglinksError`, `RateLimitedError` and `PersonWithdrawnError`.
- Retries on 429, 503 and network failures, honouring `Retry-After`.
- ESM and CommonJS builds, with no runtime dependencies.
