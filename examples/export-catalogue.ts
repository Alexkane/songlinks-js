// Export every work of a person to CSV.
//
//   node examples/export-catalogue.ts SLP-ZYM7-GD3E-S > works.csv
import { Songlinks } from "songlinks";

const songlinks = new Songlinks({ userAgent: "songlinks-example/1.0" });
const csv = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

console.log("mlc_work_id,title,iswc");
// personWorks pages through the API 200 works at a time; nothing here needs to know about pages.
for await (const work of songlinks.personWorks(process.argv[2] ?? "SLP-ZYM7-GD3E-S")) {
  console.log([work.mlc_work_id, work.title, work.iswc].map(csv).join(","));
}
