/**
 * The Songlinks API's response types, generated from its OpenAPI document by `npm run generate`.
 * Do not edit by hand: change scripts/clean-spec.mjs or scripts/tidy-schema.mjs and regenerate.
 *
 * @packageDocumentation
 */

/** A build: the automatic run that groups records into people and issues IDs. */
export interface BuildRef {
    /** Identifies the build. */
    build_id: number;
    /** The build's status, such as `applied`. */
    status: string;
    /** Where it ran. */
    environment: string;
    /** ISO 8601. */
    started_at?: string | null;
    /** ISO 8601. */
    finished_at?: string | null;
    /** Identifies the model the build used. */
    model_version?: string | null;
    /** Identifies the code the build ran. */
    code_commit: string;
    /** True if the build ran with uncommitted changes. */
    code_dirty: boolean;
    /** The date of the registration-data release the build read, YYYY-MM-DD. Null when that load is undated: never a guess. */
    mlc_snapshot?: string | null;
}

/** One person, as this lookup groups them: the registration records judged to be the same songwriter. */
export interface Cluster {
    /** Names this candidate inside this response only (`c1`, `c2`, ...). Another spelling of the name can group the records differently, so never store it. */
    ref: string;
    /** The person ID, `SLP-XXXX-XXXX-C`, or null when none has been issued, or when the records belong to more than one person (see `stored_persons`). Null is common. */
    persistent_id?: string | null;
    /** True: the ID may stop resolving, or later point at a different person, without notice, so do not store it. False: a released ID. Null when there is no ID. */
    prerelease?: boolean | null;
    /** The stored person's `state`; null when there is no ID. */
    person_state?: string | null;
    /** When a record's ID has since been merged into this one, that older ID. */
    redirected_from?: string | null;
    /** How many member records the stored person holds; null when there is no ID. */
    person_records?: number | null;
    /** Member records the stored person holds that this lookup did not reach. Read the person to see them. */
    records_not_in_this_answer?: number | null;
    /** Every distinct registered name in `records`. */
    names: string[];
    /** Every distinct society number in `records`. */
    ipi_name_numbers: string[];
    /** Distinct works across `records`: a work registered under two of them counts once, so this can be less than their sum. */
    works: number;
    /** The registration records grouped into this person, most works first. */
    records: LookupRecord[];
    /** One entry per pair of records joined. */
    evidence: Evidence[];
    /** The society number most of this person's works are registered under: the one whose records hold the most works. Null when no record has one. */
    main_ipi_name_number?: string | null;
    /** Distinct works on the records carrying `main_ipi_name_number`. `works` minus this is how many works are held only by the person's other registrations, under another number or none. Null when `main_ipi_name_number` is. */
    works_on_main_ipi?: number | null;
    /** The person IDs this candidate's records belong to. Usually one, the same as `persistent_id`. Two or more mean Songlinks' person records hold these registrations as different people, so the candidate has no single `persistent_id`: read each record's own ID. */
    stored_persons?: string[];
}

/** The body of a 400, 404, 500 or 503 response. It never carries detail about what failed. */
export interface ApiError {
    /** `too_many` or `no_numbers` (400), `not_found` (404), `internal` (500), or `not_ready` or `busy` (503). Branch on this. */
    error: string;
    /** A short sentence for people; its wording may change. */
    message: string;
}

/** Why two records in a candidate were joined. */
export interface Evidence {
    /** The two records joined, by `party_record_id`. */
    records: number[];
    /** `same_ipi_name_number`: both records carry the same society number. `model`: the model judged them to be the same person. */
    rule: string;
    /** The model's calibrated probability that the two records are one person, from 0 to 1. */
    probability?: number | null;
    /** What the two records have in common, under `co_writers`, `publishers` and `administrators`, each `{"count": n, "rarest": [names]}`. `rarest` lists the least common shared names, which say the most; names shared by a very large number of writers are left out. A key may be absent. */
    shared?: {
        [key: string]: unknown;
    };
}

/** A record registered under another name next to one of this lookup's records: a stage name and a legal name, for example. A different claim from a candidate: nothing here is joined, and its works are not counted in `works`. */
export interface Link {
    /** The linked record. */
    party_record_id: number;
    /** The linked record's registered name. */
    name: string;
    /** The linked record's society number, or null. */
    ipi_name_number?: string | null;
    /** `checked`: the two people share no registered work, so the link is not a co-writer's. `co-writers too`: they share works, as bandmates do, and the link is weaker. */
    grade?: string | null;
    /** How close together the two records were registered; 1 is adjacent. */
    steps: number;
    /** Works registered under the linked record. */
    works: number;
    /** The record in this lookup the link starts from. */
    from_record: number;
    /** That record's registered name. */
    from_name: string;
    /** `[credited, recorded]`: of the linked record's works that have a recording, how many credit `from_name` as the artist. */
    forward?: number[];
    /** `[credited, recorded]`: of `from_record`'s works that have a recording, how many credit `name` as the artist. */
    back?: number[];
}

/** The answer to one lookup. Check `answer` first. */
export interface LookupResponse {
    /** The question answered. */
    query: Query;
    /** `candidates`, or `rejected`, in which case `rejection` says why. */
    answer: string;
    /** Why the lookup stopped; null unless `answer` is `rejected`. */
    rejection?: Rejection | null;
    /** One entry per person. */
    candidates?: Cluster[];
    /** Pairs of records held apart; never part of a candidate. */
    review?: ReviewItem[];
    /** Records registered under another name next to this lookup's; filled only when `routes` includes `catalogue`. */
    links?: Link[];
    /**
     * Records grouped into this answer; at most `provenance.max_candidates`.
     * @default 0
     */
    records_considered: number;
    /**
     * Records compared with the name.
     * @default 0
     */
    records_searched: number;
    /**
     * Records that matched closely enough to be considered.
     * @default 0
     */
    records_passed: number;
    /**
     * True when more records matched than one lookup groups (`records_passed` > `records_considered`). The answer is partial.
     * @default false
     */
    truncated: boolean;
    /**
     * How many candidates carry a person ID.
     * @default 0
     */
    persons_resolved: number;
    /** Which candidates wrote the song; null unless a `song` was sent and the lookup found candidates. */
    song_match?: SongMatch | null;
    /** Your remaining allowance; null when no per-caller limit is in force. */
    rate_limit?: RateLimit | null;
    /** What produced this answer. */
    provenance: Provenance;
}

/** One entry in the ID's history. History is only ever added to, never edited. */
export interface PersonEvent {
    /** When, ISO 8601. */
    at: string;
    /** `issued`, `released` (no longer prerelease), `record_added`, `record_removed`, `record_moved`, `evidence_changed`, `merged`, `split`, `wiped` (a prerelease ID withdrawn) or `flagged`. */
    kind: string;
    /** The ID the entry is about; for `merged`, the ID that now redirects. */
    person_id: string;
    /** For `merged`, the ID it redirects to. */
    other_person_id?: string | null;
    /** The record concerned, where there is one. */
    party_record_id?: number | null;
    /** The build that made the change, where there is one. */
    build_id?: number | null;
    /** `build` for an automatic build; otherwise who decided. */
    decided_by?: string | null;
}

/** What grouped these records, and what served this response: two different things. `issued_by` and `latest_build` grouped the records. `api_model_md5` and `api_code_commit` only served the response, and decided nothing in it. */
export interface PersonProvenance {
    /** The build that issued the ID. */
    issued_by?: BuildRef | null;
    /** The most recent build to group these records. */
    latest_build?: BuildRef | null;
    /** The date of the registration-data release this answer read, YYYY-MM-DD. Null when that load is undated: never a guess. */
    mlc_snapshot?: string | null;
    /** The model serving lookups; not the model that grouped this person. */
    api_model_md5: string;
    /** The code that served this response. */
    api_code_commit: string;
}

/** One registration record on a stored person, and how it was linked. */
export interface PersonRecord {
    /** Identifies this record in the registration data. */
    party_record_id: number;
    /** The name as registered; null only if the record is no longer in the registration data. */
    name?: string | null;
    /** The part of the name the record is filed under, usually the surname. */
    key_name?: string | null;
    /** The rest of the name, usually given names. */
    names_before_key_name?: string | null;
    /** The society (IPI) name number, or null. */
    ipi_name_number?: string | null;
    /** This record's own works, counted once each. */
    works: number;
    /** `anchor`: the record the ID was issued on. `asserted`: a member. `possible`: perhaps this person, but not a member. */
    link: string;
    /** Why the record was linked: `same_ipi` (the same society number as a member), `ipi` (the anchor's own society number), `model` (the model's judgement), `corroborated` (confirmed by an independent outside source) or `verdict` (decided by a person). */
    rule: string;
    /** The model's calibrated probability, where the model was involved. */
    score?: number | null;
    /** `build` for an automatic build; otherwise who decided. */
    decided_by: string;
    /** The build that linked the record. */
    build_id?: number | null;
    /** When it was linked, ISO 8601. */
    linked_at?: string | null;
    /** The other person ID that holds this record as a member, or null; always null on `records`, whose holder is this person. */
    member_of?: string | null;
    /** Whether that person ID is prerelease. */
    member_of_prerelease?: boolean | null;
}

/** A stored person: what the ID holds, not a fresh lookup. `records` are members. `possible` records are not members, are never counted, and may belong to someone else. */
export interface PersonResponse {
    /** `SLP-XXXX-XXXX-C`; the last character is a check character. */
    person_id: string;
    /** True: the ID may stop resolving, or later point at a different person, without notice, so do not store it. False: a released ID. */
    prerelease: boolean;
    /** `active`. `split`: part of the group was separated and this ID kept the anchor. `anchor_missing`: the anchor record is no longer in the registration data; the ID stays. */
    state: string;
    /** What the ID qualifies on now: `same_ipi` (members share a society number), `ipi` (the anchor's society number and catalogue), `corroborated` (a member's society number confirmed by an independent outside source) or `human` (decided by a person). It can change after issue; `issued_evidence` is what it was issued on. */
    evidence: string;
    /** What the ID was issued on, one of the `evidence` values, from its history. Null when the history does not record it. */
    issued_evidence?: string | null;
    /** When the ID was issued, ISO 8601. */
    issued_at?: string | null;
    /** When it was released; null while prerelease. */
    released_at?: string | null;
    /** The merged ID this request was redirected from, when the history confirms it. */
    redirected_from?: string | null;
    /** IDs merged into this one; each redirects here. */
    merged_from?: string[];
    /** The name to show for this person. */
    name?: string | null;
    /** Every distinct registered name among the members. */
    names: string[];
    /** Every distinct society number among the members. */
    ipi_name_numbers: string[];
    /** Distinct works across member records; `possible` records are not counted. */
    works: number;
    /** This person's main society number: the one on the record their ID was created around (`link` `anchor`), which never changes. Usually the number most of their works are under; a record with another number may hold more (since 2026-09-15 such a record joins only on a person's verdict; earlier IDs can hold ones the model joined, `rule` `model`). Null when no member has one. */
    main_ipi_name_number?: string | null;
    /** Distinct works on the member records carrying `main_ipi_name_number`. `works` minus this is how many works only the person's other registrations hold. Null when `main_ipi_name_number` is. */
    works_on_main_ipi?: number | null;
    /** The members: `link` is `anchor` or `asserted`. */
    records: PersonRecord[];
    /** NOT members: perhaps this person, never counted. */
    possible?: PersonRecord[];
    /** One page of works; ask for more with `works_offset`. */
    works_list: WorksPage;
    /** Every change to this ID, oldest first. */
    history: PersonEvent[];
    /** Your remaining allowance; null when no per-caller limit is in force. */
    rate_limit?: RateLimit | null;
    /** What grouped these records, and what served the response. */
    provenance: PersonProvenance;
}

/** HTTP 410: this ID was issued and later withdrawn. The number will never be issued to anyone else. */
export interface PersonWithdrawnResponse {
    /** The withdrawn ID. */
    person_id: string;
    /**
     * Always `withdrawn`.
     * @default withdrawn
     */
    state: string;
    /** Whether the ID was prerelease. */
    prerelease?: boolean | null;
    /** When it was issued, ISO 8601. */
    issued_at?: string | null;
    /** When it was withdrawn, ISO 8601. */
    withdrawn_at?: string | null;
    /** Every change to this ID, oldest first. */
    history: PersonEvent[];
}

/** One work registered under a member record. */
export interface PersonWork {
    /** Identifies the work in the registration data. */
    mlc_work_id: string;
    /** The registered title. */
    title?: string | null;
    /** The ISWC, or null when the work has none. */
    iswc?: string | null;
    /** The member records the work is registered under. */
    records: number[];
}

/** What produced this answer. Keep `model_md5` and `code_commit` with any answer you store. */
export interface Provenance {
    /** Identifies the model that grouped the records. */
    model_md5: string;
    /** Identifies the code that produced the answer. */
    code_commit: string;
    /** The date of the registration-data release this answer read, YYYY-MM-DD. Null when that load is undated: never a guess. */
    mlc_snapshot?: string | null;
    /** The threshold this answer used; see the `threshold` parameter. */
    threshold: number;
    /** The lowest probability at which an unjoined pair is listed in `review`. */
    review_threshold: number;
    /** The most records one lookup groups; see `truncated`. */
    max_candidates: number;
    /** Time taken to produce the answer, in milliseconds. */
    latency_ms: number;
}

/** The question that was answered, echoed back. */
export interface Query {
    /** The name as sent. */
    name: string;
    /** Which question was answered: `writer_lookup`. */
    question: string;
    /** The threshold used, as sent or defaulted. */
    threshold: number;
    /** The song as sent; null when none was. */
    song?: string | null;
}

/** Your remaining allowance under a per-caller limit. */
export interface RateLimit {
    /** Requests allowed per window. */
    limit: number;
    /** Requests left in the current window. */
    remaining: number;
    /** The length of the window, in seconds. */
    window_seconds: number;
}

/** HTTP 429: over a per-caller limit. Returned only while a limit is in force; wait `retry_after_seconds`. */
export interface RateLimited {
    /**
     * Always `rate_limited`.
     * @default rate_limited
     */
    error: string;
    /** A sentence you can show. */
    message: string;
    /** Requests allowed per window. */
    limit: number;
    /** The length of the window, in seconds. */
    window_seconds: number;
    /** How long to wait; also sent as the `Retry-After` header. */
    retry_after_seconds: number;
    /** Requests counted in the current window. */
    lookups_used: number;
    /**
     * Where to ask for more.
     * @default the address on songlinks.io
     */
    contact: string;
}

/** One registration record: a name as it was registered, with its society number if it has one. */
export interface LookupRecord {
    /** Identifies this record in the registration data. Not a person ID: one person usually has several records. */
    party_record_id: number;
    /** The name as registered. */
    name: string;
    /** The part of the name the record is filed under, usually the surname. */
    key_name?: string | null;
    /** The rest of the name, usually given names. */
    names_before_key_name?: string | null;
    /** The society (IPI) name number, or null when the record has none. */
    ipi_name_number?: string | null;
    /** Works registered under this record. */
    works: number;
    /** The person ID this record belongs to, or null. It can differ from the candidate's `persistent_id` when this lookup groups a record that the stored person does not hold. */
    persistent_id?: string | null;
    /** True: the ID may stop resolving, or later point at a different person, without notice, so do not store it. False: a released ID. Null when there is no ID. */
    prerelease?: boolean | null;
}

/** Why a lookup stopped without candidates. It comes with HTTP 200: it is an answer, not an error. */
export interface Rejection {
    /** `single-token`: the name is one word, which is not searched. `no-match`: nothing matched closely enough. `publishers-only`: every match is registered only as a publisher or administrator, not as a writer. */
    code: string;
    /** Up to five registered names closest to the one asked for, as spelling suggestions. */
    nearest?: string[];
    /** For `publishers-only`, the roles of the records set aside: `publisher`, `administrator`, or both. */
    set_aside_roles?: string[];
}

/** A pair of records that was NOT joined. Nothing here is part of any candidate: show it apart from `candidates`. */
export interface ReviewItem {
    /** The two records, by `party_record_id`. */
    records: number[];
    /** The candidates the two records are in, by `ref`. */
    refs: string[];
    /** `review_band`: the model was unsure, scoring at least `provenance.review_threshold` but below `query.threshold`. `middle_name_conflict`: the records give different middle names, and are never joined on the model alone. `generation_suffix_conflict`: the names carry different generations (JR and SR, II and III), and are never joined on the model alone. `korean_same_name_by_sound`: one Korean name written in different romanisations, held apart rather than joined on how it sounds. `blocked_would_join_conflicting_records`: joining would put two conflicting records into one person through a third, so it was held back whatever the probability. */
    reason: string;
    /** The model's calibrated probability that the two records are one person, from 0 to 1. */
    probability?: number | null;
    /** What the two records have in common, under `co_writers`, `publishers` and `administrators`, each `{"count": n, "rarest": [names]}`. `rarest` lists the least common shared names, which say the most; names shared by a very large number of writers are left out. A key may be absent. */
    shared?: {
        [key: string]: unknown;
    };
}

/** A writer the song reached that the name did not. Shown beside the answer, never joined to anyone in it. */
export interface SongBeyond {
    /** The record. */
    party_record_id: number;
    /** The name it is registered under. */
    name: string;
    /** Its IPI name number, if it has one. */
    ipi_name_number?: string | null;
    /** The person ID holding this record, if any. */
    persistent_id?: string | null;
    /** `same_name`: the name matches as a lookup's would, beyond the records the lookup compared. `half_name`: only the given name or the surname matches, as with a stage name; offered only for a title few works share. */
    tier: string;
    /** Its works with this exact title, as registered; at most three. */
    titles: string[];
}

/** Which of this answer's people wrote a work with the song's title. `candidates` and `records` only point at people already in the answer and never change who is grouped with whom. `beyond`, when present, lists writers the song reached that the name did not, kept apart from the answer. */
export interface SongMatch {
    /** The song as sent. */
    song: string;
    /** `exact`: a work has this title. `partial`: no exact title, but the song's words appear whole and in order in one (`hurt` in `HURT SO GOOD`), which is weaker evidence. `none`: no one in this answer has a work by that title. `too_short`: the song has no letters or digits to match on. */
    match: string;
    /** Refs of the candidates holding a match, in the order of `candidates`. */
    candidates?: string[];
    /** The matching records, with their titles. */
    records?: SongRecord[];
    /** Writers with a work by this exact title whom the name did not find; empty when `beyond_status` is not `ok`. */
    beyond?: SongBeyond[];
    /** Null when this search did not run. `ok`: it ran. `none`: no work has this exact title. `common`: too many works share the title to point at anyone. `unavailable`: not offered here yet. */
    beyond_status?: string | null;
}

/** A record in this answer with a work by the song's title. */
export interface SongRecord {
    /** The record, as in `candidates[].records[]`. */
    party_record_id: number;
    /** The candidate holding it, as `candidates[].ref`. */
    ref: string;
    /** Its matching work titles, as registered; at most three. */
    titles: string[];
}

/** What is serving: the release, the model and the settings every lookup uses. */
export interface VersionResponse {
    /** The release, as in the site's small print. Two deploys of one release can carry different models, which is what `model_md5` is for. */
    version: string;
    /** Identifies the model serving lookups. */
    model_md5: string;
    /** Identifies the code serving. */
    code_commit: string;
    /** The date of the registration-data release this answer read, YYYY-MM-DD. Null when that load is undated: never a guess. */
    mlc_snapshot?: string | null;
    /** The default `threshold` for a lookup. */
    threshold: number;
    /** The lowest probability at which an unjoined pair is listed in `review`. */
    review_threshold: number;
    /** The most records one lookup groups. */
    max_candidates: number;
    /** Always 0: no lookup was run. */
    latency_ms: number;
}

/** One page of the person's works, most-recorded first. */
export interface WorksPage {
    /** All the person's works: distinct works across member records, a work under two of them counted once. */
    total: number;
    /** The position of the first work on this page. */
    offset: number;
    /** The page size asked for. */
    limit: number;
    /** This page's works. */
    items: PersonWork[];
    /** Pass as `works_offset` for the next page; null on the last page. */
    next_offset?: number | null;
    /**
     * `recordings` when these works are ordered by how many recordings each has, `coded` when that count is not available and the page falls back to works with an ISWC first.
     * @default coded
     */
    ordered_by: string;
}

/** One IPI name number from the list, and the person who holds it. */
export interface WriterAnswer {
    /** The number, as 11 digits with its leading zeros. For an `invalid` entry, the text as sent, cut to 32 characters. */
    ipi_name_number: string;
    /** `person`: one person holds this number. `several`: more than one person holds it, and none is chosen. `none`: no person here holds it; it may belong to a publisher, or its records have not been grouped. `invalid`: not an IPI name number (up to 11 digits; spaces and dashes are ignored). */
    status: string;
    /** The person's ID, `SLP-XXXX-XXXX-C`; null unless `status` is `person`. */
    person_id?: string | null;
    /** The name to show for the person. */
    name?: string | null;
    /** Every distinct name the person's records are registered under, `name` first. Compare a spelling you hold against it: a spelling not in this list is not one this person is registered under. Empty unless `status` is `person`. */
    names?: string[];
    /** Distinct works across the person's records. */
    works?: number | null;
    /** The person's main number: the one on the record their ID was created around. It can differ from `ipi_name_number`: the number sent may be a secondary one. */
    main_ipi_name_number?: string | null;
    /** Distinct works on the records carrying `main_ipi_name_number`. */
    works_on_main_ipi?: number | null;
    /** `works` minus `works_on_main_ipi`: works registered only under another spelling of the name or another IPI name number. Null when `works_on_main_ipi` is. */
    works_elsewhere?: number | null;
    /**
     * How many persons hold this number: 1 for `person`, 2 or more for `several`, 0 otherwise.
     * @default 0
     */
    persons: number;
    /** The page to open, relative to this site: the person's page, or for `several` the page listing everyone who holds the number. */
    person_url?: string | null;
}

/** The writers behind a list of IPI name numbers, in the order sent, and how each one's works divide between their main number and the rest. */
export interface WritersResponse {
    /** One entry per distinct number, in the order first sent. */
    writers: WriterAnswer[];
    /** Totals over `writers`. */
    summary: WritersSummary;
    /** Your remaining allowance; null when no per-caller limit is in force. */
    rate_limit?: RateLimit | null;
}

/** Totals over the list. Each number is counted once, however many times it was sent. */
export interface WritersSummary {
    /** Distinct entries checked, invalid ones included. */
    numbers: number;
    /** Numbers held by one person. */
    person: number;
    /** Numbers held by more than one person. */
    several: number;
    /** Numbers no person here holds. */
    none: number;
    /** Entries that are not IPI name numbers. */
    invalid: number;
    /** Distinct persons found. Two numbers of one writer count once. */
    persons: number;
    /** Of `persons`, how many have `works_elsewhere` above zero: writers with works registered under another spelling or number. */
    with_works_elsewhere: number;
}

/** Every response type, keyed by its name in the API's OpenAPI document. */
export interface components {
    /** The response schemas. */
    schemas: {
        /** See {@link BuildRef}. */
        BuildRef: BuildRef;
        /** See {@link Cluster}. */
        Cluster: Cluster;
        /** See {@link ApiError}. */
        Error: ApiError;
        /** See {@link Evidence}. */
        Evidence: Evidence;
        /** See {@link Link}. */
        Link: Link;
        /** See {@link LookupResponse}. */
        LookupResponse: LookupResponse;
        /** See {@link PersonEvent}. */
        PersonEvent: PersonEvent;
        /** See {@link PersonProvenance}. */
        PersonProvenance: PersonProvenance;
        /** See {@link PersonRecord}. */
        PersonRecord: PersonRecord;
        /** See {@link PersonResponse}. */
        PersonResponse: PersonResponse;
        /** See {@link PersonWithdrawnResponse}. */
        PersonWithdrawnResponse: PersonWithdrawnResponse;
        /** See {@link PersonWork}. */
        PersonWork: PersonWork;
        /** See {@link Provenance}. */
        Provenance: Provenance;
        /** See {@link Query}. */
        Query: Query;
        /** See {@link RateLimit}. */
        RateLimit: RateLimit;
        /** See {@link RateLimited}. */
        RateLimited: RateLimited;
        /** See {@link LookupRecord}. */
        Record: LookupRecord;
        /** See {@link Rejection}. */
        Rejection: Rejection;
        /** See {@link ReviewItem}. */
        ReviewItem: ReviewItem;
        /** See {@link SongBeyond}. */
        SongBeyond: SongBeyond;
        /** See {@link SongMatch}. */
        SongMatch: SongMatch;
        /** See {@link SongRecord}. */
        SongRecord: SongRecord;
        /** See {@link VersionResponse}. */
        VersionResponse: VersionResponse;
        /** See {@link WorksPage}. */
        WorksPage: WorksPage;
        /** See {@link WriterAnswer}. */
        WriterAnswer: WriterAnswer;
        /** See {@link WritersResponse}. */
        WritersResponse: WritersResponse;
        /** See {@link WritersSummary}. */
        WritersSummary: WritersSummary;
    };
}
