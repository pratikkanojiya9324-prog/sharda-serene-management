import type { Database } from '@society-gate/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { friendlyError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Visit = Database['public']['Tables']['visits']['Row'];
const PAGE = 30;

export default function HistoryScreen() {
  const router = useRouter();
  const { flat } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!flatId) return;
      const { data, error: err } = await supabase
        .from('visits')
        .select('*')
        .eq('flat_id', flatId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (err) return setError(friendlyError(err.message));
      setError(null);
      const rows = data ?? [];
      setVisits((cur) => (offset === 0 ? rows : [...cur, ...rows]));
      setHasMore(rows.length === PAGE);
    },
    [flatId],
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage(0);
    }, [fetchPage]),
  );

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10, backgroundColor: '#fff' }}
      data={visits}
      keyExtractor={(v) => v.id}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <FlatSwitcher />
          {error ? <Text style={ui.error}>{error}</Text> : null}
          {!visits.length && !error ? <Text style={ui.body}>No visitors yet</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/(resident)/request/[id]', params: { id: item.id } })}
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14 }}
        >
          <Text style={[ui.body, { fontWeight: '700' }]}>
            {item.name}
            {item.pass_id ? ' (pass)' : ''}
          </Text>
          <Text style={ui.body}>
            {item.purpose} · {item.status.replace(/_/g, ' ')} · {new Date(item.created_at).toLocaleString()}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        hasMore ? (
          <Pressable style={ui.secondary} onPress={() => fetchPage(visits.length)}>
            <Text style={ui.secondaryText}>Load more</Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}
