// Splits a flats & members upload into `accounts` bulk_import calls and merges the
// per-row results back onto the CSV lines.
import type { MemberRow } from './csv';

/** The accounts function accepts at most this many rows per bulk_import call. */
export const MAX_IMPORT_ROWS = 200;

export interface ImportResultRow {
  line: number;
  building: string;
  wing: string;
  flat: string;
  ok: boolean;
  error?: string;
  generatedPassword?: string;
}

/** What one bulk_import call came back with: its results, or the error of the whole call. */
export type ChunkOutcome =
  | { results: { row: number; ok: boolean; error?: string; generated_password?: string }[] }
  | { error: string };

const flatKey = (r: MemberRow) => `${r.building}|${r.wing}|${r.flat}`;

/**
 * Groups rows by flat (first-seen order) and packs whole flats into chunks of at most
 * `max` rows, so one flat's family list is never split across two calls.
 */
export function chunkByFlat(rows: MemberRow[], max = MAX_IMPORT_ROWS): MemberRow[][] {
  const groups = new Map<string, MemberRow[]>();
  for (const r of rows) {
    const g = groups.get(flatKey(r));
    if (g) g.push(r);
    else groups.set(flatKey(r), [r]);
  }
  const chunks: MemberRow[][] = [];
  let cur: MemberRow[] = [];
  for (const g of groups.values()) {
    if (g.length > max) throw new Error(`flat_too_many_rows:${g[0].building} ${g[0].wing} ${g[0].flat}`);
    if (cur.length + g.length > max) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(...g);
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** The request rows for one chunk (row N of the call = chunk[N - 1]). */
export function toRequestRows(chunk: MemberRow[]) {
  return chunk.map((r) => ({
    building: r.building,
    wing: r.wing,
    flat: r.flat,
    password: r.password,
    member_name: r.member_name,
    member_phone: r.member_phone,
    relation: r.relation,
  }));
}

export function mergeResults(chunks: MemberRow[][], outcomes: ChunkOutcome[]): ImportResultRow[] {
  const merged: ImportResultRow[] = [];
  chunks.forEach((chunk, ci) => {
    const outcome = outcomes[ci];
    const byRow = new Map('results' in outcome ? outcome.results.map((r) => [r.row, r]) : []);
    chunk.forEach((r, i) => {
      const res = byRow.get(i + 1);
      merged.push({
        line: r.line,
        building: r.building,
        wing: r.wing,
        flat: r.flat,
        ok: res?.ok ?? false,
        error: 'error' in outcome ? outcome.error : res ? res.error : 'no result returned',
        generatedPassword: res?.generated_password,
      });
    });
  });
  return merged.sort((a, b) => a.line - b.line);
}

/** CSV table (with header) of the passwords the server generated. */
export function generatedPasswords(results: ImportResultRow[]): string[][] {
  return [
    ['building', 'wing', 'flat', 'password'],
    ...results.filter((r) => r.generatedPassword).map((r) => [r.building, r.wing, r.flat, r.generatedPassword!]),
  ];
}
