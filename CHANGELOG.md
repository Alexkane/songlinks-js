# Changelog

## 0.1.1

- Runnable examples for the common jobs, linked from the README.
- Response types documented as named interfaces, fields in the API's order.
- The package description says what the SDK looks up: names and IPI name numbers.

## 0.1.0 (unreleased)

The first release, against Songlinks API 0.11.0.

- `lookup`, `person`, `personWorks`, `writers` and `version`, typed from the API's OpenAPI document.
- Typed errors: `SonglinksError`, `RateLimitedError` and `PersonWithdrawnError`.
- Retries on 429, 503 and network failures, honouring `Retry-After`.
- ESM and CommonJS builds, with no runtime dependencies.
