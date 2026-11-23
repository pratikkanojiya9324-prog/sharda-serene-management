import { useCallback, useEffect, useMemo, useState } from 'react';
import { SOS_SELECT, SOS_TYPES, flatLabel } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Modal, PageHeader, Pill, Table, Textarea, td, th, type Tone } from '../components/ui';
import { sosDuration } from '../lib/community';
import { friendlyError } from '../lib/errors';
import { dateTime } from '../lib/format';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Alert {
  id: string;
  type: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'cancelled';
  raised_by_name: string | null;
  created_at: string;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
  resolved_by_name: string | null;
  flats: { number: string; towers: { building: string; name: string } | null } | null;
}

const LIMIT = 500;
const STATUS: Record<Alert['status'], { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'red' },
  acknowledged: { label: 'On the way', tone: 'amber' },
  resolved: { label: 'Resolved', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};
const isActive = (a: Alert) => a.status === 'open' || a.status === 'acknowledged';
const typeLabel = (v: string) => SOS_TYPES.find((t) => t.value === v)?.label ?? v;

export default function SosLog({ userName }: { userName: string | null }) {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('sos_alerts')
      .select(SOS_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (err) return setError(friendlyError(err));
    setError(null);
    setAlerts((data ?? []) as unknown as Alert[]);
    setNow(new Date());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // New alerts and status changes arrive live; the durations of open alerts tick each minute.
  useEffect(() => {
    const channel = supabase
      .channel('admin-sos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts', filter: `society_id=eq.${SOCIETY_ID}` }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function acknowledge(a: Alert) {
    setBusyId(a.id);
    const { error: err } = await supabase.rpc('ack_sos', { p_id: a.id, p_actor_name: userName ?? undefined });
    setBusyId(null);
    if (err) toast('error', friendlyError(err));
    else toast('success', 'Marked as on the way');
    void load();
  }

  const shown = useMemo(() => alerts?.filter((a) => !openOnly || isActive(a)) ?? null, [alerts, openOnly]);

  return (
    <>
      <PageHeader title="SOS log" subtitle="Alerts raised by residents. Open alerts also ring the guard and office." />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
            Open only
          </label>
          <span className="ml-auto text-sm text-slate-500">{shown?.length ?? 0} shown</span>
        </div>
        {shown && shown.length === 0 ? (
          <EmptyState icon="shield" title="No alerts">{openOnly ? 'Nothing is open right now.' : 'No SOS alerts have been raised.'}</EmptyState>
        ) : (
          shown && (
            <Table
              head={
                <tr>
                  <th className={th}>Flat</th>
                  <th className={th}>Type</th>
                  <th className={th}>Raised by</th>
                  <th className={th}>Time</th>
                  <th className={th}>Status</th>
                  <th className={th}>Handled by</th>
                  <th className={th}>Duration</th>
                  <th className={th}>Note</th>
                  <th className={th} />
                </tr>
              }
            >
              {shown.map((a) => {
                const st = STATUS[a.status] ?? { label: a.status, tone: 'slate' as Tone };
                const handler = a.status === 'resolved' ? (a.resolved_by_name ?? a.acknowledged_by_name) : a.acknowledged_by_name;
                return (
                  <tr key={a.id}>
                    <td className={`${td} whitespace-nowrap font-medium text-slate-900`}>
                      {flatLabel(a.flats?.towers?.building ?? '', a.flats?.towers?.name ?? '', a.flats?.number ?? '')}
                    </td>
                    <td className={td}>{typeLabel(a.type)}</td>
                    <td className={`${td} text-slate-600`}>{a.raised_by_name ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{dateTime(a.created_at)}</td>
                    <td className={td}>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </td>
                    <td className={`${td} text-slate-600`}>{handler ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>
                      {a.status === 'cancelled' ? '—' : sosDuration(a.created_at, a.resolved_at, now)}
                    </td>
                    <td className={`${td} max-w-xs text-slate-600`}>{a.resolved_note ?? '—'}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {isActive(a) && (
                        <span className="inline-flex gap-2">
                          {a.status === 'open' && (
                            <Button size="sm" variant="secondary" busy={busyId === a.id} onClick={() => void acknowledge(a)}>
                              On my way
                            </Button>
                          )}
                          <Button size="sm" icon="check" onClick={() => setResolving(a)}>
                            Resolved
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

      <ResolveModal
        alert={resolving}
        userName={userName}
        onClose={() => setResolving(null)}
        onResolved={() => {
          toast('success', 'Alert resolved');
          setResolving(null);
          void load();
        }}
      />
    </>
  );
}

function ResolveModal({ alert, userName, onClose, onResolved }: { alert: Alert | null; userName: string | null; onClose: () => void; onResolved: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alertId = alert?.id;

  useEffect(() => {
    setNote('');
    setError(null);
  }, [alertId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !alert) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('resolve_sos', { p_id: alert.id, p_note: note.trim(), p_actor_name: userName ?? undefined });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onResolved();
  }

  return (
    <Modal
      open={!!alert}
      title="Resolve alert"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="resolve-sos" type="submit" icon="check" busy={busy}>
            Mark resolved
          </Button>
        </>
      }
    >
      <form id="resolve-sos" onSubmit={save} className="space-y-3">
        <p className="text-sm text-slate-600">Add a short note about what happened (optional).</p>
        <Textarea rows={3} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
