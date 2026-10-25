#!/usr/bin/env node
// Makes openapi-typescript's output into the SDK's public types: one exported interface per response schema.
//
//   node scripts/tidy-schema.mjs src/schema.ts
//
// Why each step:
//   * openapi-typescript writes descriptions under an `@description` tag, which TSDoc does not define, so editors and
//     TypeDoc show an unknown tag instead of the comment. It becomes the comment's summary.
//   * It nests every schema inside `components["schemas"]` and refers to them by that path, so documentation tools
//     expand a return type such as LookupResponse into one unreadable inline structure. Each schema becomes a
//     top-level interface instead, with references by name, so `lookup()` documents as Promise<LookupResponse> and
//     every type has its own page.
//   * Two schemas are renamed, as in the Java SDK: `Record` would shadow TypeScript's built-in Record, and `Error` the
//     built-in Error. The JSON is unchanged.
//   * The HTTP plumbing (`paths`, `operations` and the empty members of `components`) goes: the client wraps it.
import { readFileSync, writeFileSync } from "node:fs";

const RENAMES = { Record: "LookupRecord", Error: "ApiError" };
const path = process.argv[2];
const lines = readFileSync(path, "utf8")
  .replace(/\/\*\* @description /g, "/** ")
  .replace(/^(\s*\*) @description /gm, "$1 ")
  .split("\n");

const open = lines.indexOf("    schemas: {");
if (open < 0) throw new Error("tidy-schema: no `schemas` block in the generated file");

// Inside `schemas`, each schema is an optional doc comment at 8 spaces (from `/**` to `*/`), then `        Name: {`,
// its body at 12, and `        };`.
const schemas = [];
let doc = [];
for (let i = open + 1; i < lines.length && lines[i] !== "    };"; i++) {
  if (lines[i].startsWith("        /**")) {
    doc = [];
    for (; ; i++) {
      doc.push(lines[i].slice(8));
      if (lines[i].includes("*/")) break;
    }
    continue;
  }
  const m = /^ {8}([A-Za-z0-9_]+): \{$/.exec(lines[i]);
  if (!m) continue;
  const body = [];
  for (i++; lines[i] !== "        };"; i++) body.push(lines[i].slice(8));
  schemas.push({ name: RENAMES[m[1]] ?? m[1], source: m[1], doc, body });
  doc = [];
}
if (!schemas.length) throw new Error("tidy-schema: found no schemas");

const byName = (s) => s.replace(/components\["schemas"\]\["([A-Za-z0-9_]+)"\]/g, (_, n) => RENAMES[n] ?? n);
const out = [
  "/**",
  " * The Songlinks API's response types, generated from its OpenAPI document by `npm run generate`.",
  " * Do not edit by hand: change scripts/clean-spec.mjs or scripts/tidy-schema.mjs and regenerate.",
  " *",
  " * @packageDocumentation",
  " */",
  "",
];
for (const s of schemas) out.push(...s.doc, `export interface ${s.name} {`, ...s.body.map(byName), "}", "");
out.push(
  "/** Every response type, keyed by its name in the API's OpenAPI document. */",
  "export interface components {",
  "    /** The response schemas. */",
  "    schemas: {",
  ...schemas.flatMap((s) => [`        /** See {@link ${s.name}}. */`, `        ${s.source}: ${s.name};`]),
  "    };",
  "}",
  "",
);
writeFileSync(path, out.join("\n"));
