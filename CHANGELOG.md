# Changelog

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
