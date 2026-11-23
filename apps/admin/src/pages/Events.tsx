import { useCallback, useEffect, useState } from 'react';
import { EVENT_SELECT } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Table, Textarea, td, th } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { dateTime } from '../lib/format';
import { istLocalToIso } from '../lib/ist';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  place: string | null;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
}

interface Rsvp {
  flat_label: string;
  response: 'going' | 'maybe' | 'no';
  heads: number | null;
  by_name: string | null;
}

interface Summary {
  going_flats: number;
  going_heads: number;
  maybe_flats: number;
  maybe_heads: number;
  no_flats: number;
  rsvps: Rsvp[] | null;
}

const RESPONSE = { going: 'Going', maybe: 'Maybe', no: 'Not going' } as const;

export default function Events() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('starts_at', { ascending: false });
    if (err) return setError(err.message);
    setError(null);
    const rows = (data ?? []) as EventRow[];
    setEvents(rows);
    setSelected((cur) => (cur ? (rows.find((e) => e.id === cur.id) ?? null) : null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Society events residents can RSVP to from the app."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New event
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {events && events.length === 0 ? (
        <Card>
          <EmptyState icon="clock" title="No events yet">Create the first one and residents get a notification.</EmptyState>
        </Card>
      ) : (
        events && (
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>Event</th>
                  <th className={th}>Starts</th>
                  <th className={th}>Place</th>
                  <th className={th}>Status</th>
                </tr>
              }
            >
              {events.map((ev) => {
                const over = !ev.cancelled_at && new Date(ev.ends_at ?? ev.starts_at).getTime() < Date.now();
                return (
                  <tr key={ev.id} onClick={() => setSelected(ev)} className="cursor-pointer hover:bg-slate-50">
                    <td className={`${td} max-w-md font-medium text-slate-900`}>{ev.title}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{dateTime(ev.starts_at)}</td>
                    <td className={`${td} text-slate-600`}>{ev.place ?? '—'}</td>
                    <td className={td}>
                      <Pill tone={ev.cancelled_at ? 'red' : over ? 'slate' : 'green'}>{ev.cancelled_at ? 'Cancelled' : over ? 'Over' : 'Upcoming'}</Pill>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        )
      )}

      <CreateEventModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          toast('success', 'Event created');
          setCreating(false);
          void load();
        }}
      />
      {selected && <EventPanel event={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />}
    </>
  );
}

function EventPanel({ event, onClose, onChanged }: { event: EventRow; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { id: eventId, cancelled_at: cancelledAt } = event;

  useEffect(() => {
    let live = true;
    setSummary(null);
    setFailed(false);
    void supabase.rpc('event_summary', { p_event_id: eventId }).then(({ data, error }) => {
      if (!live) return;
      if (error || !data) return setFailed(true);
      setSummary(data as unknown as Summary);
    });
    return () => {
      live = false;
    };
  }, [eventId, cancelledAt]);

  async function cancel() {
    setBusy(true);
    const { error } = await supabase.rpc('cancel_event', { p_id: eventId });
    setBusy(false);
    setConfirming(false);
    if (error) return toast('error', friendlyError(error));
    toast('success', 'Event cancelled');
    onChanged();
  }

  return (
    <>
      <Modal
        open
        wide
        title={event.title}
        onClose={onClose}
        footer={
          !event.cancelled_at && (
            <Button variant="danger" icon="ban" onClick={() => setConfirming(true)}>
              Cancel event
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {event.cancelled_at && <Pill tone="red">Cancelled</Pill>}
            <span>
              {dateTime(event.starts_at)}
              {event.ends_at ? ` – ${dateTime(event.ends_at)}` : ''}
            </span>
            {event.place && <span>· {event.place}</span>}
          </div>
          {event.description && <p className="text-sm whitespace-pre-line text-slate-600">{event.description}</p>}
          {failed && <p className="text-sm text-red-600">Could not load the RSVPs. Close this and try again.</p>}
          {summary && (
            <>
              <p className="text-sm font-medium text-slate-800">
                Going: {summary.going_flats} flats ({summary.going_heads} people) · Maybe: {summary.maybe_flats} flats ({summary.maybe_heads} people) · Not
                going: {summary.no_flats} flats
              </p>
              {summary.rsvps && summary.rsvps.length === 0 ? (
                <p className="text-sm text-slate-500">No RSVPs yet.</p>
              ) : (
                summary.rsvps && (
                  <Table
                    head={
                      <tr>
                        <th className={th}>Flat</th>
                        <th className={th}>Response</th>
                        <th className={th}>People</th>
                        <th className={th}>By</th>
                      </tr>
                    }
                  >
                    {summary.rsvps.map((r) => (
                      <tr key={r.flat_label}>
                        <td className={`${td} font-medium text-slate-900`}>{r.flat_label}</td>
                        <td className={td}>
                          <Pill tone={r.response === 'going' ? 'green' : r.response === 'maybe' ? 'amber' : 'slate'}>{RESPONSE[r.response] ?? r.response}</Pill>
                        </td>
                        <td className={`${td} text-slate-600`}>{r.response === 'no' ? '—' : (r.heads ?? '—')}</td>
                        <td className={`${td} text-slate-600`}>{r.by_name ?? '—'}</td>
                      </tr>
                    ))}
                  </Table>
                )
              )}
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirming}
        title="Cancel event"
        message={
          <>
            Cancel <strong>{event.title}</strong>? Residents will see that it is cancelled.
          </>
        }
        confirmLabel="Cancel event"
        danger
        busy={busy}
        onConfirm={() => void cancel()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

function CreateEventModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPlace('');
    setStartsAt('');
    setEndsAt('');
    setError(null);
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setError(friendlyError('invalid_title'));
    const start = istLocalToIso(startsAt);
    const end = endsAt ? istLocalToIso(endsAt) : null;
    if (!start || (endsAt && !end) || (end && end <= start)) return setError(friendlyError('invalid_time'));
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('create_event', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_place: place.trim(),
      p_starts_at: start,
      p_ends_at: end as unknown as string, // null = no end time
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onCreated();
  }

  return (
    <Modal
      open={open}
      title="New event"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-event" type="submit" icon="check" busy={busy}>
            Create event
          </Button>
        </>
      }
    >
      <form id="create-event" onSubmit={save} className="space-y-4">
        <Field label="Title">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali get-together" autoFocus />
        </Field>
        <Field label="Details (optional)">
          <Textarea rows={4} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Place (optional)">
          <Input value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Clubhouse lawn" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts (IST)">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
