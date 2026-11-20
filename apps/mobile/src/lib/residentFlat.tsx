import { flatLabel, RESIDENT_FLATS_SELECT } from '@society-gate/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { radius, space, type, useTheme } from '@/theme/tokens';

import { supabase } from './supabase';

/** A flat the signed-in account belongs to. `label` is like "B1-A-101". */
export type MyFlat = { id: string; label: string; societyId: string };

type Ctx = {
  flats: MyFlat[];
  flat: MyFlat | null;
  setFlatId: (id: string) => void;
  /** The signed-in user's id (the flat account). */
  userId: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const ResidentFlatContext = createContext<Ctx>({
  flats: [],
  flat: null,
  setFlatId: () => {},
  userId: null,
  loading: true,
  error: null,
  reload: () => {},
});

/** Loads the signed-in account's own flats (always filtered by profile_id). */
export function ResidentFlatProvider({ children }: { children: ReactNode }) {
  const [flats, setFlats] = useState<MyFlat[]>([]);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? null;
      if (!active) return;
      setUserId(uid);
      if (!uid) {
        setError('Not signed in');
        setLoading(false);
        return;
      }
      const { data, error: err } = await supabase
        .from('flat_residents')
        .select(RESIDENT_FLATS_SELECT)
        .eq('profile_id', uid)
        .order('created_at');
      if (!active) return;
      if (err) setError(err.message);
      else {
        const rows = (data ?? []).filter((r) => r.flats);
        const mapped = rows.map((r) => {
          const f = r.flats!;
          return {
            id: r.flat_id,
            societyId: f.society_id,
            label: f.towers ? flatLabel(f.towers.building, f.towers.name, f.number) : f.number,
          };
        });
        setFlats(mapped);
        setFlatId((cur) => (cur && mapped.some((m) => m.id === cur) ? cur : (mapped[0]?.id ?? null)));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  const flat = flats.find((f) => f.id === flatId) ?? null;
  return (
    <ResidentFlatContext.Provider value={{ flats, flat, setFlatId, userId, loading, error, reload }}>
      {children}
    </ResidentFlatContext.Provider>
  );
}

export function useResidentFlat(): Ctx {
  return useContext(ResidentFlatContext);
}

/** Segmented chips to switch flats. Renders nothing unless there is more than one. */
export function FlatSwitcher() {
  const { colors } = useTheme();
  const { flats, flat, setFlatId } = useResidentFlat();
  if (flats.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {flats.map((f) => {
        const active = f.id === flat?.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => setFlatId(f.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
            }}>
            <Text style={[type.label, { color: active ? colors.onPrimary : colors.text }]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
