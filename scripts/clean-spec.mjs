#!/usr/bin/env node
// Writes the API's OpenAPI document with its prose made ready for the SDK's TSDoc, for `npm run generate` to type
// from. spec/openapi.json itself stays as the API published it.
//
//   node scripts/clean-spec.mjs spec/openapi.json > .generated/openapi.json
//
// Each description becomes sentences: a capital first letter and a closing full stop, and markdown links to
// site-relative pages made absolute, since the SDK's docs are read away from the site. Field names stay as the API
// writes them (`stored_persons`): the TypeScript types use the API's own JSON names. Pydantic's `title` on each
// field ("Persistent Id") is dropped; it repeats the field's name and would print as a line of noise in every tooltip.
import { readFileSync } from "node:fs";

const SITE = "https://songlinks.io";

export function sentence(text) {
  let t = String(text).replace(/\s+/g, " ").trim();
  if (!t) return t;
  t = t.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (_, label, path) => `[${label}](${SITE}${path})`);
  if (/^[a-z]/.test(t)) t = t[0].toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

function clean(node, parentKey) {
  if (Array.isArray(node)) return node.map((x) => clean(x, parentKey));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    // A field's title, not a schema's or the document's: those sit directly under components.schemas or info.
    if (k === "title" && parentKey !== "schemas" && parentKey !== "info" && typeof v === "string") continue;
    out[k] = k === "description" && typeof v === "string" ? sentence(v) : clean(v, k);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
  // FastAPI's 422 validation shapes: the client reports a 422 as a SonglinksError, so the SDK exports no type for it.
  delete spec.components.schemas.HTTPValidationError;
  delete spec.components.schemas.ValidationError;
  // The HTTP surface is the client's job; the generated types are the answers (scripts/tidy-schema.mjs).
  spec.paths = {};
  process.stdout.write(JSON.stringify(clean(spec, null), null, 2) + "\n");
}
