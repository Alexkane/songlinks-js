# songlinks

[![npm](https://img.shields.io/npm/v/songlinks.svg)](https://www.npmjs.com/package/songlinks)
[![ci](https://github.com/Alexkane/songlinks-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexkane/songlinks-js/actions/workflows/ci.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**Find the songwriter behind a name.** The official TypeScript and JavaScript SDK for
[Songlinks](https://songlinks.io).

One songwriter is rarely one record. They're registered under different spellings, under several IPI name numbers, or
with no number at all. Songlinks groups those registrations into one person, shows the evidence for every join, and
keeps apart the ones it isn't sure of.

- **Free, with no key and no sign-up.**
- **Typed end to end.** Generated from the API's own OpenAPI document.
- **Runs anywhere `fetch` does.** Node 18+, browsers, Deno, Bun and edge runtimes, with no dependencies.
- **Built to be called from real apps.** Typed errors, retries that honour `Retry-After`, and paging done for you.

```sh
npm install songlinks
```

## Thirty seconds

```ts
import { Songlinks } from "songlinks";

const songlinks = new Songlinks({ userAgent: "my-app/1.0" });

const { candidates } = await songlinks.lookup("mark hoppus");
console.log(candidates?.[0]);
// { persistent_id: "SLP-ZYM7-GD3E-S", names: ["MARK HOPPUS"], ipi_name_numbers: ["00338980326"],
//   works: 302, records: [ ...2 registrations ], evidence: [ ... ] }

const person = await songlinks.person("SLP-ZYM7-GD3E-S", { worksLimit: 3 });
console.log(person.works_list.items.map((w) => w.title));
// [ "I MISS YOU", "ALL THE SMALL THINGS", "DOWN" ]

const { writers } = await songlinks.writers(["00338980326", "00340247397"]);
// one entry per IPI name number: MARK HOPPUS (SLP-ZYM7-GD3E-S), TRAVIS L BARKER (SLP-MG23-XM9B-Y)
```

Every person has a page you can link to, such as [songlinks.io/person/SLP-ZYM7-GD3E-S](https://songlinks.io/person/SLP-ZYM7-GD3E-S).
It shows the registrations behind the person and what each join rests on.

> **Beta.** Unverified machine output, from a dated snapshot of registration data (a lookup's or a person's
> `provenance.mlc_snapshot` gives its date, and `version()` gives the current one). Some answers are wrong and some are incomplete. Not for rights or royalty decisions.

### More

```ts
// Which of several writers with the same name wrote a song? Pass one of their songs.
const { song_match } = await songlinks.lookup("amy allen", { song: "espresso" });
// song_match: { match: "exact", candidates: ["c1"] }: the Amy Allen credited on that song

// Every work of a person, paged for you.
for await (const work of songlinks.personWorks("SLP-ZYM7-GD3E-S")) {
  console.log(work.title);
}
```

## Checking a whole roster?

The API answers one name at a time, which suits an app. If you administer a catalogue, send us the writers instead.
For each one we send back every registration we can group to them, across spellings, stage names and more than one IPI
name number, with the evidence behind each join and the records we deliberately left out. See
[bulk songwriter lookup](https://songlinks.io/bulk-songwriter-lookup), or write to alex@songlinks.to.

## Examples

Runnable scripts for the jobs people use Songlinks for, each under 40 lines. Copy one and change it:

| Script | What it does |
| --- | --- |
| [`resolve-name.ts`](examples/resolve-name.ts) | Every person a name could be, with their registrations and what joined them. |
| [`which-namesake.ts`](examples/which-namesake.ts) | Two writers share a name: which one wrote this song? |
| [`check-roster.ts`](examples/check-roster.ts) | A list of IPI name numbers in, CSV out: who holds each and their works. |
| [`export-catalogue.ts`](examples/export-catalogue.ts) | Every work of a person, as CSV. |

```sh
node examples/check-roster.ts roster.txt > checked.csv
```

Node 23.6 and later run TypeScript directly; on older versions use `npx tsx`. The examples are type-checked with the
package, so one that misreads a field fails the build.

## What it covers

| Method | API | What it answers |
| --- | --- | --- |
| `lookup(name, { song?, threshold?, routes? })` | `GET /v1/lookup` | The people a songwriter's name could be. A `song` the writer wrote ranks the candidates by it. |
| `person(id, { worksOffset?, worksLimit? })` | `GET /v1/person/{id}` | One person: their registrations, names, IPI name numbers and a page of works. |
| `personWorks(id, pageSize?)` | `GET /v1/person/{id}` | Every work of a person, as an async iterator over the pages. |
| `writers(ipiNameNumbers)` | `GET /v1/writers` | Up to 50 IPI name numbers checked at once: the stored person behind each. |
| `version()` | `GET /v1/version` | What is serving: the release, the model and the date of the registration data. |

The types come from the API's own OpenAPI document, so a field the API documents is a field the SDK types, with the
API's description of it in your editor's tooltip. Every response type is exported by name (`LookupResponse`,
`PersonResponse`, `Cluster`, `WritersResponse` and the rest), and all of them together as `components`. Two are
renamed so they don't shadow JavaScript's built-ins: the API's `Record` is `LookupRecord` and its `Error` is `ApiError`.

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
  await songlinks.person(personId);
} catch (err) {
  if (err instanceof PersonWithdrawnError) {
    console.log("withdrawn", err.body); // a 410, and a valid answer to keep
  } else if (err instanceof RateLimitedError) {
    console.log("retry in", err.retryAfterSeconds, "s");
  } else if (err instanceof SonglinksError && err.code === "not_found") {
    console.log("no person with that ID"); // a 404, such as for SLP-0000-0000-0
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
action, and cache answers you reuse. A burst of lookups may be rate-limited; for a whole roster, see
[bulk songwriter lookup](https://songlinks.io/bulk-songwriter-lookup).

## Links

- [API reference](https://songlinks.io/v1/docs), with every endpoint runnable from the page.
- [How Songlinks decides](https://songlinks.io/about): what a person ID is, and how registrations are grouped.
- [MCP server](https://songlinks.io/mcp-server): the same answers inside Claude or any MCP client.
- Something wrong in an answer? [Open an issue](https://github.com/Alexkane/songlinks-js/issues), or write to
  alex@songlinks.to.

## Development

```sh
npm install
npm run typecheck && npm run docs:check && npm test && npm run build
SONGLINKS_LIVE=1 npm test     # three requests against the live API
npm run spec:pull && npm run generate   # refresh the types from the API's OpenAPI document
npm run docs                            # the API reference as HTML, in docs/
```

## Licence

MIT, © 2026 Kane Technology Group, LLC. The API's answers are subject to the
[Songlinks terms](https://songlinks.io/terms).
