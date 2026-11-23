import { useCallback, useEffect, useMemo, useState } from 'react';
import { AMENITY_SELECT, BOOKING_SELECT, SLOT_MINUTES, flatLabel } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Select, Table, Tabs, Textarea, td, th, type Tone } from '../components/ui';
import { bookingTab, formatSlot, type BookingTab } from '../lib/community';
import { friendlyError } from '../lib/errors';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Amenity {
  id: string;
  name: string;
  description: string | null;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  requires_approval: boolean;
  max_upcoming: number;
  fee_note: string | null;
  active: boolean;
}

interface Booking {
  id: string;
  amenity_id: string;
  start_at: string;
  end_at: string;
  status: string;
  booked_by_name: string | null;
  reject_reason: string | null;
  amenities: { name: string } | null;
  flats: { number: string; towers: { building: string; name: string } | null } | null;
}

const BOOKINGS_LIMIT = 500;
const TABS: { value: BookingTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];
const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

const hhmm = (t: string) => t.slice(0, 5);
const slotLabel = (m: number) => (m === 1440 ? 'Full day' : m % 60 === 0 ? `${m / 60} h` : `${m} min`);

/** Every upsert_amenity argument from an existing amenity, with an optional change. */
function upsertArgs(a: Amenity, patch: Partial<Amenity> = {}) {
  const v = { ...a, ...patch };
  return {
    p_id: v.id,
    p_name: v.name,
    p_description: v.description ?? '',
    p_open_time: hhmm(v.open_time),
    p_close_time: hhmm(v.close_time),
    p_slot_minutes: v.slot_minutes,
    p_requires_approval: v.requires_approval,
    p_max_upcoming: v.max_upcoming,
    p_fee_note: v.fee_note ?? '',
    p_active: v.active,
  };
}

export default function Amenities() {
  const toast = useToast();
  const [amenities, setAmenities] = useState<Amenity[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Amenity | 'new' | null>(null);
  const [tab, setTab] = useState<BookingTab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('amenities').select(AMENITY_SELECT).eq('society_id', SOCIETY_ID).order('name'),
      supabase
        .from('amenity_bookings')
        .select(BOOKING_SELECT)
        .eq('society_id', SOCIETY_ID)
        .order('start_at', { ascending: false })
        .limit(BOOKINGS_LIMIT),
    ]);
    const err = a.error ?? b.error;
    if (err) return setError(err.message);
    setError(null);
    setAmenities((a.data ?? []) as unknown as Amenity[]);
    setBookings((b.data ?? []) as unknown as Booking[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(a: Amenity) {
    setBusyId(a.id);
    const { error: err } = await supabase.rpc('upsert_amenity', upsertArgs(a, { active: !a.active }));
    setBusyId(null);
    if (err) toast('error', friendlyError(err));
    else toast('success', a.active ? `${a.name} switched off` : `${a.name} switched on`);
    void load();
  }

  async function decide(b: Booking, approve: boolean) {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt('Reason for rejecting (shown to the resident, optional):', '');
      if (reason === null) return;
    }
    setBusyId(b.id);
    const { error: err } = await supabase.rpc('decide_booking', { p_booking_id: b.id, p_approve: approve, p_reason: reason?.trim() ?? '' });
    setBusyId(null);
    if (err) toast('error', friendlyError(err));
    else toast('success', approve ? 'Booking approved' : 'Booking rejected');
    void load();
  }

  const shown = useMemo(() => {
    if (!bookings) return null;
    const rows = bookingTab(bookings, tab, new Date());
    // The query is newest first; pending and upcoming read better soonest first.
    return tab === 'past' ? rows : [...rows].reverse();
  }, [bookings, tab]);
  const pendingCount = useMemo(() => (bookings ? bookingTab(bookings, 'pending', new Date()).length : 0), [bookings]);

  return (
    <>
      <PageHeader
        title="Amenities"
        subtitle="Clubhouse, courts and halls residents can book from the app."
        actions={
          <Button icon="plus" onClick={() => setEditing('new')}>
            New amenity
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {amenities && amenities.length === 0 ? (
        <Card>
          <EmptyState icon="clock" title="No amenities yet">Add the first one so residents can book it.</EmptyState>
        </Card>
      ) : (
        amenities && (
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>Amenity</th>
                  <th className={th}>Hours</th>
                  <th className={th}>Slot</th>
                  <th className={th}>Approval</th>
                  <th className={th}>Max upcoming</th>
                  <th className={th}>Active</th>
                  <th className={th} />
                </tr>
              }
            >
              {amenities.map((a) => (
                <tr key={a.id}>
                  <td className={td}>
                    <p className="font-medium text-slate-900">{a.name}</p>
                    {a.fee_note && <p className="text-xs text-slate-500">{a.fee_note}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>
                    {hhmm(a.open_time)} – {hhmm(a.close_time)}
                  </td>
                  <td className={`${td} text-slate-600`}>{slotLabel(a.slot_minutes)}</td>
                  <td className={td}>
                    <Pill tone={a.requires_approval ? 'amber' : 'slate'}>{a.requires_approval ? 'Needs approval' : 'Instant'}</Pill>
                  </td>
                  <td className={`${td} text-slate-600`}>{a.max_upcoming}</td>
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={a.active}
                      disabled={busyId === a.id}
                      onChange={() => void toggleActive(a)}
                      aria-label={`${a.name} active`}
                      className="h-4 w-4 rounded accent-brand-700"
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">Bookings</h2>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Tabs
            value={tab}
            onChange={setTab}
            options={TABS.map((t) => (t.value === 'pending' && pendingCount ? { ...t, label: `Pending (${pendingCount})` } : t))}
          />
          <span className="ml-auto text-sm text-slate-500">{shown?.length ?? 0} shown</span>
        </div>
        {shown && shown.length === 0 ? (
          <EmptyState icon="clipboard" title="No bookings">Nothing in this tab.</EmptyState>
        ) : (
          shown && (
            <Table
              head={
                <tr>
                  <th className={th}>Amenity</th>
                  <th className={th}>Slot</th>
                  <th className={th}>Flat</th>
                  <th className={th}>Booked by</th>
                  <th className={th}>Status</th>
                  <th className={th} />
                </tr>
              }
            >
              {shown.map((b) => {
                const st = STATUS[b.status] ?? { label: b.status, tone: 'slate' as Tone };
                return (
                  <tr key={b.id}>
                    <td className={`${td} font-medium text-slate-900`}>{b.amenities?.name ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{formatSlot(b.start_at, b.end_at)}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>
                      {flatLabel(b.flats?.towers?.building ?? '', b.flats?.towers?.name ?? '', b.flats?.number ?? '')}
                    </td>
                    <td className={`${td} text-slate-600`}>{b.booked_by_name ?? '—'}</td>
                    <td className={td}>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {b.reject_reason && <p className="mt-1 text-xs text-slate-500">{b.reject_reason}</p>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {b.status === 'pending' && tab === 'pending' && (
                        <span className="inline-flex gap-2">
                          <Button size="sm" icon="check" busy={busyId === b.id} onClick={() => void decide(b, true)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" icon="x" disabled={busyId === b.id} onClick={() => void decide(b, false)}>
                            Reject
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )
        )}
      </Card>

      <AmenityModal
        amenity={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast('success', 'Amenity saved');
          setEditing(null);
          void load();
        }}
      />
    </>
  );
}

function AmenityModal({ amenity, onClose, onSaved }: { amenity: Amenity | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [slot, setSlot] = useState(60);
  const [approval, setApproval] = useState(false);
  const [maxUpcoming, setMaxUpcoming] = useState(2);
  const [fee, setFee] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!amenity) return;
    const a = amenity === 'new' ? null : amenity;
    setName(a?.name ?? '');
    setDescription(a?.description ?? '');
    setOpenTime(a ? hhmm(a.open_time) : '06:00');
    setCloseTime(a ? hhmm(a.close_time) : '22:00');
    setSlot(a?.slot_minutes ?? 60);
    setApproval(a?.requires_approval ?? false);
    setMaxUpcoming(a?.max_upcoming ?? 2);
    setFee(a?.fee_note ?? '');
    setActive(a?.active ?? true);
    setError(null);
  }, [amenity]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(friendlyError('invalid_name'));
    if (!openTime || !closeTime || openTime >= closeTime) return setError(friendlyError('invalid_time'));
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('upsert_amenity', {
      // The generated RPC types have no nullable arguments; null means create.
      p_id: (amenity && amenity !== 'new' ? amenity.id : null) as unknown as string,
      p_name: name.trim(),
      p_description: description.trim(),
      p_open_time: openTime,
      p_close_time: closeTime,
      p_slot_minutes: slot,
      p_requires_approval: approval,
      p_max_upcoming: maxUpcoming,
      p_fee_note: fee.trim(),
      p_active: active,
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onSaved();
  }

  return (
    <Modal
      open={!!amenity}
      title={amenity === 'new' ? 'New amenity' : 'Edit amenity'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="amenity-form" type="submit" icon="check" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="amenity-form" onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clubhouse" autoFocus />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens">
            <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
          </Field>
          <Field label="Closes">
            <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </Field>
          <Field label="Slot length">
            <Select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {SLOT_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {slotLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Upcoming bookings per flat">
            <Input
              type="number"
              min={1}
              max={10}
              value={maxUpcoming}
              onChange={(e) => setMaxUpcoming(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
        </div>
        <Field label="Fee note (optional)">
          <Input value={fee} maxLength={200} onChange={(e) => setFee(e.target.value)} placeholder="e.g. Rs 500 per slot" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
          Bookings need admin approval
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
          Active (residents can book it)
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
