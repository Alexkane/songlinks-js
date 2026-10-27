// Who wrote these recordings? A list of ISRCs in, CSV out: one line for each writer of each work a recording is
// registered to.
//
//   node examples/who-wrote-these.ts isrcs.txt > writers.csv
//
// The input is one ISRC per line, such as USMC19959123 or US-MC1-99-59123. Codes are sent 50 at a time, the most the
// API takes in one call.
import { readFileSync } from "node:fs";
import { Songlinks, SONGWRITERS_MAX, normalizeIsrc, type RecordingAnswer } from "songlinks";

const songlinks = new Songlinks({ userAgent: "songlinks-example/1.0" });
const isrcs = readFileSync(process.argv[2], "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const answers = new Map<string, RecordingAnswer>();
for (let i = 0; i < isrcs.length; i += SONGWRITERS_MAX) {
  const { recordings } = await songlinks.songwriters(isrcs.slice(i, i + SONGWRITERS_MAX));
  for (const r of recordings) answers.set(r.isrc, r);
}

const csv = (v: string | number | null | undefined) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
console.log("isrc,status,title,iswc,writer,ipi,role,person_id");
for (const isrc of isrcs) {
  // The answer writes each ISRC as 12 characters in upper case, with repeats merged, so look yours up in that form.
  const r = answers.get(normalizeIsrc(isrc));
  const works = r?.works ?? [];
  // unregistered and invalid recordings have no works, and still get a line, so nothing on your list goes missing.
  if (!works.length) console.log([isrc, r?.status].map(csv).join(","));
  for (const w of works) {
    for (const x of w.writers) {
      // persistent_id is empty when the writer's record is not part of a stored person, often one with no IPI.
      const row = [isrc, r?.status, w.title, w.iswc, x.name, x.ipi_name_number, x.role, x.persistent_id];
      console.log(row.map(csv).join(","));
    }
  }
}
