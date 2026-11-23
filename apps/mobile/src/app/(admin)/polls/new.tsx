import Ionicons from '@expo/vector-icons/Ionicons';
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Chips } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { reportError } from '@/lib/errors';
import { formatIst } from '@/lib/ist';
import { closesAtForDays } from '@/lib/polls';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const DAY_CHOICES = [1, 3, 7, 14];

export default function NewPollScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyName } = useAdminSociety();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multi, setMulti] = useState(false);
  const [maxChoices, setMaxChoices] = useState(2);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A fast double tap fires twice before `busy` re-renders: create only once.
  const inFlight = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/polls'));
  const labels = options.map((o) => o.trim()).filter(Boolean);
  // A multi-choice poll can allow at most as many picks as there are options.
  const maxLimit = Math.max(1, labels.length);
  const effectiveMax = Math.min(Math.max(maxChoices, 1), maxLimit);
  const closesAt = closesAtForDays(days, new Date());

  const setOption = (i: number, v: string) => setOptions((cur) => cur.map((o, j) => (j === i ? v : o)));

  async function create() {
    if (inFlight.current) return;
    if (!question.trim()) return setError('Enter the question');
    if (labels.length < POLL_MIN_OPTIONS || labels.length > POLL_MAX_OPTIONS) return setError('Add 2 to 6 options');
    if (multi && labels.length < 2) return setError('Add 2 to 6 options');
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      // Blank option boxes are dropped, so the poll gets only the filled ones.
      const { error: err } = await supabase.rpc('create_poll', {
        p_question: question.trim(),
        p_description: description.trim(),
        p_options: labels,
        p_multi: multi,
        p_max_choices: multi ? effectiveMax : 1,
        p_closes_at: closesAtForDays(days, new Date()).toISOString(),
      });
      if (err) return setError(reportError(err));
      router.replace('/(admin)/polls');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <Screen scroll>
      <Header overline={societyName ?? 'Admin'} title="New poll" subtitle="Residents get a notification" onBack={back} />

      <Card style={{ gap: space.lg }}>
        <Input
          label="Question"
          placeholder="e.g. Should we repaint the lobby?"
          value={question}
          onChangeText={setQuestion}
          maxLength={200}
          icon="help-circle-outline"
        />
        <Input
          label="Details (optional)"
          placeholder="Anything residents should know before voting"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={[type.heading, { color: colors.text }]}>Options</Text>
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder={`Option ${i + 1}`}
                accessibilityLabel={`Option ${i + 1}`}
                value={o}
                onChangeText={(v) => setOption(i, v)}
                maxLength={80}
              />
            </View>
            {i >= POLL_MIN_OPTIONS ? (
              <Pressable
                onPress={() => setOptions((cur) => cur.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${i + 1}`}
                hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {options.length < POLL_MAX_OPTIONS ? (
          <Button title="Add option" icon="add" variant="ghost" onPress={() => setOptions((cur) => [...cur, ''])} />
        ) : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: colors.text }]}>Multiple choice</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>Let a flat pick more than one option</Text>
          </View>
          <Switch
            value={multi}
            onValueChange={setMulti}
            accessibilityLabel="Multiple choice"
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
        {multi ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>Most options a flat can pick</Text>
            <Stepper
              value={effectiveMax}
              min={1}
              max={maxLimit}
              onChange={setMaxChoices}
            />
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={[type.heading, { color: colors.text }]}>Voting closes in</Text>
        <Chips
          options={DAY_CHOICES.map((d) => ({ value: String(d), label: d === 1 ? '1 day' : `${d} days` }))}
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
        />
        <Text style={[type.caption, { color: colors.textMuted }]}>Closes {formatIst(closesAt.toISOString())}</Text>
      </Card>

      {error ? <Banner text={error} /> : null}
      <Button title="Start poll" icon="stats-chart" loading={busy} onPress={create} />
    </Screen>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { colors } = useTheme();
  const btn = (icon: 'remove' | 'add', next: number, off: boolean, label: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.4 : 1,
      }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {btn('remove', value - 1, value <= min, 'Fewer choices')}
      <Text style={[type.heading, { color: colors.text, minWidth: 20, textAlign: 'center' }]}>{value}</Text>
      {btn('add', value + 1, value >= max, 'More choices')}
    </View>
  );
}
