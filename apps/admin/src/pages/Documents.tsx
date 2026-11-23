import { useCallback, useEffect, useState } from 'react';
import { DOCUMENT_SELECT, DOC_CATEGORIES, type DocCategory } from '@society-gate/shared';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Pill, Select, Table, td, th } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { istDate } from '../lib/format';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface Doc {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_kind: string;
  created_at: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = 'society-docs';
// No SVG: it can carry script. The bucket allows the same list.
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const categoryLabel = (v: string) => DOC_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default function Documents() {
  const toast = useToast();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .eq('society_id', SOCIETY_ID)
      .order('created_at', { ascending: false });
    if (err) return setError(friendlyError(err));
    setError(null);
    setDocs((data ?? []) as Doc[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(d: Doc) {
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_path, 600);
    if (err || !data) return toast('error', err?.message ?? 'Could not open the file');
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const { data: path, error: err } = await supabase.rpc('delete_document', { p_id: deleting.id });
    if (err) {
      setBusy(false);
      setDeleting(null);
      return toast('error', friendlyError(err));
    }
    // The row is gone; a failed object removal leaves an orphan file, which is not worth blocking on.
    await supabase.storage.from(BUCKET).remove([typeof path === 'string' ? path : deleting.file_path]);
    setBusy(false);
    setDeleting(null);
    toast('success', 'Document deleted');
    void load();
  }

  const shown = docs?.filter((d) => filter === 'all' || d.category === filter) ?? null;

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Bylaws, minutes, circulars and forms every resident can open in the app."
        actions={
          <Button icon="upload" onClick={() => setUploading(true)}>
            Upload document
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: 'all', label: 'All' }, ...DOC_CATEGORIES].map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === c.value ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {shown && shown.length === 0 ? (
        <Card>
          <EmptyState icon="paperclip" title="No documents">{filter === 'all' ? 'Upload the first one.' : 'Nothing in this category.'}</EmptyState>
        </Card>
      ) : (
        shown && (
          <Card>
            <Table
              head={
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Category</th>
                  <th className={th}>Type</th>
                  <th className={th}>Added</th>
                  <th className={th} />
                </tr>
              }
            >
              {shown.map((d) => (
                <tr key={d.id}>
                  <td className={`${td} font-medium text-slate-900`}>{d.title}</td>
                  <td className={td}>
                    <Pill tone="teal">{categoryLabel(d.category)}</Pill>
                  </td>
                  <td className={`${td} text-slate-600`}>{d.file_kind === 'pdf' ? 'PDF' : 'Image'}</td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{istDate(d.created_at)}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <Button size="sm" variant="ghost" icon="paperclip" onClick={() => void open(d)}>
                      Open
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(d)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )
      )}

      <UploadModal
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={() => {
          toast('success', 'Document added');
          setUploading(false);
          void load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete document"
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

function UploadModal({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocCategory>('other');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategory('other');
    setFile(null);
    setError(null);
  }, [open]);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return setFile(null);
    if (!ACCEPTED_TYPES.includes(f.type)) return setError('Choose a PDF, JPEG, PNG or WebP file.');
    if (f.size > MAX_BYTES) return setError('Files can be at most 10 MB.');
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, '').slice(0, 120));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setError(friendlyError('invalid_title'));
    if (!file) return setError('Choose a file to upload.');
    setBusy(true);
    setError(null);
    const kind = file.type === 'application/pdf' ? 'pdf' : 'image';
    const ext = (file.name.includes('.') ? file.name.split('.').pop()! : kind === 'pdf' ? 'pdf' : 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${SOCIETY_ID}/${crypto.randomUUID()}.${ext || 'bin'}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) {
      setBusy(false);
      return setError(`Upload failed: ${friendlyError(up.error)}`);
    }
    const { error: err } = await supabase.rpc('add_document', { p_title: title.trim(), p_category: category, p_file_path: path, p_file_kind: kind });
    if (err) {
      // No row points at the object: take it back out so it is not orphaned.
      await supabase.storage.from(BUCKET).remove([path]);
      setBusy(false);
      return setError(friendlyError(err));
    }
    setBusy(false);
    onUploaded();
  }

  return (
    <Modal
      open={open}
      title="Upload document"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="upload-document" type="submit" icon="upload" busy={busy}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-document" onSubmit={save} className="space-y-4">
        <Field label="File" hint="A PDF or image, up to 10 MB.">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
            <Icon name="paperclip" className="h-4 w-4" />
            <span className="flex-1 truncate">{file ? file.name : 'Choose a file'}</span>
            <input type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </Field>
        <Field label="Title">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Society bylaws 2026" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
            {DOC_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
