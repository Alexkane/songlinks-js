import { describe, expect, it } from "vitest";
import { Songlinks } from "../src/index.js";

// Against the real API, only when asked: SONGLINKS_LIVE=1 npm test. Three requests, so it never spends a caller's
// budget in CI, and it checks shapes rather than counts, which move with every data reload.
const live = process.env.SONGLINKS_LIVE === "1";

describe.skipIf(!live)("live API", () => {
  const sl = new Songlinks({ baseUrl: process.env.SONGLINKS_BASE_URL, userAgent: "songlinks-js-tests" });

  it("version names the model and the data date", async () => {
    const v = await sl.version();
    expect(v.model_md5).toMatch(/^[0-9a-f]{32}$/);
    expect(v.mlc_snapshot == null || /^\d{4}-\d{2}-\d{2}$/.test(v.mlc_snapshot)).toBe(true);
  });

  it("a lookup returns candidates with records", async () => {
    const r = await sl.lookup("mark hoppus", { routes: [] });
    expect(r.answer).toBe("candidates");
    const candidates = r.candidates ?? [];
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].records.length).toBeGreaterThan(0);
  });

  it("a person read returns a page of works", async () => {
    const r = await sl.lookup("mark hoppus", { routes: [] });
    const id = (r.candidates ?? []).find((c) => c.persistent_id)?.persistent_id;
    expect(id).toBeTruthy();
    const p = await sl.person(id!, { worksLimit: 5 });
    expect(p.works_list.items.length).toBeGreaterThan(0);
  });
});
