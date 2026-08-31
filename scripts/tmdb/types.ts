interface BaseImportConfig {
  limit: number;
  tmdbReadAccessToken: string;
}

export interface DryRunImportConfig extends BaseImportConfig {
  mode: 'dry-run';
}

export interface WriteImportConfig extends BaseImportConfig {
  mode: 'write';
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export type ImportConfig = DryRunImportConfig | WriteImportConfig;

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieCandidate {
  id?: unknown;
  title?: unknown;
  original_title?: unknown;
  overview?: unknown;
  poster_path?: unknown;
  backdrop_path?: unknown;
  release_date?: unknown;
  original_language?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
  popularity?: unknown;
  adult?: unknown;
  genre_ids?: unknown;
}

export interface TmdbDiscoverPage {
  page: number;
  totalPages: number;
  results: TmdbMovieCandidate[];
}

export interface NormalizedGenre {
  tmdb_id: number;
  name: string;
  slug: string;
}

export interface NormalizedMovie {
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string | null;
  release_date: string | null;
  original_language: string | null;
  tmdb_rating: number;
  tmdb_vote_count: number;
  popularity: number | null;
  adult: false;
}

export interface AcceptedMovie {
  movie: NormalizedMovie;
  genres: NormalizedGenre[];
}

export type RejectionReason =
  | 'adult_content'
  | 'duplicate_tmdb_id'
  | 'insufficient_votes'
  | 'invalid_genre_ids'
  | 'invalid_original_title'
  | 'invalid_popularity'
  | 'invalid_release_date'
  | 'invalid_title'
  | 'invalid_tmdb_id'
  | 'missing_overview'
  | 'missing_poster'
  | 'rating_out_of_range'
  | 'unknown_genre_ids';

export interface RejectedMovie {
  tmdbId: number | null;
  title: string | null;
  reasons: RejectionReason[];
  unknownGenreIds: number[];
}

export type NormalizeResult =
  | { accepted: true; value: AcceptedMovie }
  | { accepted: false; value: RejectedMovie };

export interface DryRunReport {
  requestedAcceptedCount: number;
  pagesFetched: number;
  candidatesReceived: number;
  candidatesEvaluated: number;
  acceptedMovies: AcceptedMovie[];
  rejectedMovies: RejectedMovie[];
}

export interface WriteFailure {
  operation: string;
  message: string;
}

export interface WriteReport {
  moviesSynchronized: number;
  genresSynchronized: number;
  movieGenreRelationshipsSynchronized: number;
  failures: WriteFailure[];
}
