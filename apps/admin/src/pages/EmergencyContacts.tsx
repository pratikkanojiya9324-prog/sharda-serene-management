import { useCallback, useEffect, useState } from 'react';
import { EMERGENCY_CONTACT_SELECT } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Table, td, th } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Contact {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  sort_order: number;
}

export default function EmergencyContacts() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('emergency_contacts')
      .select(EMERGENCY_CONTACT_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('sort_order')
      .order('name');
    if (err) return setError(err.message);
    setError(null);
    setContacts((data ?? []) as Contact[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('delete_emergency_contact', { p_id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (err) toast('error', friendlyError(err));
    else toast('success', 'Contact deleted');
    void load();
  }

  const nextOrder = contacts?.length ? Math.max(...contacts.map((c) => c.sort_order)) + 1 : 1;

  return (
    <>
      <PageHeader
        title="Emergency contacts"
        subtitle="Numbers every resident can call from the app. Lowest order is shown first."
        actions={
          <Button icon="plus" onClick={() => setEditing('new')}>
            Add contact
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {contacts && contacts.length === 0 ? (
        <Card>
          <EmptyState icon="alert" title="No emergency contacts">Add the ambulance, fire brigade, police and the society office.</EmptyState>
        </Card>
      ) : (
        contacts && (
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Name</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Note</th>
                  <th className={th} />
                </tr>
              }
            >
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} text-slate-600`}>{c.sort_order}</td>
                  <td className={`${td} font-medium text-slate-900`}>{c.name}</td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{c.phone}</td>
                  <td className={`${td} text-slate-600`}>{c.note ?? '—'}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                      Edit
                    </Button>{' '}
                    <Button size="sm" variant="ghost" icon="trash" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(c)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )
      )}

      <ContactModal
        contact={editing}
        defaultOrder={nextOrder}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast('success', 'Contact saved');
          setEditing(null);
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete contact"
        message={
          <>
            Delete <strong>{deleting?.name}</strong> from the emergency numbers?
          </>
        }
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function ContactModal({
  contact,
  defaultOrder,
  onClose,
  onSaved,
}: {
  contact: Contact | 'new' | null;
  defaultOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [order, setOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contact) return;
    const c = contact === 'new' ? null : contact;
    setName(c?.name ?? '');
    setPhone(c?.phone ?? '');
    setNote(c?.note ?? '');
    setOrder(c?.sort_order ?? defaultOrder);
    setError(null);
    // Reset only when a different contact is opened, not when the list reloads behind the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(friendlyError('invalid_name'));
    if (!/^\+?[0-9]{3,15}$/.test(phone.trim())) return setError(friendlyError('invalid_contact_phone'));
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('upsert_emergency_contact', {
      // The generated RPC types have no nullable arguments; null means create.
      p_id: (contact && contact !== 'new' ? contact.id : null) as unknown as string,
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_note: note.trim(),
      p_sort_order: order,
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onSaved();
  }

  return (
    <Modal
      open={!!contact}
      title={contact === 'new' ? 'Add contact' : 'Edit contact'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="contact-form" type="submit" icon="check" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ambulance" autoFocus />
        </Field>
        <Field label="Phone" hint="Digits only, with an optional leading +.">
          <Input value={phone} inputMode="tel" maxLength={16} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 108" />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 24 hours" />
        </Field>
        <Field label="Order" hint="Lowest shows first.">
          <Input type="number" value={order} onChange={(e) => setOrder(Math.trunc(Number(e.target.value) || 0))} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
