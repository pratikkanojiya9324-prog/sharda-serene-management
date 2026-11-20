import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, EmptyState, ErrorBanner, PageHeader, Pill, Stat } from '../components/ui';
import { useFlats } from '../lib/flats';
import { currentMonth, dateTime, inr, monthName, titleCase } from '../lib/format';
import { ADMIN_COMPLAINTS_SELECT, ADMIN_NOTICES_SELECT } from '../lib/selects';
import { COMPLAINT_STATUS_STYLE } from '../lib/status';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Summary {
  openComplaints: number;
  unpaidCount: number;
  unpaidAmount: number;
  collected: number;
  visitorsToday: number;
  notices: { id: string; title: string; pinned: boolean; created_at: string }[];
  complaints: { id: string; flat_id: string; category: string; status: 'open' | 'in_progress' | 'resolved'; created_at: string }[];
}

export default function Dashboard() {
  const { flats, byId } = useFlats();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const month = currentMonth();

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [open, bills, visits, notices, complaints] = await Promise.all([
      supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('society_id', SOCIETY_ID).neq('status', 'resolved'),
      supabase.from('bills').select('amount, status').eq('society_id', SOCIETY_ID).eq('period', `${month}-01`),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('society_id', SOCIETY_ID).gte('created_at', start.toISOString()),
      supabase.from('notices').select(ADMIN_NOTICES_SELECT).eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }).limit(4),
      supabase.from('complaints').select(ADMIN_COMPLAINTS_SELECT).eq('society_id', SOCIETY_ID).neq('status', 'resolved').order('created_at', { ascending: false }).limit(5),
    ]);
    const err = open.error ?? bills.error ?? visits.error ?? notices.error ?? complaints.error;
    if (err) return setError(err.message);
    setError(null);
    const b = bills.data ?? [];
    setData({
      openComplaints: open.count ?? 0,
      unpaidCount: b.filter((x) => x.status === 'unpaid').length,
      unpaidAmount: b.filter((x) => x.status === 'unpaid').reduce((s, x) => s + Number(x.amount), 0),
      collected: b.filter((x) => x.status === 'paid').reduce((s, x) => s + Number(x.amount), 0),
      visitorsToday: visits.count ?? 0,
      notices: notices.data ?? [],
      complaints: complaints.data ?? [],
    });
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview for ${monthName(month)}`} />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="building" label="Flats" value={flats.length} />
        <Stat icon="wrench" label="Open complaints" value={data?.openComplaints ?? '–'} tone="amber" />
        <Stat icon="wallet" label="Outstanding this month" value={data ? inr(data.unpaidAmount) : '–'} tone="red" />
        <Stat icon="clipboard" label="Visitors today" value={data?.visitorsToday ?? '–'} tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Open complaints</h2>
            <Link to="/complaints" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {data && data.complaints.length === 0 ? (
            <EmptyState icon="check" title="Nothing open">All complaints are resolved.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.complaints.map((c) => {
                const s = COMPLAINT_STATUS_STYLE[c.status];
                return (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-slate-800">{byId.get(c.flat_id)?.label ?? '—'}</span>
                    <span className="text-slate-500">{titleCase(c.category)}</span>
                    <span className="flex-1" />
                    <Pill tone={s.tone} icon={s.icon}>
                      {s.label}
                    </Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Latest notices</h2>
            <Link to="/notices" className="text-sm font-medium text-brand-700 hover:underline">
              Manage
            </Link>
          </div>
          {data && data.notices.length === 0 ? (
            <EmptyState icon="megaphone" title="No notices yet">Post one from the Notices page.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.notices.map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {n.pinned && <Icon name="pin" className="h-4 w-4 text-accent-500" />}
                  <span className="flex-1 truncate font-medium text-slate-800">{n.title}</span>
                  <span className="text-xs text-slate-400">{dateTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {data && (
            <div className="rounded-b-[16px] border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm text-slate-500">
              Collected this month: <span className="font-semibold text-emerald-700">{inr(data.collected)}</span> ·{' '}
              {data.unpaidCount} bill{data.unpaidCount === 1 ? '' : 's'} unpaid
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
