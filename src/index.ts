/**
 * The official TypeScript and JavaScript SDK for the Songlinks API: find the songwriter behind a name.
 *
 * @packageDocumentation
 */
export {
  Songlinks,
  SonglinksError,
  RateLimitedError,
  PersonWithdrawnError,
  WRITERS_MAX,
  WORKS_PAGE_MAX,
  normalizeIpi,
} from "./client.js";
export type {
  SonglinksOptions,
  LookupOptions,
  PersonOptions,
} from "./client.js";
export type {
  LookupResponse,
  Query,
  Cluster,
  LookupRecord,
  Evidence,
  ReviewItem,
  Link,
  Rejection,
  Provenance,
  SongMatch,
  SongRecord,
  SongBeyond,
  RateLimit,
  PersonResponse,
  PersonRecord,
  PersonWork,
  WorksPage,
  PersonEvent,
  PersonProvenance,
  BuildRef,
  PersonWithdrawnResponse,
  WritersResponse,
  WriterAnswer,
  WritersSummary,
  VersionResponse,
  ApiError,
  RateLimited,
  components,
} from "./schema.js";
export { VERSION } from "./version.js";
