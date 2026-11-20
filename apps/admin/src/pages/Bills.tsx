import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, SearchInput, Select, Stat, Table, Tabs, Textarea, td, th } from '../components/ui';
import { csvErrorMessage, downloadCsv, parseBillsCsv, toCsv } from '../lib/csv';
import { friendlyError } from '../lib/errors';
import { fetchAll } from '../lib/fetchAll';
import { flatKey, useFlats, type FlatInfo } from '../lib/flats';
import { currentMonth, dateOnly, inr, monthName } from '../lib/format';
import { ADMIN_BILLS_SELECT } from '../lib/selects';
import { BILL_STATUS_STYLE, PAYMENT_MODES, PAYMENT_MODE_LABEL, type PaymentMode } from '../lib/status';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Bill {
  id: string;
  flat_id: string;
  period: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'unpaid';
  paid_at: string | null;
  payment_mode: PaymentMode | null;
  payment_reference: string | null;
  receipt_no: string | null;
}

export default function Bills() {
  const toast = useToast();
  const { flats, byId } = useFlats();
  const [month, setMonth] = useState(currentMonth());
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | 'paid' | 'unpaid'>('');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState<Bill | null>(null);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!month) return;
    const seq = ++loadSeq.current;
    const { data, error: err } = await fetchAll((from, to) =>
      supabase.from('bills').select(ADMIN_BILLS_SELECT).eq('society_id', SOCIETY_ID).eq('period', `${month}-01`).order('id').range(from, to),
    );
    if (seq !== loadSeq.current) return; // a newer month was requested meanwhile
    if (err) return setError(err.message);
    setError(null);
    setBills(data ?? []);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = (b: Bill) => byId.get(b.flat_id)?.label ?? '—';
  const q = search.trim().toLowerCase();
  const shown = (bills ?? [])
    .filter((b) => (!status || b.status === status) && (!q || label(b).toLowerCase().includes(q) || (b.receipt_no ?? '').toLowerCase().includes(q)))
    .sort((a, b) => label(a).localeCompare(label(b), undefined, { numeric: true }));
  const all = bills ?? [];
  const total = all.reduce((s, b) => s + Number(b.amount), 0);
  const collected = all.filter((b) => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0);

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="Maintenance bills by month. Payments are recorded here; residents see them in the app."
        actions={
          <>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label="Month" />
            <Button icon="plus" onClick={() => setGenerating(true)}>
              Generate bills
            </Button>
          </>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat icon="receipt" label={`Billed · ${month ? monthName(month) : ''}`} value={inr(total)} />
        <Stat icon="check" label="Collected" value={inr(collected)} tone="teal" />
        <Stat icon="wallet" label="Outstanding" value={inr(total - collected)} tone="amber" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search flat or receipt" />
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | 'paid' | 'unpaid')} className="w-36" aria-label="Status">
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </Select>
          <span className="ml-auto text-sm text-slate-500">
            {all.filter((b) => b.status === 'paid').length}/{all.length} paid
          </span>
        </div>
        {bills && shown.length === 0 ? (
          <EmptyState icon="receipt" title={all.length === 0 ? 'No bills for this month' : 'No matching bills'}>
            {all.length === 0 ? 'Use “Generate bills” to bill every flat.' : 'Try another filter.'}
          </EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Flat</th>
                <th className={th}>Amount</th>
                <th className={th}>Due</th>
                <th className={th}>Status</th>
                <th className={th}>Payment</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            }
          >
            {shown.map((b) => {
              const st = BILL_STATUS_STYLE[b.status];
              const overdue = b.status === 'unpaid' && b.due_date < new Date().toISOString().slice(0, 10);
              return (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <td className={`${td} font-semibold text-slate-900`}>{label(b)}</td>
                  <td className={td}>{inr(Number(b.amount))}</td>
                  <td className={`${td} whitespace-nowrap ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>{dateOnly(b.due_date)}</td>
                  <td className={td}>
                    <Pill tone={overdue ? 'red' : st.tone} icon={overdue ? 'alert' : st.icon}>
                      {overdue ? 'Overdue' : st.label}
                    </Pill>
                  </td>
                  <td className={`${td} text-xs text-slate-500`}>
                    {b.status === 'paid' && (
                      <>
                        <span className="font-mono font-medium text-slate-700">{b.receipt_no}</span>
                        <span className="block">
                          {b.payment_mode && PAYMENT_MODE_LABEL[b.payment_mode]}
                          {b.payment_reference && ` · ${b.payment_reference}`}
                          {b.paid_at && ` · ${dateOnly(b.paid_at)}`}
                        </span>
                      </>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {b.status === 'unpaid' && (
                      <Button size="sm" variant="secondary" icon="check" onClick={() => setPaying(b)}>
                        Mark paid
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <GenerateBillsModal
        open={generating}
        defaultMonth={month}
        flats={flats}
        onClose={() => setGenerating(false)}
        onDone={(count, m) => {
          toast('success', count === 0 ? 'No new bills: every flat already has one for that month' : `Created ${count} bill${count === 1 ? '' : 's'}`);
          setGenerating(false);
          setMonth(m);
          void load();
        }}
      />
      <MarkPaidModal
        bill={paying}
        flatLabel={paying ? label(paying) : ''}
        onClose={() => setPaying(null)}
        onDone={(receipt) => {
          toast('success', `Payment recorded · receipt ${receipt}`);
          setPaying(null);
          void load();
        }}
      />
    </>
  );
}

const BILL_FORMAT = 'building,wing,flat,amount';

function GenerateBillsModal({
  open,
  defaultMonth,
  flats,
  onClose,
  onDone,
}: {
  open: boolean;
  defaultMonth: string;
  flats: FlatInfo[];
  onClose: () => void;
  onDone: (count: number, month: string) => void;
}) {
  const [mode, setMode] = useState<'same' | 'csv'>('same');
  const [month, setMonth] = useState(defaultMonth);
  const [due, setDue] = useState('');
  const [amount, setAmount] = useState('');
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('same');
    setMonth(defaultMonth);
    setDue(`${defaultMonth}-10`);
    setAmount('');
    setCsv('');
    setError(null);
  }, [open, defaultMonth]);

  function template() {
    downloadCsv('bills-template.csv', toCsv([BILL_FORMAT.split(','), ...flats.map((f) => [f.building, f.wing, f.number, ''])]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // Enter pressed again while saving
    setError(null);
    if (!month) return setError(friendlyError('invalid_period'));
    if (!due) return setError(friendlyError('invalid_due_date'));
    let result;
    if (mode === 'same') {
      const n = Number(amount);
      if (!(n > 0) || n >= 1e8) return setError(friendlyError('invalid_amount'));
      setBusy(true);
      result = await supabase.rpc('generate_bills', { p_period: `${month}-01`, p_amount: n, p_due_date: due });
    } else {
      let rows;
      try {
        rows = parseBillsCsv(csv);
      } catch (err) {
        return setError(csvErrorMessage(err, BILL_FORMAT));
      }
      if (rows.length === 0) return setError('The CSV has no rows.');
      const ids = new Map(flats.map((f) => [flatKey(f.building, f.wing, f.number), f.id]));
      const unknown = rows.filter((r) => !ids.has(flatKey(r.building, r.wing, r.flat)));
      if (unknown.length) {
        return setError(
          `Unknown flat on line${unknown.length === 1 ? '' : 's'} ${unknown
            .slice(0, 8)
            .map((r) => r.line)
            .join(', ')}${unknown.length > 8 ? '…' : ''}. Import the flats first.`,
        );
      }
      const seen = new Set<string>();
      const dup = rows.find((r) => {
        const k = flatKey(r.building, r.wing, r.flat);
        if (seen.has(k)) return true;
        seen.add(k);
        return false;
      });
      if (dup) return setError(`Line ${dup.line} repeats a flat that is already in the file.`);
      setBusy(true);
      result = await supabase.rpc('generate_bills_custom', {
        p_period: `${month}-01`,
        p_due_date: due,
        p_rows: rows.map((r) => ({ flat_id: ids.get(flatKey(r.building, r.wing, r.flat))!, amount: r.amount })),
      });
    }
    setBusy(false);
    if (result.error) return setError(friendlyError(result.error));
    onDone(result.data ?? 0, month);
  }

  return (
    <Modal
      open={open}
      title="Generate bills"
      onClose={onClose}
      wide={mode === 'csv'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="generate-bills" type="submit" busy={busy}>
            Generate
          </Button>
        </>
      }
    >
      <form id="generate-bills" onSubmit={save} className="space-y-4">
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            { value: 'same', label: 'Same amount for all' },
            { value: 'csv', label: 'Per-flat amounts (CSV)' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Billing month">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        {mode === 'same' ? (
          <Field label="Amount (₹)" hint={`Billed to each of the ${flats.length} flats that has no bill for this month yet.`}>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" />
          </Field>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
              <span className="font-mono text-xs text-slate-500">{BILL_FORMAT}</span>
              <button type="button" onClick={template} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                <Icon name="download" className="h-3.5 w-3.5" /> Template with all flats
              </button>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 hover:border-brand-500 hover:text-brand-700">
              <Icon name="upload" /> Choose a .csv file
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => setCsv((await e.target.files?.[0]?.text()) ?? csv)} />
            </label>
            <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" placeholder={`${BILL_FORMAT}\nBuilding 1,A,101,2500`} />
          </>
        )}
        <p className="text-xs text-slate-500">Flats that already have a bill for this month are skipped.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function MarkPaidModal({
  bill,
  flatLabel,
  onClose,
  onDone,
}: {
  bill: Bill | null;
  flatLabel: string;
  onClose: () => void;
  onDone: (receipt: string) => void;
}) {
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode('upi');
    setReference('');
    setError(null);
  }, [bill]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // Enter pressed again while saving
    if (!bill) return;
    setBusy(true);
    const { data, error: err } = await supabase.rpc('mark_bill_paid', {
      p_bill_id: bill.id,
      p_mode: mode,
      ...(reference.trim() ? { p_reference: reference.trim() } : {}),
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onDone(data?.receipt_no ?? '');
  }

  return (
    <Modal
      open={!!bill}
      title={bill ? `Record payment · ${flatLabel}` : ''}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="mark-paid" type="submit" icon="check" busy={busy}>
            Mark paid
          </Button>
        </>
      }
    >
      {bill && (
        <form id="mark-paid" onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
            <span className="text-sm text-brand-800">{monthName(bill.period.slice(0, 7))}</span>
            <span className="text-lg font-semibold text-brand-900">{inr(Number(bill.amount))}</span>
          </div>
          <Field label="Payment mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference (optional)" hint="UPI transaction id, cheque number…">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">A receipt number is assigned automatically and the flat is notified.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
