import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Textarea } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { dateTime } from '../lib/format';
import { ADMIN_NOTICES_SELECT } from '../lib/selects';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  attachment_path: string | null;
  attachment_kind: string | null;
  created_at: string;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export default function Notices() {
  const toast = useToast();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notices')
      .select(ADMIN_NOTICES_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) return setError(err.message);
    setError(null);
    setNotices(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePin(n: Notice) {
    const { error: err } = await supabase.rpc('set_notice_pinned', { p_id: n.id, p_pinned: !n.pinned });
    if (err) toast('error', friendlyError(err));
    else toast('success', n.pinned ? 'Notice unpinned' : 'Notice pinned to the top');
    void load();
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('delete_notice', { p_id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (err) toast('error', friendlyError(err));
    else toast('success', 'Notice deleted');
    void load();
  }

  async function openAttachment(path: string) {
    const { data, error: err } = await supabase.storage.from('notices').createSignedUrl(path, 600);
    if (err || !data) return toast('error', err?.message ?? 'Could not open the attachment');
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle="Posted notices reach every flat in the app with a notification."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New notice
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {notices && notices.length === 0 ? (
        <Card>
          <EmptyState icon="megaphone" title="No notices yet">Post the first one — residents get a notification.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices?.map((n) => (
            <Card key={n.id} className={`flex flex-col p-5 ${n.pinned ? 'ring-2 ring-accent-500/40' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{n.title}</h3>
                    {n.pinned && (
                      <Pill tone="amber" icon="pin">
                        Pinned
                      </Pill>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{dateTime(n.created_at)}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-5 flex-1 text-sm whitespace-pre-line text-slate-600">{n.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {n.attachment_path && (
                  <Button size="sm" variant="ghost" icon="paperclip" onClick={() => void openAttachment(n.attachment_path!)}>
                    {n.attachment_kind === 'pdf' ? 'Open PDF' : 'View image'}
                  </Button>
                )}
                <span className="flex-1" />
                <Button size="sm" variant="secondary" icon="pin" onClick={() => void togglePin(n)}>
                  {n.pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button size="sm" variant="ghost" icon="trash" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(n)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateNoticeModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          toast('success', 'Notice posted');
          setCreating(false);
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete notice"
        message={
          <>
            Delete <strong>{deleting?.title}</strong>? Residents will no longer see it.
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

function CreateNoticeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setPinned(false);
    setFile(null);
    setError(null);
  }, [open]);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return setFile(null);
    const isPdf = f.type === 'application/pdf';
    if (!isPdf && !f.type.startsWith('image/')) return setError('Attach an image or a PDF.');
    if (f.size > MAX_ATTACHMENT_BYTES) return setError('Attachments can be at most 10 MB.');
    setFile(f);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(friendlyError('invalid_title'));
    if (!body.trim()) return setError(friendlyError('invalid_body'));
    setBusy(true);
    setError(null);
    let attachment: { path: string; kind: 'image' | 'pdf' } | null = null;
    if (file) {
      const kind = file.type === 'application/pdf' ? 'pdf' : 'image';
      const ext = (file.name.split('.').pop() ?? (kind === 'pdf' ? 'pdf' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${SOCIETY_ID}/${crypto.randomUUID()}.${ext || 'bin'}`;
      const up = await supabase.storage.from('notices').upload(path, file, { contentType: file.type });
      if (up.error) {
        setBusy(false);
        return setError(`Upload failed: ${up.error.message}`);
      }
      attachment = { path, kind };
    }
    const { error: err } = await supabase.rpc('create_notice', {
      p_title: title.trim(),
      p_body: body.trim(),
      p_pinned: pinned,
      ...(attachment ? { p_attachment_path: attachment.path, p_attachment_kind: attachment.kind } : {}),
    });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onCreated();
  }

  return (
    <Modal
      open={open}
      title="New notice"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-notice" type="submit" icon="megaphone" busy={busy}>
            Post notice
          </Button>
        </>
      }
    >
      <form id="create-notice" onSubmit={save} className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water supply off on Sunday" autoFocus />
        </Field>
        <Field label="Message">
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Attachment (optional)" hint="An image or PDF, up to 10 MB.">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
            <Icon name="paperclip" className="h-4 w-4" />
            <span className="flex-1 truncate">{file ? file.name : 'Choose a file'}</span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
          Pin to the top
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
