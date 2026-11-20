// Reads every row of a query by paging with .range(), so lists are never silently
// cut off at PostgREST's row cap (max_rows, 1000 in supabase/config.toml and the
// hosted default). pageSize must not exceed that cap: a page shorter than
// pageSize is taken to mean "no more rows". Callers must order by a unique
// column (e.g. id) so pages do not overlap or skip rows.

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: [], error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return { data: all, error: null };
  }
}
