// Who is this songwriter? Print each person a name could be, with the evidence.
//
//   node examples/resolve-name.ts "mark hoppus"
import { Songlinks } from "songlinks";

const songlinks = new Songlinks({ userAgent: "songlinks-example/1.0" });
const answer = await songlinks.lookup(process.argv[2] ?? "mark hoppus");

if (answer.answer === "rejected") {
  // Not an error: the API explains why it gave no candidates, such as a name too common to group.
  console.log("No answer:", answer.rejection?.code, "- nearest:", answer.rejection?.nearest);
} else {
  for (const person of answer.candidates ?? []) {
    // persistent_id is null when no ID has been issued yet, which is common; the records are still the answer.
    console.log(`${person.persistent_id ?? "(no person ID yet)"}  ${person.names.join(", ")}  ${person.works} works`);
    for (const r of person.records) {
      console.log(`    ${r.name.padEnd(30)} IPI ${(r.ipi_name_number ?? "-").padEnd(12)} ${r.works} works`);
    }
    const rules = [...new Set(person.evidence.map((e) => e.rule))].sort().join(", ");
    console.log(`    joined by: ${rules || "nothing to join: one record"}`);
  }
  // Pairs the model would not join are shown apart, never as part of a person.
  if (answer.review?.length) console.log(`\n${answer.review.length} pair(s) held apart for review.`);
}
