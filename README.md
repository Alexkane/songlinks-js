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
- **Typed end to end.** Your editor knows every field of every answer, with a description of each, taken from the
  API's own description of itself.
- **Runs anywhere modern JavaScript does.** Node 18+, browsers, Deno and Bun, with no other libraries needed.
- **Built for real apps.** Clear errors, automatic retries when the API is busy, and long lists paged for you.

> **New to this?** Skip to [Your first program, step by step](#your-first-program-step-by-step): it starts from
> installing the language and ends with a working answer. The [words used here](#the-words-used-here) are explained too.

```sh
npm install songlinks
```

## Thirty seconds

```ts
import { Songlinks } from "songlinks";

const songlinks = new Songlinks({ userAgent: "my-app/1.0" });

const answer = await songlinks.lookup("mark hoppus");
if (answer.answer === "rejected") throw new Error(`no answer: ${answer.rejection?.code}`); // e.g. a one-word name
const candidate = answer.candidates[0];
console.log(candidate.persistent_id, candidate.names, candidate.works);
// SLP-ZYM7-GD3E-S [ 'MARK HOPPUS' ] 302

const person = await songlinks.person("SLP-ZYM7-GD3E-S", { worksLimit: 3 });
console.log(person.works_list.items.map((w) => w.title));
// [ 'I MISS YOU', 'ALL THE SMALL THINGS', 'DOWN' ]

const { writers } = await songlinks.writers(["00338980326", "00340247397"]);
console.log(writers.map((w) => [w.name, w.person_id]));
// [ [ 'MARK HOPPUS', 'SLP-ZYM7-GD3E-S' ], [ 'TRAVIS L BARKER', 'SLP-MG23-XM9B-Y' ] ]
```

Every person has a page you can link to, such as [songlinks.io/person/SLP-ZYM7-GD3E-S](https://songlinks.io/person/SLP-ZYM7-GD3E-S).
It shows the registrations behind the person and what each join rests on.

> **Beta.** Unverified machine output, from a dated snapshot of registration data (a lookup's or a person's
> `provenance.mlc_snapshot` gives its date, and `version()` gives the current one). Some answers are wrong and some are incomplete. Not for rights or royalty decisions.

### More

```ts
// Which of several writers with the same name wrote a song? Pass one of their songs.
const { song_match } = await songlinks.lookup("amy allen", { song: "espresso" });
// song_match: { match: "exact", candidates: ["c1"] }: the candidate whose `ref` is "c1" is the Amy Allen credited
// on that song

// Every work of a person, paged for you.
for await (const work of songlinks.personWorks("SLP-ZYM7-GD3E-S")) {
  console.log(work.title);
}
```

## Your first program, step by step

Never called an API from code before? This takes about five minutes.

**Before you start**, you need two things:

- **A terminal**, where you type commands. On a Mac, open Terminal (in Applications, then Utilities). On Windows, open
  PowerShell from the Start menu. Type each command below on its own line and press Enter after it.
- **A plain-text editor** for code, such as the free [Visual Studio Code](https://code.visualstudio.com). A word
  processor (Word, or TextEdit in its usual mode) adds formatting that stops code from running.
1. **Install Node.js** 18 or later from [nodejs.org](https://nodejs.org) (the "LTS" download). Check it worked by
   typing `node --version` in a terminal; it prints a version such as `v22.11.0`.
2. **Make a folder for your project** and add the SDK to it:

   ```sh
   mkdir songlinks-test
   cd songlinks-test
   npm init -y
   npm pkg set type=module
   npm install songlinks
   ```

   `npm pkg set type=module` lets your files use `import`, as every example here does.
3. **Create a file** called `first.mjs` in the `songlinks-test` folder, in your editor, with this in it:

   ```js
   import { Songlinks } from "songlinks";

   const songlinks = new Songlinks({ userAgent: "my-first-test/1.0" });
   const answer = await songlinks.lookup(process.argv[2] ?? "mark hoppus");

   if (answer.answer === "rejected") {
     console.log("No answer, because:", answer.rejection.code);
   } else {
     for (const person of answer.candidates) {
       console.log(person.persistent_id ?? "(no person ID yet)", person.names.join(", "), "(works: " + person.works + ")");
     }
   }
   ```

   `userAgent` names your program to the API, so a problem can be traced to it; any short name will do.
4. **Run it**, from the same folder, with any songwriter's full name:

   ```sh
   node first.mjs "mark hoppus"
   ```

   You should see `SLP-ZYM7-GD3E-S MARK HOPPUS (works: 302)`.

   **Keep the quotes** around the name: without them, only the first word is sent.

   **What you might see instead:**
   - **Several lines.** The name could belong to more than one person, so each possible person gets a line.
   - **`(no person ID yet)`.** Songlinks found the registrations but hasn't given that person an ID yet. That is
     normal, and the rest of the line is still the answer.
   - **`No answer, because: single-token`.** The name is one word, such as `madonna`, which matches too many people.
     Use the full name.
   - **`No answer, because: no-match`.** Nothing registered is close to that name. Check the spelling.

From here, the [examples](#examples) do real jobs: copy one from the
[examples folder on GitHub](https://github.com/Alexkane/songlinks-js/tree/main/examples) into your folder. They are
TypeScript (`.ts`) files, which Node 23.6 and later run directly (`node resolve-name.ts`); on an older Node, run
`npx tsx resolve-name.ts`. [Reading an answer](#reading-an-answer) explains what comes back, and the
[words used here](#the-words-used-here) are explained just below.

## The words used here

Music-publishing words, which you'll meet in the answers:

- **Songwriter registration**: when a song is written, its publisher registers it so royalties reach the people who
  wrote it. Each registration names the writers, as typed by whoever filed it. One songwriter can therefore appear
  under several spellings, and two different songwriters can share a name.
- **Record**: one of those registered writer entries: a name as it was typed, with its IPI name number if it has one,
  and the songs (works) registered under it.
- **IPI name number**: an 11-digit number that identifies a songwriter or publisher to collecting societies, such as
  `00338980326`. Many records have none, and one person can have several.
  [More about IPI name numbers](https://songlinks.io/guides/ipi-name-numbers).
- **Work**: a song as a composition (the melody and lyrics), as opposed to a particular recording of it.
- **ISWC**: the international code for a work, such as `T0719661581`. Not every registered work has one.
- **Person** and **person ID**: Songlinks groups the records it judges to be one human into a person and gives them a
  person ID, such as `SLP-ZYM7-GD3E-S`. Every person has a page, such as
  [songlinks.io/person/SLP-ZYM7-GD3E-S](https://songlinks.io/person/SLP-ZYM7-GD3E-S).
- **Candidate**: what a lookup by name returns: the records that name reaches, grouped into people for that one
  question. A candidate usually matches one person ID, but it is worked out fresh each time.
- **Evidence**: why two records were grouped: the same IPI name number, or a judgement that they are the same person
  (for example, the same co-writers and publishers).
- **Rejected**: a lookup that gave no candidates, with a reason, such as a one-word name (`madonna`) that matches too
  many people to group. It is an answer, not an error.

Programming words:

- **API**: a service that programs talk to over the internet. The Songlinks API answers questions such as "who is
  this songwriter?".
- **SDK**: this library. It does the talking to the API for you, so your code calls a function instead of building
  web requests by hand.
- **Rate limit**: the most requests the API accepts from one internet address in a stretch of time: about 100 every
  5 minutes, or 20 from VPNs and cloud servers. Over it, the SDK tells you how long to wait.
- **npm**: the tool that downloads JavaScript libraries, such as this one, into your project.

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

A **person** and a **candidate** are different things: see [the words used here](#the-words-used-here).

- **A lookup candidate is not a stored person.** It is the lookup's own grouping, made for the name you asked.
  `persistent_id` is the stored person when there is exactly one. A candidate whose records belong to more than one
  stored person has no `persistent_id` and lists them in `stored_persons`. Read each record's own `persistent_id`.
- **A candidate can count more works than its person.** "mark hoppus" reaches two registrations, 302 works between
  them; the person `SLP-ZYM7-GD3E-S` holds one of them as theirs (294 works) and lists the other as `possible`.
  `person()` is the authority on what an ID holds.
- **Null is ordinary.** Many records have no person ID yet.
- **Match a writers check by number, not position.** Repeats and two forms of one number come back as one entry, as
  11 digits. `normalizeIpi()` turns your input into the same form.
- **Person IDs can be prerelease.** A prerelease ID may stop resolving, or point at a different person, without notice.
  Check `prerelease` before you store one.

## Errors and retries

Every non-success answer throws a `SonglinksError` with the HTTP `status`, the API's `code` (its `error` field, the
one to branch on), a `message` for people, and the response `body`.

```ts
import { PersonWithdrawnError, RateLimitedError, SonglinksError } from "songlinks";

// Continuing from the code above, where `songlinks` was created.
const personId = "SLP-0000-0000-0"; // an ID no one holds, to see the not-found branch
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

- **Retried automatically:** `429` and `503` answers and network failures, up to `maxRetries` times (default 2).
  When the API asks for a wait (in a `Retry-After` header or the body's `retry_after_seconds`) of a minute or less,
  the client waits that long; otherwise it backs off from half a second.
- **Thrown at once:** a requested wait longer than a minute, for you to schedule (`retryAfterSeconds` on a 429).
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

The API is free and open. It allows about 100 requests per 5 minutes from one address, across every endpoint, and 20
from VPNs, proxies and hosting providers, which includes most cloud servers. Please send a `userAgent` that names your
app, keep to one request at a time per user action, and cache answers you reuse. Over the limit, the SDK throws a
`RateLimitedError` whose `retryAfterSeconds` is the most you need to wait; for a whole roster, see
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
