import { shouldShowCallButton, type Database, type VisitStatus } from '@society-gate/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CallResident } from '@/components/CallResident';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Visit = Database['public']['Tables']['visits']['Row'];

const BANNER: Record<VisitStatus, { text: string; color: string }> = {
  pending: { text: 'Waiting', color: '#b45309' },
  approved: { text: 'Approved', color: '#15803d' },
  denied: { text: 'Denied', color: '#b91c1c' },
  leave_at_gate: { text: 'Leave at gate', color: '#1d4ed8' },
  expired: { text: 'No response', color: '#6b7280' },
};

const ACTION_ERRORS: Record<string, string> = {
  not_allowed_in: 'This visitor has not been approved to enter.',
  not_entered: 'This visitor has not entered yet.',
  already_responded: 'The resident already responded.',
  not_authorized: 'You are not allowed to do that.',
};

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [noAppUsers, setNoAppUsers] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load + Realtime updates for this row.
  useEffect(() => {
    let active = true;
    supabase
      .from('visits')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data, error: err }) => {
        if (!active) return;
        if (err) return setError(err.message);
        // Keep a newer Realtime row if one already arrived.
        setVisit((cur) => cur ?? data);
        const r = await supabase.rpc('visit_has_app_users', { p_flat_id: data.flat_id });
        if (active && !r.error) setNoAppUsers(!r.data);
      });
    const channel = supabase
      .channel(`visit-${id}`)
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

  // Re-evaluate the "call resident" button every second.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function run(action: () => PromiseLike<{ data: Visit | null; error: { message: string } | null }>) {
    setError(null);
    setBusy(true);
    const { data, error: err } = await action();
    setBusy(false);
    if (err) setError(ACTION_ERRORS[err.message] ?? err.message);
    else if (data) setVisit(data);
  }

  if (!visit) {
    return (
      <View style={ui.screen}>{error ? <Text style={ui.error}>{error}</Text> : <ActivityIndicator />}</View>
    );
  }

  const banner = BANNER[visit.status];
  const showCall = shouldShowCallButton(
    { status: visit.status, created_at: visit.created_at, no_app_users: noAppUsers },
    now,
  );
  const canDecide = (visit.status === 'pending' || visit.status === 'expired') && !visit.manual_outcome;
  const mayEnter = visit.status === 'approved' || visit.manual_outcome === 'allowed';

  return (
    <ScrollView contentContainerStyle={[ui.screen, { justifyContent: 'flex-start' }]}>
      <View style={{ backgroundColor: banner.color, borderRadius: 12, padding: 28, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>{banner.text}</Text>
      </View>
      <Text style={ui.title}>{visit.name}</Text>
      <Text style={ui.body}>
        {visit.purpose}
        {visit.manual_outcome ? ` · guard: ${visit.manual_outcome === 'allowed' ? 'allowed' : 'sent back'}` : ''}
      </Text>

      <CallResident flatId={visit.flat_id} visible={showCall} noAppUsers={noAppUsers} />

      {canDecide ? (
        <>
          <Pressable
            style={[ui.button, busy && ui.buttonDisabled]}
            disabled={busy}
            onPress={() =>
              run(() => supabase.rpc('record_manual_outcome', { p_visit_id: visit.id, p_outcome: 'allowed' }))
            }
          >
            <Text style={ui.buttonText}>Allow</Text>
          </Pressable>
          <Pressable
            style={[ui.button, { backgroundColor: '#b91c1c' }, busy && ui.buttonDisabled]}
            disabled={busy}
            onPress={() =>
              run(() => supabase.rpc('record_manual_outcome', { p_visit_id: visit.id, p_outcome: 'sent_back' }))
            }
          >
            <Text style={ui.buttonText}>Send back</Text>
          </Pressable>
        </>
      ) : null}

      {mayEnter && !visit.entry_at ? (
        <Pressable
          style={[ui.button, busy && ui.buttonDisabled]}
          disabled={busy}
          onPress={() => run(() => supabase.rpc('mark_entry', { p_visit_id: visit.id }))}
        >
          <Text style={ui.buttonText}>Mark entry</Text>
        </Pressable>
      ) : null}
      {visit.entry_at && !visit.exit_at ? (
        <Pressable
          style={[ui.button, busy && ui.buttonDisabled]}
          disabled={busy}
          onPress={() => run(() => supabase.rpc('mark_exit', { p_visit_id: visit.id }))}
        >
          <Text style={ui.buttonText}>Mark exit</Text>
        </Pressable>
      ) : null}
      {visit.exit_at ? <Text style={ui.body}>Exited</Text> : null}

      {error ? <Text style={ui.error}>{error}</Text> : null}
    </ScrollView>
  );
}
