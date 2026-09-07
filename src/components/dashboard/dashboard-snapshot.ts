/**
 * Serialized dashboard snapshot types (R14-K §14c).
 *
 * Re-exported from core so the presentation layer keeps a single, stable
 * import path; the definitions themselves live in
 * `src/core/application/dashboard/dashboard-types.ts` and are plain data
 * types (no React, no client-only imports).
 */
export type {
  DashboardAccountSnapshot,
  DashboardSnapshot,
} from '../../core/application/dashboard/dashboard-types';
