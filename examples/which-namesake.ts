// Two writers share a name: which one wrote this song?
//
//   node examples/which-namesake.ts "amy allen" "espresso"
import { Songlinks } from "songlinks";

const [name, song] = process.argv.length > 3 ? [process.argv[2], process.argv[3]] : ["amy allen", "espresso"];
const songlinks = new Songlinks({ userAgent: "songlinks-example/1.0" });
const answer = await songlinks.lookup(name, { song });

const match = answer.song_match;
if (!match?.candidates?.length) {
  console.log(`No one called "${name}" in this answer has a work titled "${song}".`);
} else {
  // song_match names candidates by their `ref` (c1, c2 ...), which is only meaningful inside this one answer.
  const byRef = new Map((answer.candidates ?? []).map((c) => [c.ref, c]));
  console.log(`"${song}": ${match.match} title match`);
  for (const ref of match.candidates) {
    const p = byRef.get(ref)!;
    console.log(`  ${p.persistent_id ?? ref}  ${p.names.join(", ")}  IPI ${p.ipi_name_numbers.join(", ")}`);
  }
}
