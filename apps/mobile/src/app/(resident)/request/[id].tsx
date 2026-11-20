import type { Database } from '@society-gate/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';
import { useVisitPhoto } from '@/lib/useVisitPhoto';

type Visit = Database['public']['Tables']['visits']['Row'];
type Response = 'approved' | 'denied' | 'leave_at_gate';

const RESULT: Record<string, string> = {
  approved: 'You approved this visitor',
  denied: 'You denied this visitor',
  leave_at_gate: 'Visitor asked to leave it at the gate',
  expired: 'This request expired — the guard will call you',
};

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoUrl = useVisitPhoto(visit?.photo_path);

  useEffect(() => {
    let active = true;
    supabase
      .from('visits')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(friendlyError(err.code === 'PGRST116' ? 'not_authorized' : err.message));
        else setVisit((cur) => cur ?? data);
      });
    const channel = supabase
      .channel(`resident-visit-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits', filter: `id=eq.${id}` },
        (payload) => setVisit(payload.new as Visit),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function respond(response: Response) {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc('respond_to_visit', {
      p_visit_id: id,
      p_response: response,
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      // Refresh so the screen shows the answer that won.
      const fresh = await supabase.from('visits').select('*').eq('id', id).single();
      if (fresh.data) setVisit(fresh.data);
    } else if (data) setVisit(data);
  }

  if (!visit) {
    return <View style={ui.screen}>{error ? <Text style={ui.error}>{error}</Text> : <ActivityIndicator />}</View>;
  }

  const open = visit.status === 'pending';
  return (
    <ScrollView contentContainerStyle={[ui.screen, { justifyContent: 'flex-start' }]}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 260, borderRadius: 12 }} resizeMode="cover" />
      ) : null}
      <Text style={ui.title}>{visit.name}</Text>
      <Text style={ui.body}>
        {visit.purpose} · {new Date(visit.created_at).toLocaleString()}
      </Text>

      {open ? (
        <>
          <BigButton label="Approve" color="#15803d" disabled={busy} onPress={() => respond('approved')} />
          <BigButton label="Deny" color="#b91c1c" disabled={busy} onPress={() => respond('denied')} />
          <BigButton label="Leave at gate" color="#1d4ed8" disabled={busy} onPress={() => respond('leave_at_gate')} />
        </>
      ) : (
        <Text style={[ui.title, { fontSize: 20 }]}>{RESULT[visit.status] ?? visit.status}</Text>
      )}
      {error ? <Text style={ui.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function BigButton(props: { label: string; color: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[ui.button, { backgroundColor: props.color, paddingVertical: 22 }, props.disabled && ui.buttonDisabled]}
      disabled={props.disabled}
      onPress={props.onPress}
    >
      <Text style={[ui.buttonText, { fontSize: 22 }]}>{props.label}</Text>
    </Pressable>
  );
}
