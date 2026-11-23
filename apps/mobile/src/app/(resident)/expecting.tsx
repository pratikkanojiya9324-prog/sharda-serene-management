import { EXPECTED_HOURS, type ExpectedPurpose } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Chips, ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { activeExpectations, companiesFor, expectationLabel, PURPOSE_OPTIONS } from '@/lib/expecting';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { VISIT_PURPOSE } from '@/lib/status';
import { Banner, Button, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Expectation = {
  id: string;
  purpose: ExpectedPurpose;
  company: string | null;
  valid_to: string;
  cancelled_at: string | null;
};

const HOUR_OPTIONS = EXPECTED_HOURS.map((h) => ({ value: String(h), label: h === 1 ? '1 hour' : `${h} hours` }));

export default function ExpectingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [rows, setRows] = useState<Expectation[]>([]);
  const [purpose, setPurpose] = useState<ExpectedPurpose>('delivery');
  const [company, setCompany] = useState('');
  const [otherName, setOtherName] = useState('');
  const [hours, setHours] = useState('2');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('expected_entries')
      .select('id, purpose, company, valid_to, cancelled_at')
      .eq('flat_id', flatId)
      .is('cancelled_at', null)
      .gt('valid_to', new Date().toISOString())
      .order('valid_to');
    if (err) {
      setLoadError(reportError(err));
      return false;
    }
    setLoadError(null);
    setRows((data ?? []) as Expectation[]);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: hookError } = useFocusLoad(load, !!flatId);
  const listError = loadError ?? hookError;
  const state = screenState({ loaded, error: listError, needsFlat: true, flatLoading, hasFlat: !!flat });

  async function create() {
    if (!flatId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('create_expected_entry', {
        p_flat_id: flatId,
        p_purpose: purpose,
        // "Other" sends the typed name (blank = no company).
        p_company: company === 'Other' ? otherName.trim() : company,
        p_hours: Number(hours),
        p_actor_name: (await getActorName()) ?? undefined,
      });
      // A failed save keeps the choices so it can be retried.
      if (err) return setError(reportError(err));
      setCompany('');
      setOtherName('');
      load().catch((e: unknown) => console.warn('[expecting] reload failed', e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function cancel(id: string) {
    setError(null);
    const { error: err } = await supabase.rpc('cancel_expected_entry', { p_id: id });
    if (err) setError(reportError(err));
    else load().catch((e: unknown) => console.warn('[expecting] reload failed', e));
  }

  const companies = companiesFor(purpose);
  const active = activeExpectations(rows, new Date());

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        title="Expecting someone"
        subtitle="Matching visitors are let in without asking you"
        onBack={() => router.back()}
      />
      <FlatSwitcher />

      <Card>
        <Text style={[type.label, { color: colors.textMuted }]}>What are you expecting?</Text>
        <Chips
          options={PURPOSE_OPTIONS}
          value={purpose}
          onChange={(p) => {
            setPurpose(p);
            setCompany('');
            setOtherName('');
          }}
        />
        {companies.length ? (
          <>
            <Text style={[type.label, { color: colors.textMuted }]}>Which company? (optional)</Text>
            <Chips
              options={companies.map((c) => ({ value: c, label: c }))}
              value={company}
              onChange={(c) => setCompany(c === company ? '' : c)}
            />
            {company === 'Other' ? (
              <Input
                label="Company name (optional)"
                icon="business-outline"
                placeholder="e.g. Dunzo"
                value={otherName}
                onChangeText={setOtherName}
                maxLength={40}
              />
            ) : null}
          </>
        ) : null}
        <Text style={[type.label, { color: colors.textMuted }]}>Valid for</Text>
        <Chips options={HOUR_OPTIONS} value={hours} onChange={setHours} />
        {error ? <Banner text={error} /> : null}
        <Button title="Create" icon="add-circle" loading={busy} disabled={!flatId} onPress={create} />
      </Card>

      <SectionTitle title="Active" count={active.length || undefined} />
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={listError ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : (
        <>
          {listError ? <Banner text={listError} /> : null}
          {active.length ? (
            active.map((e) => (
              <Card key={e.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconBadge icon={VISIT_PURPOSE[e.purpose].icon} tone="accent" />
                  <Text style={[type.heading, { color: colors.text, flex: 1 }]}>{expectationLabel(e)}</Text>
                  <Button title="Cancel" variant="danger" onPress={() => cancel(e.id)} />
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="timer-outline"
              title="Nothing expected"
              message="Create one above and the guard will let the delivery, cab or guest in."
            />
          )}
        </>
      )}
    </Screen>
  );
}
