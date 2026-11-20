import { useCallback, useEffect, useState } from 'react';
import {
  ADMIN_FLAT_LINKS_SELECT,
  ADMIN_FLATS_SELECT,
  ADMIN_MEMBERS_SELECT,
  normalizePhone,
} from '@society-gate/shared';
import type { AdminSociety } from '../App';
import { supabase } from '../lib/supabase';

interface FlatOption {
  id: string;
  label: string;
}
interface Member {
  membershipId: string;
  profileId: string;
  role: string;
  name: string;
  phone: string;
  links: { linkId: string; flatId: string; label: string }[];
}
interface PendingInvite {
  id: string;
  role: string;
  name: string;
  phone: string;
  flatLabel: string;
}

export default function People({ society }: { society: AdminSociety }) {
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [role, setRole] = useState<'resident' | 'guard'>('resident');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatId, setFlatId] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, m, fr, inv] = await Promise.all([
      supabase.from('flats').select(ADMIN_FLATS_SELECT).eq('society_id', society.id),
      supabase.from('memberships').select(ADMIN_MEMBERS_SELECT).eq('society_id', society.id),
      supabase
        .from('flat_residents')
        .select(ADMIN_FLAT_LINKS_SELECT)
        .eq('flats.society_id', society.id),
      supabase
        .from('invites')
        .select('id, role, name, phone, flat_id')
        .eq('society_id', society.id)
        .is('claimed_at', null)
        .order('created_at', { ascending: false }),
    ]);
    const firstErr = f.error ?? m.error ?? fr.error ?? inv.error;
    if (firstErr) setError(firstErr.message);

    const flatOptions = (f.data ?? [])
      .map((x) => ({ id: x.id, label: `${x.towers?.name ?? '?'}-${x.number}` }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const label = new Map(flatOptions.map((x) => [x.id, x.label]));
    setFlats(flatOptions);

    setMembers(
      (m.data ?? []).map((x) => ({
        membershipId: x.id,
        profileId: x.profile_id,
        role: x.role,
        name: x.profiles?.name ?? '(unknown)',
        phone: x.profiles?.phone ?? '',
        links:
          x.role === 'resident'
            ? (fr.data ?? [])
                .filter((l) => l.profile_id === x.profile_id)
                .map((l) => ({ linkId: l.id, flatId: l.flat_id, label: label.get(l.flat_id) ?? '?' }))
            : [],
      })),
    );
    setPending(
      (inv.data ?? []).map((i) => ({
        id: i.id,
        role: i.role,
        name: i.name,
        phone: i.phone,
        flatLabel: i.flat_id ? (label.get(i.flat_id) ?? '?') : '',
      })),
    );
  }, [society.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPhoneError(null);
    let e164: string;
    try {
      e164 = normalizePhone(phone);
    } catch {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }
    if (!name.trim()) return setError('Enter a name');
    if (role === 'resident' && !flatId) return setError('Choose a flat');
    const { error: err } = await supabase.from('invites').insert({
      society_id: society.id,
      phone: e164,
      name: name.trim(),
      role,
      flat_id: role === 'resident' ? flatId : null,
    });
    if (err) return setError(err.message);
    setNotice(`Invite created for ${e164}. They can now log in on the app.`);
    setName('');
    setPhone('');
    await load();
  }

  async function removeInvite(id: string) {
    const { error: err } = await supabase.from('invites').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.name} as ${m.role}?`)) return;
    setError(null);
    // Drop flat links first (residents), then the membership itself.
    if (m.links.length > 0) {
      const { error: lErr } = await supabase.from('flat_residents').delete().in('id', m.links.map((l) => l.linkId));
      if (lErr) return setError(lErr.message);
    }
    const { error: err } = await supabase.from('memberships').delete().eq('id', m.membershipId);
    if (err) setError(err.message);
    await load();
  }

  async function unlinkFlat(linkId: string) {
    const { error: err } = await supabase.from('flat_residents').delete().eq('id', linkId);
    if (err) setError(err.message);
    await load();
  }

  return (
    <>
      <h2>People</h2>
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className="card">
        <h3>Invite</h3>
        <form onSubmit={invite}>
          <div className="row">
            <select value={role} onChange={(e) => setRole(e.target.value as 'resident' | 'guard')} aria-label="Role">
              <option value="resident">Resident</option>
              <option value="guard">Guard</option>
            </select>
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {role === 'resident' && (
              <select value={flatId} onChange={(e) => setFlatId(e.target.value)} aria-label="Flat">
                <option value="">Flat…</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
            <button>Invite</button>
          </div>
          {phoneError && <p className="error">{phoneError}</p>}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Flat</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId}>
                <td>{m.name}</td>
                <td>{m.phone}</td>
                <td>{m.role}</td>
                <td>
                  {m.links.map((l) => (
                    <span key={l.linkId} style={{ marginRight: 8 }}>
                      {l.label}{' '}
                      <button title="Unlink this flat" onClick={() => unlinkFlat(l.linkId)}>
                        x
                      </button>
                    </span>
                  ))}
                </td>
                <td>Claimed</td>
                <td>
                  <button onClick={() => removeMember(m)}>Remove</button>
                </td>
              </tr>
            ))}
            {pending.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.phone}</td>
                <td>{i.role}</td>
                <td>{i.flatLabel}</td>
                <td className="muted">Pending</td>
                <td>
                  <button onClick={() => removeInvite(i.id)}>Cancel invite</button>
                </td>
              </tr>
            ))}
            {members.length + pending.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No people yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
