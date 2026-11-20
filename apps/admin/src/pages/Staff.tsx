import { useCallback, useEffect, useState } from 'react';
import { isValidUsername } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Select, Table, td, th } from '../components/ui';
import { callAccounts } from '../lib/accounts';
import { friendlyError } from '../lib/errors';
import { ADMIN_STAFF_SELECT } from '../lib/selects';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface StaffMember {
  membershipId: string;
  userId: string;
  role: 'guard' | 'admin';
  name: string;
}

export default function Staff({ userId }: { userId: string }) {
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [disabling, setDisabling] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('memberships')
      .select(ADMIN_STAFF_SELECT)
      .eq('society_id', SOCIETY_ID)
      .in('role', ['guard', 'admin']);
    if (err) return setError(err.message);
    setError(null);
    setStaff(
      (data ?? [])
        .map((m) => ({ membershipId: m.id, userId: m.profile_id, role: m.role as 'guard' | 'admin', name: m.profiles?.name ?? '(no name)' }))
        .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function disable() {
    if (!disabling) return;
    setBusy(true);
    try {
      await callAccounts('disable_staff', { user_id: disabling.userId });
      toast('success', `${disabling.name} can no longer sign in`);
    } catch (e) {
      const msg = friendlyError(e);
      toast((e as Error).message === 'still_member_elsewhere' ? 'info' : 'error', msg);
    } finally {
      setBusy(false);
      setDisabling(null);
      void load();
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Guards and admins sign in with a username and password."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Add staff
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        {staff && staff.length === 0 ? (
          <EmptyState icon="shield" title="No staff yet">Add a guard so the gate app can be used.</EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Role</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            }
          >
            {staff?.map((s) => (
              <tr key={s.membershipId} className="hover:bg-slate-50/60">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      {s.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-medium text-slate-900">{s.name}</span>
                    {s.userId === userId && <span className="text-xs text-slate-400">(you)</span>}
                  </div>
                </td>
                <td className={td}>
                  {s.role === 'admin' ? (
                    <Pill tone="teal" icon="shield">
                      Admin
                    </Pill>
                  ) : (
                    <Pill tone="amber" icon="door">
                      Guard
                    </Pill>
                  )}
                </td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Button size="sm" variant="secondary" icon="key" onClick={() => setResetting(s)}>
                    Reset password
                  </Button>{' '}
                  {s.userId !== userId && (
                    <Button size="sm" variant="ghost" icon="ban" className="text-red-600 hover:bg-red-50" onClick={() => setDisabling(s)}>
                      Disable
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <CreateStaffModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(name) => {
          toast('success', `${name} added`);
          setCreating(false);
          void load();
        }}
      />
      <ResetStaffPasswordModal
        member={resetting}
        onClose={() => setResetting(null)}
        onDone={() => {
          toast('success', `Password reset for ${resetting?.name}`);
          setResetting(null);
        }}
      />
      <ConfirmDialog
        open={!!disabling}
        title="Disable staff account"
        message={
          <>
            <strong>{disabling?.name}</strong> will be removed from this society and signed out of the app for good. This
            cannot be undone here — create a new account if they return.
          </>
        }
        confirmLabel="Disable"
        danger
        busy={busy}
        onConfirm={() => void disable()}
        onClose={() => setDisabling(null)}
      />
    </>
  );
}

function CreateStaffModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'guard' | 'admin'>('guard');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername('');
    setName('');
    setRole('guard');
    setPassword('');
    setError(null);
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!isValidUsername(u)) return setError(friendlyError('invalid_username'));
    if (!name.trim() || name.trim().length > 60) return setError(friendlyError('invalid_name'));
    if (password.length < 6) return setError(friendlyError('invalid_password'));
    setBusy(true);
    try {
      await callAccounts('create_staff', { society_id: SOCIETY_ID, username: u, name: name.trim(), role, password });
      onCreated(name.trim());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Add staff"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-staff" type="submit" busy={busy}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-staff" onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Patil" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" hint="Lowercase, 3-30 characters.">
            <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" placeholder="e.g. guard2" />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as 'guard' | 'admin')}>
              <option value="guard">Guard</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <Field label="Password" hint="At least 6 characters. Share it with the person directly.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function ResetStaffPasswordModal({ member, onClose, onDone }: { member: StaffMember | null; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword('');
    setError(null);
  }, [member]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    if (password.length < 6) return setError(friendlyError('invalid_password'));
    setBusy(true);
    try {
      await callAccounts('set_password', { user_id: member.userId, password });
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!member}
      title={member ? `Reset password · ${member.name}` : ''}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="staff-password" type="submit" busy={busy}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="staff-password" onSubmit={save} className="space-y-4">
        <Field label="New password" hint="At least 6 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
