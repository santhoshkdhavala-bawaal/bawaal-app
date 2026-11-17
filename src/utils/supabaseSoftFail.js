/**
 * Shared Supabase soft-fail circuit for Arena / social / dashboard.
 * Missing tables, RLS rejects, and cold-start 404s never crash UX —
 * services fall back to local mocks after a one-shot softFailWarn.
 */
import { softFailWarn } from './softFailLog';

/** Session short-circuit — table name → disabled for this JS runtime. */
const missingTables = new Set();

export const BAWAAL_BACKEND_SETUP_HINT =
  'Open Supabase → SQL Editor → run supabase/ENSURE_BAWAAL_BACKEND_LOCKDOWN.sql';

/**
 * Detect missing relation / schema-cache / PostgREST 404-class errors.
 * @param {unknown} error
 */
export function isMissingRelationError(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const msg = String(
    error.message || error.details || error.hint || error || ''
  );
  return (
    status === 404 ||
    status === 400 ||
    code === '42P01' ||
    code === 'PGRST116' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === '42501' ||
    /does not exist|relation .* not found|Could not find the table|schema cache|not found|404|permission denied|row-level security/i.test(
      msg
    )
  );
}

/**
 * Mark a table unavailable for this session (stops 404 spam).
 * @param {string} table
 * @param {string} [scope]
 * @param {unknown} [reason]
 */
export function markTableMissing(table, scope = 'supabase', reason) {
  const name = String(table || '').trim();
  if (!name || missingTables.has(name)) return;
  missingTables.add(name);
  softFailWarn(
    `${scope}:${name}`,
    `[${scope}] ${name} unavailable — local mock / empty fallback`,
    {
      reason: String(reason || 'missing'),
      hint: BAWAAL_BACKEND_SETUP_HINT,
    }
  );
}

export function isTableDisabled(table) {
  return missingTables.has(String(table || '').trim());
}

/** Test / recovery only — do not call from hot paths. */
export function resetMissingTableCircuit() {
  missingTables.clear();
}

/**
 * Soft select helper — returns [] on missing table / error / throw.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {string} select
 * @param {(q: any) => any} [build]
 * @param {string} [scope]
 */
export async function softSelect(client, table, select, build, scope = 'supabase') {
  if (!client || isTableDisabled(table)) return [];
  try {
    let query = client.from(table).select(select);
    if (typeof build === 'function') query = build(query);
    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(table, scope, error.message || error.code);
      } else {
        softFailWarn(
          `${scope}:select:${table}`,
          `[${scope}] ${table} select soft-fail`,
          error.message || error
        );
      }
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (isMissingRelationError(err)) {
      markTableMissing(table, scope, err?.message || err);
    } else {
      softFailWarn(
        `${scope}:throw:${table}`,
        `[${scope}] ${table} throw soft-fail`,
        err?.message || err
      );
    }
    return [];
  }
}

/**
 * Soft insert — never throws.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {Record<string, unknown>|Record<string, unknown>[]} row
 * @param {string} [scope]
 */
export async function softInsert(client, table, row, scope = 'supabase') {
  if (!client || isTableDisabled(table)) {
    return { ok: false, fromCloud: false, reason: 'table-missing' };
  }
  try {
    const { data, error } = await client.from(table).insert(row).select();
    if (error) {
      if (isMissingRelationError(error)) {
        markTableMissing(table, scope, error.message || error.code);
        return { ok: false, fromCloud: false, reason: 'table-missing' };
      }
      softFailWarn(
        `${scope}:insert:${table}`,
        `[${scope}] ${table} insert soft-fail`,
        error.message || error
      );
      return { ok: false, fromCloud: false, error };
    }
    return { ok: true, fromCloud: true, data };
  } catch (err) {
    if (isMissingRelationError(err)) {
      markTableMissing(table, scope, err?.message || err);
    }
    return { ok: false, fromCloud: false, error: err };
  }
}
