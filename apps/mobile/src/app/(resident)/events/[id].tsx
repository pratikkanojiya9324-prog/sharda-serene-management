import Ionicons from '@expo/vector-icons/Ionicons';
import { EVENT_SELECT } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chips, InfoRow, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { isUpcomingEvent, rsvpText } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { formatIst } from '@/lib/ist';
import { useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Response = 'going' | 'maybe' | 'no';
type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  place: string | null;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
};
type Summary = { going_flats: number; going_heads: number };

const RESPONSES: { value: Response; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Not going' },
];

const MAX_HEADS = 20;

function readSummary(value: unknown): Summary {
  const r = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return { going_flats: Number(r.going_flats ?? 0), going_heads: Number(r.going_heads ?? 0) };
}

export default function EventScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [summary, setSummary] = useState<Summary>({ going_flats: 0, going_heads: 0 });
  const [saved, setSaved] = useState<{ response: Response; heads: number } | null>(null);
  const [response, setResponse] = useState<Response | null>(null);
  const [heads, setHeads] = useState(1);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const touched = useRef(false);

  const load = useCallback(async () => {
    if (!flatId) return;
    const [e, s, r] = await Promise.all([
      supabase.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle(),
      supabase.rpc('event_summary', { p_event_id: id }),
      supabase.from('event_rsvps').select('response, heads').eq('event_id', id).eq('flat_id', flatId).maybeSingle(),
    ]);
    const err = e.error ?? r.error;
    if (err) {
      setError(reportError(err));
      return false;
    }
    if (!e.data) {
      setMissing(true);
      setError(null);
      return;
    }
    if (s.error) {
      setError(reportError(s.error));
      return false;
    }
    setError(null);
    setMissing(false);
    setEvent(e.data);
    setSummary(readSummary(s.data));
    const mine = r.data ? { response: r.data.response as Response, heads: Math.max(1, r.data.heads) } : null;
    setSaved(mine);
    // Keep an unsaved choice across refreshes; otherwise show what was saved.
    if (!touched.current) {
      setResponse(mine?.response ?? null);
      setHeads(mine?.heads ?? 1);
    }
  }, [id, flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/events'));

  async function save() {
    if (!event || !flatId || !response || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setSaveError(null);
    setNotice(null);
    try {
      const actor = await getActorName();
      const { error: err } = await supabase.rpc('rsvp_event', {
        p_event_id: event.id,
        p_flat_id: flatId,
        p_response: response,
        ...(response === 'no' ? {} : { p_heads: heads }),
        ...(actor ? { p_actor_name: actor } : {}),
      });
      if (err) {
        setSaveError(reportError(err));
        return;
      }
      touched.current = false;
      setNotice('Saved');
      await load();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!flat && !loading) {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const open = event ? !event.cancelled_at && isUpcomingEvent(event, new Date()) : false;
  const started = event ? new Date(event.starts_at).getTime() <= Date.now() : false;
  const canRsvp = !!event && !event.cancelled_at && !started;
  const dirty = !saved || saved.response !== response || (response !== 'no' && saved.heads !== heads);

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Event" onBack={back} />
      {error && loaded ? <Banner text={error} /> : null}
      {!loaded ? (
        loadFailure || error ? <Banner text={(error ?? loadFailure) as string} /> : <Loading />
      ) : missing || !event ? (
        <EmptyState icon="calendar-outline" title="Event not found" message="It may have been removed by the office." />
      ) : (
        <>
          <Card style={{ gap: space.md }}>
            {event.cancelled_at ? <Pill label="Cancelled" tone="danger" icon="close-circle" /> : null}
            {!event.cancelled_at && !open ? <Pill label="Over" tone="neutral" icon="checkmark-done" /> : null}
            <Text style={[type.title, { color: colors.text }]} selectable>
              {event.title}
            </Text>
            <InfoRow icon="time-outline" label="When" value={formatIst(event.starts_at)} />
            {event.place ? <InfoRow icon="location-outline" label="Where" value={event.place} /> : null}
            {event.description ? (
              <Text style={[type.body, { color: colors.text, lineHeight: 24 }]} selectable>
                {event.description}
              </Text>
            ) : null}
            <Text style={[type.label, { color: colors.primary }]}>{rsvpText(summary)}</Text>
          </Card>

          {canRsvp ? (
            <Card style={{ gap: space.md }}>
              <Text style={[type.heading, { color: colors.text }]}>Is your flat coming?</Text>
              <Chips
                options={RESPONSES}
                value={(response ?? '') as Response}
                onChange={(v) => {
                  touched.current = true;
                  setResponse(v);
                  setSaveError(null);
                  setNotice(null);
                }}
              />
              {response && response !== 'no' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>How many people?</Text>
                  <Stepper
                    value={heads}
                    onChange={(n) => {
                      touched.current = true;
                      setHeads(n);
                    }}
                  />
                </View>
              ) : null}
              {saveError ? <Banner text={saveError} /> : null}
              {notice ? <Banner text={notice} tone="success" icon="checkmark-circle" /> : null}
              <Button title="Save" icon="checkmark" loading={busy} disabled={!response || !dirty} onPress={save} />
            </Card>
          ) : saved && !event.cancelled_at ? (
            <Text style={[type.caption, { color: colors.textMuted }]}>
              Your flat answered: {RESPONSES.find((r) => r.value === saved.response)?.label}
              {saved.response === 'no' ? '' : ` (${saved.heads})`}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { colors } = useTheme();
  const btn = (icon: 'remove' | 'add', next: number, disabled: boolean, label: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? colors.surfaceMuted : colors.primarySoft,
      }}>
      <Ionicons name={icon} size={22} color={disabled ? colors.textSubtle : colors.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {btn('remove', value - 1, value <= 1, 'Fewer people')}
      <Text style={[type.heading, { color: colors.text, minWidth: 28, textAlign: 'center' }]}>{value}</Text>
      {btn('add', value + 1, value >= MAX_HEADS, 'More people')}
    </View>
  );
}
