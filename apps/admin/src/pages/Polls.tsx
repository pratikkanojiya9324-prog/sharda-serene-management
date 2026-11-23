import { useCallback, useEffect, useState } from 'react';
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_SELECT } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Table, Textarea, td, th } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { dateTime } from '../lib/format';
import { istLocalToIso } from '../lib/ist';
import { defaultClosesAt, resultRows, turnoutText, type PollOption } from '../lib/polls';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Poll {
  id: string;
  question: string;
  description: string | null;
  options: unknown;
  multi: boolean;
  max_choices: number;
  closes_at: string;
  closed_at: string | null;
  created_at: string;
  last_reminded_at: string | null;
}

interface Results {
  counts: Record<string, number> | null;
  voted: number;
  total: number;
  notVoted: string[];
}

function parseOptions(value: unknown): PollOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o) => {
    const { id, label } = (o ?? {}) as { id?: unknown; label?: unknown };
    return typeof id === 'string' && typeof label === 'string' ? [{ id, label }] : [];
  });
}

function parseResults(value: unknown): Results | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  return {
    counts: r.counts && typeof r.counts === 'object' ? (r.counts as Record<string, number>) : null,
    voted: Number(r.voted_flats ?? 0),
    total: Number(r.total_flats ?? 0),
    notVoted: Array.isArray(r.not_voted) ? (r.not_voted as string[]) : [],
  };
}

const isOpen = (p: Poll) => p.closed_at === null && Date.now() < new Date(p.closes_at).getTime();

async function fetchResults(pollId: string): Promise<Results | null> {
  const { data, error } = await supabase.rpc('poll_results', { p_poll_id: pollId });
  return error ? null : parseResults(data);
}

export default function Polls() {
  const toast = useToast();
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [turnout, setTurnout] = useState<Record<string, Results | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Poll | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('polls')
      .select(POLL_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('created_at', { ascending: false });
    if (err) return setError(err.message);
    setError(null);
    const rows = (data ?? []) as Poll[];
    setPolls(rows);
    // One failed turnout call must not fail the page: that row shows a dash.
    const entries = await Promise.all(rows.map(async (p) => [p.id, await fetchResults(p.id)] as const));
    setTurnout(Object.fromEntries(entries));
    setSelected((cur) => (cur ? (rows.find((p) => p.id === cur.id) ?? null) : null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Polls"
        subtitle="Ask the whole society a question. Each flat votes once and choices stay secret."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New poll
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {polls && polls.length === 0 ? (
        <Card>
          <EmptyState icon="clipboard" title="No polls yet">Create the first one and residents get a notification.</EmptyState>
        </Card>
      ) : (
        polls && (
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>Question</th>
                  <th className={th}>Status</th>
                  <th className={th}>Closes</th>
                  <th className={th}>Turnout</th>
                </tr>
              }
            >
              {polls.map((p) => {
                const t = turnout[p.id];
                return (
                  <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer hover:bg-slate-50">
                    <td className={`${td} max-w-md font-medium text-slate-900`}>{p.question}</td>
                    <td className={td}>
                      <Pill tone={isOpen(p) ? 'green' : 'slate'}>{isOpen(p) ? 'Open' : 'Closed'}</Pill>
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{dateTime(p.closes_at)}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{t ? turnoutText(t.voted, t.total) : '—'}</td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        )
      )}

      <CreatePollModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          toast('success', 'Poll created');
          setCreating(false);
          void load();
        }}
      />
      {selected && <PollPanel poll={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </>
  );
}

function PollPanel({ poll, onClose, onChanged }: { poll: Poll; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [results, setResults] = useState<Results | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'remind' | 'close' | 'delete' | null>(null);
  const { id: pollId, closed_at: closedAt } = poll;

  useEffect(() => {
    let live = true;
    setResults(null);
    setFailed(false);
    void fetchResults(pollId).then((r) => {
      if (!live) return;
      setResults(r);
      setFailed(!r);
    });
    return () => {
      live = false;
    };
  }, [pollId, closedAt]);

  const open = isOpen(poll);
  const rows = resultRows(parseOptions(poll.options), results?.counts ?? null, results?.voted ?? 0);

  async function run(kind: 'remind' | 'close' | 'delete', rpc: 'remind_poll' | 'close_poll' | 'delete_poll', done: string) {
    setBusy(kind);
    const { error } = await supabase.rpc(rpc, { p_poll_id: pollId });
    setBusy(null);
    if (error) return toast('error', friendlyError(error));
    toast('success', done);
    if (kind === 'delete') onClose();
    onChanged();
  }

  return (
    <Modal
      open
      wide
      title={poll.question}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            icon="trash"
            className="mr-auto text-red-600 hover:bg-red-50"
            busy={busy === 'delete'}
            onClick={() => {
              if (confirm('Delete this poll and all its votes? This cannot be undone.')) void run('delete', 'delete_poll', 'Poll deleted');
            }}
          >
            Delete
          </Button>
          {open && (
            <>
              <Button
                variant="secondary"
                icon="megaphone"
                busy={busy === 'remind'}
                onClick={() => void run('remind', 'remind_poll', 'Reminder sent to flats that have not voted')}
              >
                Send reminder
              </Button>
              <Button
                icon="check"
                busy={busy === 'close'}
                onClick={() => {
                  if (confirm('Close voting now? Flats will no longer be able to vote.')) void run('close', 'close_poll', 'Voting closed');
                }}
              >
                Close voting
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Pill tone={open ? 'green' : 'slate'}>{open ? 'Open' : 'Closed'}</Pill>
          <span>{open ? `Closes ${dateTime(poll.closes_at)}` : `Closed ${dateTime(poll.closed_at ?? poll.closes_at)}`}</span>
          {poll.multi && <span>· Up to {poll.max_choices} choices</span>}
        </div>
        {poll.description && <p className="text-sm whitespace-pre-line text-slate-600">{poll.description}</p>}
        {failed && <p className="text-sm text-red-600">Could not load the results. Close this and try again.</p>}
        {results && (
          <>
            <p className="text-sm font-medium text-slate-800">{turnoutText(results.voted, results.total)}</p>
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-slate-800">{r.label}</span>
                    <span className="whitespace-nowrap text-slate-500">
                      {r.count} · {r.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-700" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">Not voted yet ({results.notVoted.length})</p>
              {results.notVoted.length === 0 ? (
                <p className="text-sm text-slate-500">Every flat has voted.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {results.notVoted.map((f) => (
                    <span key={f} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function CreatePollModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [maxChoices, setMaxChoices] = useState(2);
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuestion('');
    setDescription('');
    setOptions(['', '']);
    setMulti(false);
    setMaxChoices(2);
    setClosesAt(defaultClosesAt(new Date()));
    setError(null);
  }, [open]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const maxAllowed = Math.max(2, filled.length);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!question.trim()) return setError(friendlyError('invalid_question'));
    if (filled.length < POLL_MIN_OPTIONS || filled.length > POLL_MAX_OPTIONS || filled.some((o) => o.length > 80)) {
      return setError(friendlyError('invalid_options'));
    }
    const iso = istLocalToIso(closesAt);
    if (!iso) return setError(friendlyError('invalid_time'));
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_poll', {
      p_question: question.trim(),
      p_description: description.trim(),
      p_options: filled,
      p_multi: multi,
      p_max_choices: multi ? Math.min(Math.max(maxChoices, 1), filled.length) : 1,
      p_closes_at: iso,
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onCreated();
  }

  return (
    <Modal
      open={open}
      title="New poll"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-poll" type="submit" icon="check" busy={busy}>
            Create poll
          </Button>
        </>
      }
    >
      <form id="create-poll" onSubmit={save} className="space-y-4">
        <Field label="Question">
          <Input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Should we repaint the clubhouse?" autoFocus />
        </Field>
        <Field label="Details (optional)">
          <Textarea rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={`Options (${POLL_MIN_OPTIONS} to ${POLL_MAX_OPTIONS})`}>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setOptions((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {options.length > POLL_MIN_OPTIONS && (
                  <Button type="button" variant="ghost" icon="x" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((cur) => cur.filter((_, j) => j !== i))} />
                )}
              </div>
            ))}
            {options.length < POLL_MAX_OPTIONS && (
              <Button type="button" size="sm" variant="secondary" icon="plus" onClick={() => setOptions((cur) => [...cur, ''])}>
                Add option
              </Button>
            )}
          </div>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
            Multiple choice
          </label>
          {multi && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Max choices
              <Input
                type="number"
                min={1}
                max={maxAllowed}
                value={maxChoices}
                className="w-20"
                onChange={(e) => setMaxChoices(Math.min(maxAllowed, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
          )}
        </div>
        <Field label="Voting closes (IST)">
          <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
