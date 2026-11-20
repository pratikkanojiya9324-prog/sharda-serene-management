import { shouldShowCallButton, type VisitStatus } from '@society-gate/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { CallResident } from '@/components/CallResident';
import { guardErrorText } from '@/lib/guardErrors';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';
import { useLiveVisit } from '@/lib/useLiveVisit';
import type { Visit } from '@/lib/visitMerge';

const BANNER: Record<VisitStatus, { text: string; color: string }> = {
  pending: { text: 'Waiting', color: '#b45309' },
  approved: { text: 'Approved', color: '#15803d' },
  denied: { text: 'Denied', color: '#b91c1c' },
  leave_at_gate: { text: 'Leave at gate', color: '#1d4ed8' },
  expired: { text: 'No response', color: '#6b7280' },
};


const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function VisitScreen() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  // Realtime + re-fetch on (re)subscribe / foreground + 4 s poll while waiting.
  const { visit, error: loadError, applyVisit } = useLiveVisit(id, { pollWhilePending: true });
  const [noAppUsers, setNoAppUsers] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatId = visit?.flat_id ?? null;
  useEffect(() => {
    if (!flatId) return;
    let active = true;
    supabase.rpc('visit_has_app_users', { p_flat_id: flatId }).then((r) => {
      if (active && !r.error) setNoAppUsers(!r.data);
    });
    return () => {
      active = false;
    };
  }, [flatId]);

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
    if (err) setError(guardErrorText(err.message));
    else if (data) applyVisit(data);
  }

  if (!visit) {
    return (
      <View style={ui.screen}>
        {loadError ? (
          <Text style={ui.error}>
            {loadError.code === 'PGRST116' ? 'This visit was not found.' : guardErrorText(loadError.message)}
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
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

      {photo === 'failed' && !visit.photo_path ? (
        <Text style={ui.error}>Photo not saved. The resident was still notified.</Text>
      ) : null}

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
      {visit.entry_at ? (
        <Text style={ui.body}>
          Entered {time(visit.entry_at)}
          {visit.exit_at ? ` · Exited ${time(visit.exit_at)}` : ''}
        </Text>
      ) : null}

      {error ? <Text style={ui.error}>{error}</Text> : null}
    </ScrollView>
  );
}
