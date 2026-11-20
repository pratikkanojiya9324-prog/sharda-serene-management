import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, SearchInput, Select, Table, td, th } from '../components/ui';
import FlatImport from '../components/FlatImport';
import { callAccounts } from '../lib/accounts';
import { friendlyError } from '../lib/errors';
import { fetchAll } from '../lib/fetchAll';
import { useFlats, type FlatInfo } from '../lib/flats';
import { ADMIN_FAMILY_SELECT, ADMIN_FLAT_ACCOUNTS_SELECT } from '../lib/selects';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Member {
  id: string;
  flat_id: string;
  name: string;
  phone: string | null;
  relation: string | null;
}

export default function Flats() {
  const toast = useToast();
  const { flats, error: flatsError, loading, reload: reloadFlats } = useFlats();
  const [members, setMembers] = useState<Member[]>([]);
  const [withAccount, setWithAccount] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [viewing, setViewing] = useState<FlatInfo | null>(null);
  const [pwFlat, setPwFlat] = useState<FlatInfo | null>(null);

  const loadDetails = useCallback(async () => {
    const [m, a] = await Promise.all([
      fetchAll((from, to) =>
        supabase.from('family_members').select(ADMIN_FAMILY_SELECT).eq('society_id', SOCIETY_ID).order('created_at').order('id').range(from, to),
      ),
      fetchAll((from, to) =>
        supabase.from('flat_residents').select(ADMIN_FLAT_ACCOUNTS_SELECT).eq('flats.society_id', SOCIETY_ID).order('id').range(from, to),
      ),
    ]);
    const err = m.error ?? a.error;
    if (err) return setError(err.message);
    setError(null);
    setMembers(m.data ?? []);
    setWithAccount(new Set((a.data ?? []).map((x) => x.flat_id)));
  }, []);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const reload = () => {
    void reloadFlats();
    void loadDetails();
  };

  const membersOf = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of members) map.set(m.flat_id, [...(map.get(m.flat_id) ?? []), m]);
    return map;
  }, [members]);

  const buildings = [...new Set(flats.map((f) => f.building))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const q = search.trim().toLowerCase();
  const shown = flats.filter(
    (f) =>
      (!building || f.building === building) &&
      (!q || f.label.toLowerCase().includes(q) || (membersOf.get(f.id) ?? []).some((m) => m.name.toLowerCase().includes(q))),
  );

  return (
    <>
      <PageHeader
        title="Flats & members"
        subtitle={`${flats.length} flats · ${withAccount.size} with a login · ${members.length} family members`}
        actions={
          <Button icon="upload" onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
        }
      />
      {(flatsError || error) && <ErrorBanner message={(flatsError ?? error)!} onRetry={reload} />}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search flat or member" />
          <Select value={building} onChange={(e) => setBuilding(e.target.value)} className="w-44" aria-label="Building">
            <option value="">All buildings</option>
            {buildings.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
          <span className="ml-auto text-sm text-slate-500">{shown.length} shown</span>
        </div>
        {!loading && shown.length === 0 ? (
          <EmptyState icon="building" title={flats.length === 0 ? 'No flats yet' : 'No matching flats'}>
            {flats.length === 0 ? 'Import a CSV to create flats, logins and family members.' : 'Try another search.'}
          </EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Flat</th>
                <th className={th}>Building</th>
                <th className={th}>Wing</th>
                <th className={th}>Login</th>
                <th className={th}>Family</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            }
          >
            {shown.map((f) => {
              const fam = membersOf.get(f.id) ?? [];
              const hasAccount = withAccount.has(f.id);
              return (
                <tr key={f.id} className="hover:bg-slate-50/60">
                  <td className={`${td} font-semibold text-slate-900`}>{f.label}</td>
                  <td className={td}>{f.building}</td>
                  <td className={td}>{f.wing}</td>
                  <td className={td}>
                    {hasAccount ? (
                      <Pill tone="green" icon="check">
                        Active
                      </Pill>
                    ) : (
                      <Pill tone="slate" icon="ban">
                        No login
                      </Pill>
                    )}
                  </td>
                  <td className={td}>
                    {fam.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <button onClick={() => setViewing(f)} className="text-left text-slate-700 hover:text-brand-700">
                        {fam
                          .slice(0, 2)
                          .map((m) => m.name)
                          .join(', ')}
                        {fam.length > 2 && <span className="text-slate-400"> +{fam.length - 2}</span>}
                      </button>
                    )}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <Button size="sm" variant="ghost" icon="users" onClick={() => setViewing(f)}>
                      Family
                    </Button>
                    <Button size="sm" variant="secondary" icon="key" onClick={() => setPwFlat(f)}>
                      {hasAccount ? 'Reset password' : 'Create login'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <FlatImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          reload();
        }}
      />

      <Modal open={!!viewing} title={viewing ? `Family of ${viewing.label}` : ''} onClose={() => setViewing(null)}>
        {viewing && (membersOf.get(viewing.id) ?? []).length === 0 ? (
          <EmptyState icon="users" title="No family members">Add them with a CSV import (one row per member).</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {viewing &&
              (membersOf.get(viewing.id) ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{[m.relation, m.phone].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                </li>
              ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">
          To change a family, import a CSV with that flat's rows: its family list is replaced.
        </p>
      </Modal>

      <PasswordModal
        flat={pwFlat}
        hasAccount={pwFlat ? withAccount.has(pwFlat.id) : false}
        onClose={() => setPwFlat(null)}
        onDone={(created) => {
          toast('success', created ? `Login created for ${pwFlat?.label}` : `Password reset for ${pwFlat?.label}`);
          setPwFlat(null);
          if (created) void loadDetails();
        }}
      />
    </>
  );
}

function PasswordModal({
  flat,
  hasAccount,
  onClose,
  onDone,
}: {
  flat: FlatInfo | null;
  hasAccount: boolean;
  onClose: () => void;
  onDone: (created: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword('');
    setConfirm('');
    setError(null);
  }, [flat]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // Enter pressed again while saving
    if (!flat) return;
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      if (hasAccount) await callAccounts('set_password', { flat_id: flat.id, password });
      else await callAccounts('create_flat_account', { flat_id: flat.id, password });
      onDone(!hasAccount);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!flat}
      title={flat ? `${hasAccount ? 'Reset password' : 'Create login'} · ${flat.label}` : ''}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="flat-password" type="submit" busy={busy}>
            {hasAccount ? 'Reset password' : 'Create login'}
          </Button>
        </>
      }
    >
      <form id="flat-password" onSubmit={save} className="space-y-4">
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          The flat signs in on the app by choosing {flat?.building} → Wing {flat?.wing} → {flat?.number} and this password.
        </p>
        <Field label="New password" hint="At least 6 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirm password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
