import type { Database } from '@society-gate/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Visit = Database['public']['Tables']['visits']['Row'];

export default function ResidentHome() {
  const router = useRouter();
  const { flat, loading, error: flatError } = useResidentFlat();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('visits')
      .select('*')
      .eq('flat_id', flatId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (err) setError(err.message);
    else {
      setError(null);
      setVisits(data ?? []);
    }
  }, [flatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // New / changed requests for this flat appear without pull-to-refresh.
  useEffect(() => {
    if (!flatId) return;
    const channel = supabase
      .channel(`resident-visits-${flatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `flat_id=eq.${flatId}` },
        (payload) => {
          const row = payload.new as Visit;
          setVisits((cur) => {
            const rest = cur.filter((v) => v.id !== row.id);
            return [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [flatId]);

  if (loading) {
    return (
      <View style={ui.screen}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!flat) {
    return (
      <View style={ui.screen}>
        <Text style={ui.body}>{flatError ?? 'No flat is linked to your account yet. Ask your admin.'}</Text>
        <Pressable style={ui.secondary} onPress={() => supabase.auth.signOut()}>
          <Text style={ui.secondaryText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const pending = visits.filter((v) => v.status === 'pending');
  const recent = visits.filter((v) => v.status !== 'pending').slice(0, 10);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10, backgroundColor: '#fff' }}
      data={[...pending, ...recent]}
      keyExtractor={(v) => v.id}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 8 }}>
          <Text style={ui.title}>Flat {flat.label}</Text>
          <FlatSwitcher />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <NavButton label="Passes" onPress={() => router.push('/(resident)/passes')} />
            <NavButton label="Household" onPress={() => router.push('/(resident)/household')} />
            <NavButton label="History" onPress={() => router.push('/(resident)/history')} />
          </View>
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <Text style={[ui.body, { fontWeight: '700' }]}>
            {pending.length ? `Waiting for you (${pending.length})` : 'No pending requests'}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isPending = item.status === 'pending';
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/(resident)/request/[id]', params: { id: item.id } })}
            style={{
              borderWidth: 1,
              borderColor: isPending ? '#b45309' : '#ddd',
              backgroundColor: isPending ? '#fffbeb' : '#fff',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <Text style={[ui.body, { fontWeight: '700' }]}>{item.name}</Text>
            <Text style={ui.body}>
              {item.purpose} · {isPending ? 'tap to respond' : item.status.replace(/_/g, ' ')} ·{' '}
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <Pressable style={ui.secondary} onPress={() => supabase.auth.signOut()}>
          <Text style={ui.secondaryText}>Sign out</Text>
        </Pressable>
      }
    />
  );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={[ui.button, { paddingHorizontal: 18 }]} onPress={onPress}>
      <Text style={ui.buttonText}>{label}</Text>
    </Pressable>
  );
}
