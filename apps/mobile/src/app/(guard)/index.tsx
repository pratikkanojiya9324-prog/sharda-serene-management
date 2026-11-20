import { GUARD_TODAY_VISITS_SELECT } from '@society-gate/shared';
import type { QueryData } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useGuardSociety } from '@/lib/guardSociety';
import { signOut } from '@/lib/signOut';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

function todayVisits(societyId: string, since: string) {
  return supabase
    .from('visits')
    .select(GUARD_TODAY_VISITS_SELECT)
    .eq('society_id', societyId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
}
type Row = QueryData<ReturnType<typeof todayVisits>>[number];

export default function GuardHome() {
  const router = useRouter();
  const { societyId, error: societyError } = useGuardSociety();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error: err } = await todayVisits(societyId, startOfDay.toISOString());
    if (err) setError(err.message);
    else setRows(data ?? []);
  }, [societyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Keep the list fresh while the screen is mounted.
  useEffect(() => {
    if (!societyId) return;
    const channel = supabase
      .channel(`visits-${societyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `society_id=eq.${societyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId, load]);

  return (
    <View style={[ui.screen, { justifyContent: 'flex-start' }]}>
      <Pressable style={ui.button} onPress={() => router.push('/new-visit')}>
        <Text style={ui.buttonText}>New visitor</Text>
      </Pressable>
      <Pressable style={[ui.button, { backgroundColor: '#374151' }]} onPress={() => router.push('/pass')}>
        <Text style={ui.buttonText}>Enter pass code</Text>
      </Pressable>
      {societyError || error ? <Text style={ui.error}>{societyError ?? error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={ui.body}>No visitors yet today.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}
            onPress={() => router.push({ pathname: '/visit/[id]', params: { id: item.id } })}
          >
            <Text style={ui.body}>
              {item.name} — {item.flats?.towers?.name} {item.flats?.number}
            </Text>
            <Text style={ui.secondaryText}>
              {item.status.replace(/_/g, ' ')} · {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={ui.secondary} onPress={() => signOut()}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
