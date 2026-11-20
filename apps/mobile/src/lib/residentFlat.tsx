import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { supabase } from './supabase';
import { ui } from './ui';

export type MyFlat = { id: string; label: string };

type Ctx = {
  flats: MyFlat[];
  flat: MyFlat | null;
  setFlatId: (id: string) => void;
  loading: boolean;
  error: string | null;
};

const ResidentFlatContext = createContext<Ctx>({
  flats: [],
  flat: null,
  setFlatId: () => {},
  loading: true,
  error: null,
});

type FlatRow = { flat_id: string; flats: { number: string; towers: { name: string } | null } | null };

/** Loads the signed-in resident's own flats (always filtered by profile_id; RLS also shows co-residents). */
export function ResidentFlatProvider({ children }: { children: ReactNode }) {
  const [flats, setFlats] = useState<MyFlat[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (active) {
          setError('Not signed in');
          setLoading(false);
        }
        return;
      }
      const { data, error: err } = await supabase
        .from('flat_residents')
        .select('flat_id, flats(number, towers(name))')
        .eq('profile_id', userId)
        .order('created_at');
      if (!active) return;
      if (err) setError(err.message);
      else {
        const rows = (data ?? []) as unknown as FlatRow[];
        setFlats(
          rows.map((r) => ({
            id: r.flat_id,
            label: `${r.flats?.towers?.name ? `${r.flats.towers.name} ` : ''}${r.flats?.number ?? ''}`.trim() || 'Flat',
          })),
        );
        setFlatId(rows[0]?.flat_id ?? null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const flat = flats.find((f) => f.id === flatId) ?? null;
  return (
    <ResidentFlatContext.Provider value={{ flats, flat, setFlatId, loading, error }}>
      {children}
    </ResidentFlatContext.Provider>
  );
}

export function useResidentFlat(): Ctx {
  return useContext(ResidentFlatContext);
}

/** Renders nothing unless the resident has more than one flat. */
export function FlatSwitcher() {
  const { flats, flat, setFlatId } = useResidentFlat();
  if (flats.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {flats.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => setFlatId(f.id)}
          style={[ui.button, { paddingVertical: 8, paddingHorizontal: 14 }, f.id !== flat?.id && { backgroundColor: '#9ca3af' }]}
        >
          <Text style={ui.buttonText}>{f.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
