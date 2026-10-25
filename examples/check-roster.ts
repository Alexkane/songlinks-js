// Check a roster of IPI name numbers: who holds each, and how many works they have.
//
//   node examples/check-roster.ts roster.txt > checked.csv
//
// The input is one IPI name number per line. Numbers are sent 50 at a time, the most the API takes in one call.
import { readFileSync } from "node:fs";
import { Songlinks, WRITERS_MAX, normalizeIpi, type WriterAnswer } from "songlinks";

const songlinks = new Songlinks({ userAgent: "songlinks-example/1.0" });
const ipis = readFileSync(process.argv[2], "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const answers = new Map<string, WriterAnswer>();
for (let i = 0; i < ipis.length; i += WRITERS_MAX) {
  const { writers } = await songlinks.writers(ipis.slice(i, i + WRITERS_MAX));
  for (const w of writers) answers.set(w.ipi_name_number, w);
}

console.log("ipi,status,person_id,name,works");
for (const ipi of ipis) {
  // The answer writes each number as 11 digits, with repeats merged, so look yours up in the same form.
  const w = answers.get(normalizeIpi(ipi));
  console.log([ipi, w?.status, w?.person_id, w?.name && `"${w.name}"`, w?.works].map((v) => v ?? "").join(","));
}
