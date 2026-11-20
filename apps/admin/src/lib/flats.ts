// Flat labels ("B1-A-101") for the admin pages, loaded once per page.
import { useCallback, useEffect, useState } from 'react';
import { flatLabel } from '@society-gate/shared';
import { ADMIN_FLAT_LABELS_SELECT } from './selects';
import { SOCIETY_ID, supabase } from './supabase';

export interface FlatInfo {
  id: string;
  building: string;
  wing: string;
  number: string;
  label: string;
}

/** Lookup key used by CSV uploads (building already normalised, wing upper-case). */
export const flatKey = (building: string, wing: string, number: string) => `${building}|${wing}|${number}`;

export function useFlats() {
  const [flats, setFlats] = useState<FlatInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('flats').select(ADMIN_FLAT_LABELS_SELECT).eq('society_id', SOCIETY_ID);
    setLoading(false);
    if (err) return setError(err.message);
    setError(null);
    setFlats(
      (data ?? [])
        .map((f) => {
          const building = f.towers?.building ?? '';
          const wing = f.towers?.name ?? '';
          return { id: f.id, building, wing, number: f.number, label: flatLabel(building, wing, f.number) };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byId = new Map(flats.map((f) => [f.id, f]));
  return { flats, byId, error, loading, reload };
}
