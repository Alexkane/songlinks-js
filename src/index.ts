export {
  Songlinks,
  SonglinksError,
  RateLimitedError,
  PersonWithdrawnError,
  WRITERS_MAX,
  WORKS_PAGE_MAX,
} from "./client.js";
export type {
  SonglinksOptions,
  LookupOptions,
  PersonOptions,
  LookupResponse,
  PersonResponse,
  PersonWithdrawnResponse,
  PersonWork,
  WritersResponse,
  VersionResponse,
  Cluster,
  Record,
  ApiError,
  RateLimited,
} from "./client.js";
export type { components, paths } from "./schema.js";
export { VERSION } from "./version.js";
