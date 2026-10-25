# songlinks

The official TypeScript and JavaScript SDK for the [Songlinks API](https://songlinks.io/v1/docs).

Look up a songwriter by name and get back the people who write under it: registration records grouped into one
person each, the evidence for every grouping, and a person ID where one has been issued.

> **Beta.** Unverified machine output, from a dated snapshot of registration data (every answer's `mlc_snapshot`
> gives its date). Some answers are wrong and some are incomplete. Not for rights or royalty decisions.

```sh
npm install songlinks
```

No API key and no sign-up. It runs anywhere with a global `fetch`: Node 18+, browsers, Deno, Bun and edge runtimes.
It has no runtime dependencies.

## Quick start

```ts
import { Songlinks } from "songlinks";

const songlinks = new Songlinks();

// The people a name could be, each with the registrations behind them.
const answer = await songlinks.lookup("mark hoppus");
for (const person of answer.candidates ?? []) {
  console.log(person.persistent_id, person.names, person.works);
}

// A person by ID, with their works one page at a time.
const person = await songlinks.person("SLP-ZYM7-GD3E-S", { worksLimit: 50 });
console.log(person.name, person.works);

// Or every work, paged for you.
for await (const work of songlinks.personWorks("SLP-ZYM7-GD3E-S")) {
  console.log(work.title);
}
```

## What it covers

| Method | API | What it answers |
| --- | --- | --- |
| `lookup(name, { song?, threshold?, routes? })` | `GET /v1/lookup` | The people a songwriter's name could be. A `song` the writer wrote ranks the candidates by it. |
| `person(id, { worksOffset?, worksLimit? })` | `GET /v1/person/{id}` | One person: their registrations, names, IPI name numbers and a page of works. |
| `personWorks(id, pageSize?)` | `GET /v1/person/{id}` | Every work of a person, as an async iterator over the pages. |
| `writers(ipiNameNumbers)` | `GET /v1/writers` | Up to 50 IPI name numbers checked at once: the stored person behind each. |
| `version()` | `GET /v1/version` | What is serving: the release, the model and the date of the registration data. |

The types come from the API's own OpenAPI document, so a field the API documents is a field the SDK types. Every
response type is exported (`LookupResponse`, `PersonResponse`, `WritersResponse` and the rest), and so is the whole
generated schema as `components` and `paths`.

### Reading an answer

- **A lookup candidate is not a stored person.** It is the lookup's own grouping, made for the name you asked.
  `persistent_id` is the stored person when there is exactly one. A candidate whose records belong to more than one
  stored person has no `persistent_id` and lists them in `stored_persons`. Read each record's own `persistent_id`.
- **Null is ordinary.** Many records have no person ID yet.
- **Person IDs can be prerelease.** A prerelease ID may stop resolving, or point at a different person, without notice.
  Check `prerelease` before you store one.

## Errors and retries

Every non-success answer throws a `SonglinksError` with the HTTP `status`, the API's `code` (its `error` field, the
one to branch on), a `message` for people, and the response `body`.

```ts
import { PersonWithdrawnError, RateLimitedError, SonglinksError } from "songlinks";

try {
  await songlinks.person("SLP-0000-0000-0");
} catch (err) {
  if (err instanceof PersonWithdrawnError) {
    console.log("withdrawn", err.body); // a 410, and a valid answer to keep
  } else if (err instanceof RateLimitedError) {
    console.log("retry in", err.retryAfterSeconds, "s");
  } else if (err instanceof SonglinksError) {
    console.log(err.status, err.code, err.message);
  }
}
```

- **Retried automatically:** `429` and `503` answers and network failures, up to `maxRetries` times (default 2). A
  `Retry-After` header is honoured, up to a minute; otherwise it backs off from half a second.
- **Never retried:** any other error.
- **Merged person IDs** are followed to the person they now point at, and the answer's `redirected_from` names the
  ID you asked for.

## Options

```ts
new Songlinks({
  baseUrl: "https://songlinks.io", // the default
  fetch: customFetch, // defaults to the global fetch
  timeoutMs: 30_000, // per request
  maxRetries: 2, // 0 turns retrying off
  userAgent: "my-app/1.2", // appended to songlinks-js/<version>
});
```

## Fair use

The API is free and open. Please send a `userAgent` that names your app, keep to one request at a time per user
action, and cache answers you reuse. A burst of lookups may be rate-limited.

## Development

```sh
npm install
npm run typecheck && npm test && npm run build
SONGLINKS_LIVE=1 npm test     # three requests against the live API
npm run spec:pull && npm run generate   # refresh the types from the API's OpenAPI document
```

## Licence

MIT, © 2026 Kane Technology Group, LLC. The API's answers are subject to the
[Songlinks terms](https://songlinks.io/terms).
